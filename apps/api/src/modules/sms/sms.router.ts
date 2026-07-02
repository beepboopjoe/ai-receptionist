// ============================================================
// SMS Router — two-way SMS inbox API
//
// GET  /sms/conversations          list conversation threads (grouped by external phone)
// GET  /sms/conversations/:phone   full message thread for one phone number
// POST /sms/send                   send an outbound SMS from the dashboard
//
// All routes require at least 'staff' role.
// ============================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { smsMessages, contacts, tenants } from '../../db/schema.js';
import { and, asc, desc, eq, or } from 'drizzle-orm';
import { sendSms } from '../notifications/adapters/telnyx-sms.adapter.js';
import { getTenantFromNumber } from './tenant-from-number.js';

// Plans that unlock the two-way SMS inbox (send endpoint).
// SMS is included on every paid plan; only the 10-min trial is blocked.
// Reads remain open so downgraded users can still see their history.
const SMS_SEND_PLANS = new Set(['growth', 'scale', 'business', 'enterprise']);

async function smsRouterPlugin(app: FastifyInstance) {
  // ── GET /sms/conversations ────────────────────────────────────────────────
  // Returns one row per unique external phone, sorted by most-recent message.
  app.get(
    '/sms/conversations',
    { onRequest: [app.requireRole('staff')] },
    async (request: FastifyRequest) => {
      const { tenantId } = request.authUser;

      // Fetch the most recent 2000 messages — enough to build all threads
      // without a complex GROUP BY query.
      const messages = await db
        .select()
        .from(smsMessages)
        .where(eq(smsMessages.tenantId, tenantId))
        .orderBy(desc(smsMessages.createdAt))
        .limit(2000);

      // Group by the external phone (the non-tenant side of the conversation).
      // direction='inbound'  → external phone is fromNumber
      // direction='outbound' → external phone is toNumber
      const seen = new Set<string>();
      const threads: {
        externalPhone: string;
        lastMessage: string;
        lastDirection: string;
        lastAt: Date;
        inboundCount: number;
      }[] = [];

      // Count inbound messages per thread for unread badge
      const inboundByPhone = new Map<string, number>();
      for (const msg of messages) {
        const ext = msg.direction === 'inbound' ? msg.fromNumber : msg.toNumber;
        if (msg.direction === 'inbound') {
          inboundByPhone.set(ext, (inboundByPhone.get(ext) ?? 0) + 1);
        }
      }

      for (const msg of messages) {
        const ext = msg.direction === 'inbound' ? msg.fromNumber : msg.toNumber;
        if (seen.has(ext)) continue;
        seen.add(ext);
        threads.push({
          externalPhone:  ext,
          lastMessage:    msg.body.slice(0, 120),
          lastDirection:  msg.direction,
          lastAt:         msg.createdAt,
          inboundCount:   inboundByPhone.get(ext) ?? 0,
        });
      }

      // Enrich with contact info
      const enriched = await Promise.all(
        threads.map(async (t) => {
          const [contact] = await db
            .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
            .from(contacts)
            .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, t.externalPhone)))
            .limit(1);

          return {
            ...t,
            contactId:   contact?.id ?? null,
            contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
          };
        })
      );

      return { data: enriched };
    }
  );

  // ── GET /sms/conversations/:phone ─────────────────────────────────────────
  // Full chronological message thread for one external phone number.
  app.get(
    '/sms/conversations/:phone',
    { onRequest: [app.requireRole('staff')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request.authUser;
      const { phone } = request.params as { phone: string };
      const decoded = decodeURIComponent(phone);

      if (!decoded) return reply.code(400).send({ error: 'phone is required' });

      const thread = await db
        .select()
        .from(smsMessages)
        .where(
          and(
            eq(smsMessages.tenantId, tenantId),
            or(
              eq(smsMessages.fromNumber, decoded),
              eq(smsMessages.toNumber,   decoded)
            )
          )
        )
        .orderBy(asc(smsMessages.createdAt));

      const [contact] = await db
        .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, decoded)))
        .limit(1);

      return {
        phone:       decoded,
        contactId:   contact?.id ?? null,
        contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
        messages:    thread,
      };
    }
  );

  // ── POST /sms/send ────────────────────────────────────────────────────────
  // Send an outbound SMS and record it in sms_messages.
  // Plan-gated: Growth and above only.
  app.post(
    '/sms/send',
    { onRequest: [app.requireRole('staff')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request.authUser;
      const { to, body } = request.body as { to?: string; body?: string };

      if (!to || !body) {
        return reply.code(400).send({
          statusCode: 400,
          error:      'BadRequest',
          message:    'to and body are required',
        });
      }

      // Plan gate (defense in depth — UI also hides this)
      const [tenant] = await db
        .select({ plan: tenants.plan })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant || !SMS_SEND_PLANS.has(tenant.plan ?? 'trial')) {
        return reply.code(402).send({
          statusCode: 402,
          error:      'PaymentRequired',
          message:    'Two-way SMS requires the Starter plan or above.',
        });
      }

      const fromNumber = await getTenantFromNumber(tenantId);
      if (!fromNumber) {
        return reply.code(412).send({
          statusCode: 412,
          error:      'PreconditionFailed',
          message:    'Provision a phone number in Settings → Phone Numbers before sending SMS.',
        });
      }

      const msgId = await sendSms(to, body, fromNumber);

      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, to)))
        .limit(1);

      await db.insert(smsMessages).values({
        tenantId,
        direction:       'outbound',
        fromNumber,
        toNumber:        to,
        body,
        telnyxMessageId: msgId,
        status:          'delivered',
        contactId:       contact?.id ?? null,
      });

      return { ok: true, messageId: msgId };
    }
  );
}

// Plain (encapsulated) plugin so the `/api/v1` prefix in main.ts applies.
// fastify-plugin (fp) de-encapsulates and drops the prefix → routes 404.
export const smsPlugin = smsRouterPlugin;
