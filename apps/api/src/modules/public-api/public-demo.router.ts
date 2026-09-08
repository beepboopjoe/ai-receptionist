// ============================================================
// Public demo router — unauthenticated homepage "Call me" widget.
//
// POST /api/v1/public/call-me
//   • US/CA numbers only
//   • Junk-number filter (555, repeating digits, sequential)
//   • Fastify per-IP cap (3 / 24h) + short Redis anti-double-click cooldown
//   • Global daily cap via DEMO_DAILY_CALL_LIMIT
//   • No 24h per-number lock — a second deliberate submit is allowed
//   • No silent re-dial / retry-on-failure loop (one POST → one dial)
//   • DEMO_SKIP_COOLDOWN skips the per-number Redis check/set (ops/testing
//     only). Call QA must not spam the same number — one checklist dial
//     unless Joey asks again.
//   • 503 when DEMO_TENANT_ID / DEMO_FROM_NUMBER are unset — no crash
//   • 503 when DEMO_TENANT_ID is set but that tenants row is missing
//     (e.g. after a DB restore) — never a raw calls_tenant_id_fkey error
//
// Uses the existing Telnyx dialDirect() path. Does not change inbound
// media-stream or billing checkout.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { config } from '../../config.js';
import { looksLikeLocalhostUrl, toPublicOrigin } from '../../lib/public-url.js';
import { db } from '../../db/client.js';
import { calls, tenants } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { ValidationError } from '../../lib/errors.js';
import { cacheIncr, cacheSetNx, cacheDel } from '../../db/redis.js';
import { auditLog } from '../../audit/audit-logger.js';
import {
  normalizeUsCaPhone,
  isJunkDemoNumber,
  isTruthyEnv,
  isForeignKeyViolation,
  errMessageOf,
  maskPhoneLast4,
  publicCallMeDialFailureMessage,
  formatPublicCallMeDialFailureLog,
  DEMO_CALL_ME_NUM_COOLDOWN_SECONDS,
} from './public-demo.helpers.js';
import { telnyxApiKeyLogFields, telnyxFailureFields } from '../../lib/telnyx-auth.js';

const DEMO_UNAVAILABLE = {
  error: 'demo_unavailable',
  message:
    "Live call-me isn't set up on this site yet. Hear a sample on the demo page instead.",
} as const;

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
        return reply.status(503).send(DEMO_UNAVAILABLE);
      }

      const body = (request.body ?? {}) as { phone?: string };
      const phone = normalizeUsCaPhone(body.phone ?? '');
      if (!phone) {
        throw new ValidationError('Enter a valid US or Canada mobile number, like (415) 321-1212.');
      }
      if (isJunkDemoNumber(phone)) {
        throw new ValidationError('That number looks invalid. Try a real US or Canada mobile.');
      }

      const [demoTenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, demoTenantId))
        .limit(1);
      if (!demoTenant) {
        request.log.warn({ demoTenantId }, 'Public call-me DEMO_TENANT_ID is missing from tenants');
        return reply.status(503).send(DEMO_UNAVAILABLE);
      }

      const skipCooldown = isTruthyEnv(config.DEMO_SKIP_COOLDOWN);
      const cooldownKey = `demo:call-me:num:${phone}`;
      if (!skipCooldown) {
        const claimed = await cacheSetNx(cooldownKey, '1', DEMO_CALL_ME_NUM_COOLDOWN_SECONDS);
        if (claimed === false) {
          return reply.status(429).send({
            error: 'cooldown',
            message: 'Hang on a few seconds — that click already requested a call. If you still want another one, submit again.',
          });
        }
      }

      const dayKey = `demo:call-me:day:${utcDayKey()}`;
      const daily = await cacheIncr(dayKey, 60 * 60 * 26);
      if (daily !== null && daily > config.DEMO_DAILY_CALL_LIMIT) {
        if (!skipCooldown) await cacheDel(cooldownKey);
        return reply.status(503).send({
          error: 'demo_capped',
          message: "We've hit today's demo-call limit. Hear a sample on the demo page, or try again tomorrow.",
        });
      }

      let callRecord: { id: string };
      try {
        const [inserted] = await db
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
        callRecord = inserted!;
      } catch (err) {
        if (isForeignKeyViolation(err)) {
          request.log.warn({ err, demoTenantId }, 'Public call-me call insert FK — demo tenant missing');
          if (!skipCooldown) await cacheDel(cooldownKey);
          return reply.status(503).send(DEMO_UNAVAILABLE);
        }
        throw err;
      }

      const callId = callRecord.id;

      void import('./demo-closer.js').then(async ({ emptyDemoLeadDraft }) => {
        const { upsertDemoCallMeLead } = await import('./demo-lead.service.js');
        await upsertDemoCallMeLead({
          tenantId: demoTenantId,
          phoneE164: phone,
          callId,
          draft: emptyDemoLeadDraft(),
          log: request.log,
        });
      }).catch((err) => {
        request.log.warn({ err, callId }, 'Demo call-me stub lead persist failed');
      });

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
        const errMessage = errMessageOf(err);
        const { httpStatus, bodyClipped } = telnyxFailureFields(err);
        const keyFields = telnyxApiKeyLogFields(process.env['TELNYX_API_KEY']);
        const { message, fields } = formatPublicCallMeDialFailureLog({
          httpStatus,
          bodyClipped,
          ...keyFields,
          connectionIdPresent: Boolean(config.TELNYX_APP_ID?.trim()),
          fromMasked: maskPhoneLast4(demoFromNumber),
        });
        request.log.error(
          {
            errMessage,
            httpStatus: fields.httpStatus,
            bodyClipped: fields.bodyClipped,
            apiKeyPresent: fields.apiKeyPresent,
            apiKeyLen: fields.apiKeyLen,
            apiKeyPrefix: fields.apiKeyPrefix,
            keySanitized: fields.keySanitized,
            strippedQuotes: fields.strippedQuotes,
            strippedWhitespace: fields.strippedWhitespace,
            strippedBearerPrefix: fields.strippedBearerPrefix,
            connectionIdPresent: fields.connectionIdPresent,
            fromMasked: fields.fromMasked,
            callId,
            appUrlOrigin: toPublicOrigin(config.APP_URL),
          },
          message,
        );
        await db
          .update(calls)
          .set({ status: 'failed', outcome: 'dial_error', updatedAt: new Date() })
          .where(eq(calls.id, callId));
        if (!skipCooldown) await cacheDel(cooldownKey);
        return reply.status(502).send({
          error: 'dial_failed',
          message: publicCallMeDialFailureMessage(errMessage, {
            localhostOrigin: looksLikeLocalhostUrl(config.APP_URL),
          }),
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
