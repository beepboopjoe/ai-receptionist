// ============================================================
// Public marketing product chatbot.
//
// POST /api/v1/public/site-chat
//   • Unauthenticated FAQ / upsell via Grok chat completions
//   • Tight system prompt (Telfin product only)
//   • Per-IP Fastify + Redis hourly caps
//   • Does not dial, does not change call-me cooldown flags
//
// POST /api/v1/public/site-chat/lead
//   • Name + email and/or US/CA phone
//   • Explicit email + SMS/call consent (TCPA)
//   • Persists to demo_leads (source=site_chat)
// ============================================================
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../lib/errors.js';
import { cacheGet, cacheIncr, cacheSet } from '../../db/redis.js';
import { completeSiteChat } from './site-chat.grok.js';
import { persistSiteChatLead } from './site-chat.service.js';
import {
  SITE_CHAT_CONV_TTL_SECONDS,
  SITE_CHAT_IP_HOUR_LIMIT,
  SITE_CHAT_LEAD_IP_HOUR_LIMIT,
  SITE_CHAT_LEAD_RATE_MAX,
  SITE_CHAT_LEAD_RATE_WINDOW,
  SITE_CHAT_MAX_MESSAGES,
  SITE_CHAT_RATE_MAX,
  SITE_CHAT_RATE_WINDOW,
  formatTranscriptSnippet,
  lastUserMessage,
  mergeConversation,
  sanitizeChatMessages,
  shouldSuggestLeadCapture,
  validateSiteChatLead,
  type SiteChatMessage,
} from './site-chat.helpers.js';
import { SITE_CHAT_CALL_ME_PATH, SITE_CHAT_TRY_FREE_PATH } from './site-chat.prompt.js';

const CHAT_UNAVAILABLE = {
  error: 'chat_unavailable',
  message: 'Chat is taking a break. Try pricing, or hear it on your phone from the demo page.',
} as const;

interface StoredConv {
  messages: SiteChatMessage[];
  captured?: boolean;
}

function convKey(id: string): string {
  return `site-chat:conv:${id}`;
}

function chatIpKey(ip: string): string {
  return `site-chat:ip:${ip}`;
}

function leadIpKey(ip: string): string {
  return `site-chat:lead-ip:${ip}`;
}

function requestIp(request: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim().slice(0, 64);
  }
  return (request.ip || 'unknown').slice(0, 64);
}

async function loadConv(id: string): Promise<StoredConv | null> {
  const raw = await cacheGet(convKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredConv;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return {
      messages: sanitizeChatMessages(parsed.messages),
      captured: Boolean(parsed.captured),
    };
  } catch {
    return null;
  }
}

async function saveConv(id: string, conv: StoredConv): Promise<void> {
  await cacheSet(
    convKey(id),
    JSON.stringify({
      messages: conv.messages.slice(-SITE_CHAT_MAX_MESSAGES),
      captured: Boolean(conv.captured),
    }),
    SITE_CHAT_CONV_TTL_SECONDS,
  );
}

async function overHourlyCap(key: string, limit: number): Promise<boolean> {
  const count = await cacheIncr(key, 60 * 60);
  if (count === null) return false;
  return count > limit;
}

export async function publicSiteChatPlugin(app: FastifyInstance): Promise<void> {
  app.post(
    '/public/site-chat',
    {
      config: { rateLimit: { max: SITE_CHAT_RATE_MAX, timeWindow: SITE_CHAT_RATE_WINDOW } },
      schema: {
        tags: ['Public demo'],
        summary: 'Marketing site product chatbot',
        description:
          'Unauthenticated Telfin FAQ chat via Grok. Does not place calls. Rate-limited per IP.',
        body: {
          type: 'object',
          required: ['messages'],
          properties: {
            messages: { type: 'array', maxItems: SITE_CHAT_MAX_MESSAGES },
            conversationId: { type: 'string', maxLength: 80 },
            pagePath: { type: 'string', maxLength: 200 },
          },
        },
      },
    },
    async (request, reply) => {
      const ip = requestIp(request);
      if (await overHourlyCap(chatIpKey(ip), SITE_CHAT_IP_HOUR_LIMIT)) {
        return reply.status(429).send({
          error: 'rate_limited',
          message: 'Too many chat messages from this network. Try again in a bit, or open pricing / the live demo.',
        });
      }

      const body = (request.body ?? {}) as {
        messages?: unknown;
        conversationId?: unknown;
        pagePath?: unknown;
      };
      const incoming = sanitizeChatMessages(body.messages);
      if (!lastUserMessage(incoming)) {
        throw new ValidationError('Send a short question about Telfin.');
      }

      const givenId =
        typeof body.conversationId === 'string' ? body.conversationId.trim().slice(0, 80) : '';
      const conversationId =
        givenId && /^[0-9a-f-]{8,80}$/i.test(givenId) ? givenId : randomUUID();
      const stored = givenId ? await loadConv(conversationId) : null;
      const history = mergeConversation(stored?.messages ?? null, incoming);
      const captured = Boolean(stored?.captured);

      const grok = await completeSiteChat({ messages: history, log: request.log });
      const replyMsg: SiteChatMessage = { role: 'assistant', content: grok.reply };
      const messages = [...history, replyMsg].slice(-SITE_CHAT_MAX_MESSAGES);

      await saveConv(conversationId, { messages, captured });

      return reply.send({
        ok: true,
        reply: grok.reply,
        conversationId,
        suggestCapture: shouldSuggestLeadCapture(messages, captured),
        degraded: grok.degraded,
        ctas: [
          { label: 'Try Free', href: SITE_CHAT_TRY_FREE_PATH },
          { label: 'Hear it on your phone', href: SITE_CHAT_CALL_ME_PATH },
        ],
      });
    },
  );

  app.post(
    '/public/site-chat/lead',
    {
      config: { rateLimit: { max: SITE_CHAT_LEAD_RATE_MAX, timeWindow: SITE_CHAT_LEAD_RATE_WINDOW } },
      schema: {
        tags: ['Public demo'],
        summary: 'Capture a marketing chat lead',
        description:
          'Stores name + email and/or phone on demo_leads after explicit email and (if phone) SMS/call consent. Never dials.',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 80 },
            email: { type: 'string', maxLength: 120 },
            phone: { type: 'string', maxLength: 32 },
            emailConsent: { type: 'boolean' },
            smsConsent: { type: 'boolean' },
            conversationId: { type: 'string', maxLength: 80 },
            pagePath: { type: 'string', maxLength: 200 },
            messages: { type: 'array', maxItems: SITE_CHAT_MAX_MESSAGES },
          },
        },
      },
    },
    async (request, reply) => {
      const ip = requestIp(request);
      if (await overHourlyCap(leadIpKey(ip), SITE_CHAT_LEAD_IP_HOUR_LIMIT)) {
        return reply.status(429).send({
          error: 'rate_limited',
          message: 'Too many contact forms from this network. Email hello@telfin.ai instead.',
        });
      }

      const parsed = validateSiteChatLead(request.body);
      if (!parsed.ok) {
        throw new ValidationError(parsed.message);
      }

      let transcript = parsed.data.transcript;
      if (parsed.data.conversationId) {
        const stored = await loadConv(parsed.data.conversationId);
        if (stored?.messages.length) {
          const fromStore = formatTranscriptSnippet(stored.messages);
          if (fromStore) transcript = fromStore;
          await saveConv(parsed.data.conversationId, { messages: stored.messages, captured: true });
        }
      }

      const saved = await persistSiteChatLead({
        draft: { ...parsed.data, transcript },
        log: request.log,
      });
      if (!saved) {
        return reply.status(503).send(CHAT_UNAVAILABLE);
      }

      return reply.send({
        ok: true,
        id: saved.id,
        message: "Thanks — we'll follow up. You can Try Free anytime, or hear it on your phone.",
        ctas: [
          { label: 'Try Free', href: SITE_CHAT_TRY_FREE_PATH },
          { label: 'Hear it on your phone', href: SITE_CHAT_CALL_ME_PATH },
        ],
      });
    },
  );
}
