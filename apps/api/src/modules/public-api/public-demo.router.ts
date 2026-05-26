// ============================================================
// Public demo endpoints — unauthenticated, heavily rate-limited.
// Powers the homepage "Call me now" widget. A visitor enters
// their phone number, we place an outbound Telnyx call from
// the platform's demo number, and the demo tenant's AI greets
// them as if they had called us.
//
// All endpoints in this file are public — no JWT, no API key.
// Abuse is bounded by:
//   - Per-IP rate limit (3 / 24h)
//   - Global daily cap (DEMO_DAILY_CALL_LIMIT, default 200)
//   - US/CA-only phone number filter
//   - Obvious-junk pattern rejection (555/000/sequential)
//
// When DEMO_TENANT_ID / DEMO_FROM_NUMBER are unset (typical
// dev environment), the endpoint responds 503 with a clear
// "not configured" message instead of crashing.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { calls, tenants } from '../../db/schema.js';
import { eq, and, gte, count } from 'drizzle-orm';
import { config } from '../../config.js';
import { dialDirect } from '../campaigns/telnyx-dialer.service.js';
import { auditLog } from '../../audit/audit-logger.js';
import pino from 'pino';

const logger = pino({ name: 'public-demo' });

// E.164 — accepts +1XXXXXXXXXX (US/CA) only for V1. Internationalize later.
const PHONE_E164_US_CA = /^\+1[2-9]\d{9}$/;

/** Cheap junk-number heuristics. None of these will hit a real US/CA line. */
function isJunkNumber(e164: string): boolean {
  const digits = e164.slice(2); // strip +1
  // Sequential ascending (1234567890) / descending / all-same digit
  if (/^(\d)\1{9}$/.test(digits)) return true;
  if (digits === '1234567890' || digits === '0987654321') return true;
  // 555 / 000 area codes
  const areaCode = digits.slice(0, 3);
  if (areaCode === '555' || areaCode === '000') return true;
  // 555-01XX (reserved-for-fiction exchange) anywhere in US
  if (digits.slice(3, 7) === '5550') return true;
  return false;
}

export async function publicDemoPlugin(app: FastifyInstance): Promise<void> {
  // ── POST /public/call-me ────────────────────────────────────
  app.post(
    '/public/call-me',
    {
      // Fastify rate-limit plugin: 3 requests per IP per 24h. Keyed by IP only
      // since unauthenticated. The plugin returns 429 automatically when hit.
      config: { rateLimit: { max: 3, timeWindow: '24 hours' } },
      schema: {
        tags: ['Demo'],
        summary: '"Call me now" demo — public, unauthenticated',
        description:
          'Places an outbound call from the platform demo number to the supplied ' +
          'phone number. The visitor picks up and hears our demo AI receptionist. ' +
          'No signup, no auth, heavily rate-limited.',
        body: {
          type: 'object',
          required: ['phoneE164'],
          properties: {
            phoneE164: { type: 'string', pattern: '^\\+1[2-9]\\d{9}$' },
          },
        },
      },
    },
    async (request, reply) => {
      const { phoneE164 } = request.body as { phoneE164: string };
      const ipAddress =
        (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        request.ip ??
        'unknown';

      // 1. Pre-flight: demo tenant configured?
      if (!config.DEMO_TENANT_ID || !config.DEMO_FROM_NUMBER || !config.TELNYX_API_KEY) {
        logger.warn({ ipAddress }, 'Call-me request but demo not configured');
        return reply.status(503).send({
          error: 'demo_unavailable',
          message: 'The live demo is being updated. Try the recorded demo at /demo.',
        });
      }

      // 2. Phone validation — format + junk filter.
      if (!PHONE_E164_US_CA.test(phoneE164)) {
        return reply.status(400).send({
          error: 'invalid_phone',
          message: 'Please enter a valid US or Canadian phone number.',
        });
      }
      if (isJunkNumber(phoneE164)) {
        logger.info({ phoneE164, ipAddress }, 'Junk number rejected');
        return reply.status(400).send({
          error: 'invalid_phone',
          message: 'Please enter a real phone number we can call.',
        });
      }

      // 3. Global daily cap — single SELECT against calls table, cheap.
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const todayRows = await db
        .select({ todayCount: count() })
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, config.DEMO_TENANT_ID),
            eq(calls.direction, 'demo'),
            gte(calls.startedAt, dayStart)
          )
        );
      const todayCount = todayRows[0]?.todayCount ?? 0;
      if (Number(todayCount) >= config.DEMO_DAILY_CALL_LIMIT) {
        logger.warn({ todayCount, limit: config.DEMO_DAILY_CALL_LIMIT }, 'Demo daily cap hit');
        return reply.status(429).send({
          error: 'daily_limit_reached',
          message: "We've hit our daily demo limit. Try again tomorrow or book a live demo.",
        });
      }

      // 4. Per-number cooldown — same number can't request twice within an hour.
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const cooldownRows = await db
        .select({ recentSameNumber: count() })
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, config.DEMO_TENANT_ID),
            eq(calls.direction, 'demo'),
            eq(calls.toNumber, phoneE164),
            gte(calls.startedAt, hourAgo)
          )
        );
      const recentSameNumber = cooldownRows[0]?.recentSameNumber ?? 0;
      if (Number(recentSameNumber) > 0) {
        return reply.status(429).send({
          error: 'number_cooldown',
          message: 'This number already requested a demo recently. Try again in an hour.',
        });
      }

      // 5. Verify the demo tenant actually exists. Defensive — env var could
      //    point at a deleted/never-created row in a fresh environment.
      const [demoTenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, config.DEMO_TENANT_ID))
        .limit(1);
      if (!demoTenant) {
        logger.error(
          { demoTenantId: config.DEMO_TENANT_ID },
          'DEMO_TENANT_ID does not match any tenant row'
        );
        return reply.status(503).send({
          error: 'demo_unavailable',
          message: 'The live demo is being updated. Try the recorded demo at /demo.',
        });
      }

      // 6. Create call record. fromNumber = visitor (the AI's "caller"),
      //    toNumber = the platform demo number. direction='demo' so we can
      //    bucket these out of billed-minute counters and tenant stats.
      const [callRecord] = await db
        .insert(calls)
        .values({
          tenantId: config.DEMO_TENANT_ID,
          rcCallId: `pending-demo-${Date.now()}`,
          direction: 'demo',
          fromNumber: phoneE164,
          toNumber: config.DEMO_FROM_NUMBER,
          status: 'active',
          startedAt: new Date(),
        })
        .returning({ id: calls.id });

      const callId = callRecord!.id;

      // 7. Place the call via Telnyx.
      let callSid: string;
      try {
        const result = await dialDirect({
          to: phoneE164,
          from: config.DEMO_FROM_NUMBER,
          callId,
          tenantId: config.DEMO_TENANT_ID,
          fromNumber: phoneE164,
          mode: 'demo',
        });
        callSid = result.callSid;
      } catch (err) {
        logger.error({ err, phoneE164 }, 'Telnyx demo dial failed');
        // Roll the call record back to failed so it doesn't pollute stats.
        await db
          .update(calls)
          .set({ status: 'failed', outcome: 'dial_error', updatedAt: new Date() })
          .where(eq(calls.id, callId));
        return reply.status(502).send({
          error: 'dial_failed',
          message: "Couldn't place the call right now. Please try again.",
        });
      }

      await db
        .update(calls)
        .set({ rcCallId: callSid, updatedAt: new Date() })
        .where(eq(calls.id, callId));

      auditLog({
        tenantId: config.DEMO_TENANT_ID,
        actorType: 'system',
        action: 'demo.call_me_requested',
        entityType: 'call',
        entityId: callId,
        metadata: { phoneE164, ipAddress, callSid },
      });

      logger.info({ callId, callSid, phoneE164, ipAddress }, 'Demo call-me initiated');

      return reply.send({
        ok: true,
        callId,
        message: "We're calling you now. Look at your phone!",
      });
    }
  );
}
