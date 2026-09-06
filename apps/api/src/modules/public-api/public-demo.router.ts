// ============================================================
// Public demo router — unauthenticated homepage "Call me" widget.
//
// POST /api/v1/public/call-me
//   • US/CA numbers only
//   • Junk-number filter (555, repeating digits, sequential)
//   • Fastify per-IP cap (3 / 24h) + Redis per-number cooldown (1 / hour)
//   • Global daily cap via DEMO_DAILY_CALL_LIMIT
//   • 503 when DEMO_TENANT_ID / DEMO_FROM_NUMBER are unset — no crash
//
// Uses the existing Telnyx dialDirect() path. Does not change inbound
// media-stream or billing checkout.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { config } from '../../config.js';
import { db } from '../../db/client.js';
import { calls } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { ValidationError } from '../../lib/errors.js';
import { cacheIncr, cacheSetNx } from '../../db/redis.js';
import { auditLog } from '../../audit/audit-logger.js';
import { normalizeUsCaPhone, isJunkDemoNumber } from './public-demo.helpers.js';

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function publicDemoPlugin(app: FastifyInstance): Promise<void> {
  app.post(
    '/public/call-me',
    {
      config: { rateLimit: { max: 3, timeWindow: '24 hours' } },
      schema: {
        tags: ['Public demo'],
        summary: 'Request a live demo call',
        description:
          'Places a short inbound-style demo call to a US/CA number. Returns 503 when the demo tenant is not configured.',
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string', minLength: 10, maxLength: 32 },
          },
        },
      },
    },
    async (request, reply) => {
      const demoTenantId = config.DEMO_TENANT_ID?.trim();
      const demoFromNumber = config.DEMO_FROM_NUMBER?.trim();
      if (!demoTenantId || !demoFromNumber) {
        return reply.status(503).send({
          error: 'demo_unavailable',
          message:
            "Live call-me isn't set up on this site yet. Hear a sample on the demo page instead.",
        });
      }

      const body = (request.body ?? {}) as { phone?: string };
      const phone = normalizeUsCaPhone(body.phone ?? '');
      if (!phone) {
        throw new ValidationError('Enter a valid US or Canada mobile number, like (415) 321-1212.');
      }
      if (isJunkDemoNumber(phone)) {
        throw new ValidationError('That number looks invalid. Try a real US or Canada mobile.');
      }

      const cooldownKey = `demo:call-me:num:${phone}`;
      const claimed = await cacheSetNx(cooldownKey, '1', 60 * 60);
      if (claimed === false) {
        return reply.status(429).send({
          error: 'cooldown',
          message: 'This number already requested a demo call recently. Try again in an hour, or hear a sample instead.',
        });
      }

      const dayKey = `demo:call-me:day:${utcDayKey()}`;
      const daily = await cacheIncr(dayKey, 60 * 60 * 26);
      if (daily !== null && daily > config.DEMO_DAILY_CALL_LIMIT) {
        return reply.status(503).send({
          error: 'demo_capped',
          message: "We've hit today's demo-call limit. Hear a sample on the demo page, or try again tomorrow.",
        });
      }

      const [callRecord] = await db
        .insert(calls)
        .values({
          tenantId: demoTenantId,
          rcCallId: `pending-demo-${Date.now()}`,
          direction: 'test',
          fromNumber: phone,
          toNumber: demoFromNumber,
          status: 'active',
          startedAt: new Date(),
        })
        .returning({ id: calls.id });

      const callId = callRecord!.id;

      const { dialDirect } = await import('../campaigns/telnyx-dialer.service.js');
      let callSid: string;
      try {
        const result = await dialDirect({
          to: phone,
          from: demoFromNumber,
          callId,
          tenantId: demoTenantId,
          fromNumber: phone,
          mode: 'demo',
        });
        callSid = result.callSid;
      } catch (err) {
        request.log.error({ err, callId }, 'Public call-me Telnyx dial failed');
        await db
          .update(calls)
          .set({ status: 'failed', outcome: 'dial_error', updatedAt: new Date() })
          .where(eq(calls.id, callId));
        return reply.status(502).send({
          error: 'dial_failed',
          message: "We couldn't place the call right now. Hear a sample instead, or try again in a minute.",
        });
      }

      await db
        .update(calls)
        .set({ rcCallId: callSid, updatedAt: new Date() })
        .where(eq(calls.id, callId));

      auditLog({
        tenantId: demoTenantId,
        actorType: 'api',
        action: 'call.demo_call_placed',
        entityType: 'call',
        entityId: callId,
        metadata: { toNumber: phone, fromNumber: demoFromNumber, callSid },
      });

      return reply.send({
        ok: true,
        message: 'Calling you now — pick up to hear the receptionist.',
      });
    }
  );
}
