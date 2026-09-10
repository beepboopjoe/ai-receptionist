// ============================================================
// Pure helpers for the public marketing product chatbot.
// Kept off Fastify/config so unit tests stay cheap.
// ============================================================
import { normalizeUsCaPhone, isJunkDemoNumber } from './public-demo.helpers.js';

export const SITE_CHAT_MAX_MESSAGES = 12;
export const SITE_CHAT_MAX_MESSAGE_CHARS = 800;
export const SITE_CHAT_TRANSCRIPT_CHARS = 2000;
export const SITE_CHAT_CONV_TTL_SECONDS = 45 * 60;
export const SITE_CHAT_IP_HOUR_LIMIT = 40;
export const SITE_CHAT_LEAD_IP_HOUR_LIMIT = 8;
export const SITE_CHAT_RATE_MAX = 20;
export const SITE_CHAT_RATE_WINDOW = '10 minutes';
export const SITE_CHAT_LEAD_RATE_MAX = 8;
export const SITE_CHAT_LEAD_RATE_WINDOW = '1 hour';
export const SITE_CHAT_GROK_TIMEOUT_MS = 20_000;
export const DEFAULT_XAI_CHAT_MODEL = 'grok-4.3';
export const XAI_CHAT_COMPLETIONS_URL = 'https://api.x.ai/v1/chat/completions';

export type SiteChatRole = 'user' | 'assistant';

export interface SiteChatMessage {
  role: SiteChatRole;
  content: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const INTENT_RE =
  /try free|sign\s*up|pricing|price|call me|hear it|demo|get started|start a trial|talk to (?:someone|sales)|contact (?:me|you)|email me|quote|plan|growth|scale|business/i;

export function sanitizeChatMessages(input: unknown): SiteChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: SiteChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as { role?: unknown; content?: unknown };
    if (rec.role !== 'user' && rec.role !== 'assistant') continue;
    if (typeof rec.content !== 'string') continue;
    const content = rec.content.replace(/\s+/g, ' ').trim().slice(0, SITE_CHAT_MAX_MESSAGE_CHARS);
    if (!content) continue;
    out.push({ role: rec.role, content });
    if (out.length >= SITE_CHAT_MAX_MESSAGES) break;
  }
  return out;
}

export function lastUserMessage(messages: SiteChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user' && m.content) return m.content;
  }
  return null;
}

export function shouldSuggestLeadCapture(
  messages: SiteChatMessage[],
  alreadyCaptured: boolean,
): boolean {
  if (alreadyCaptured) return false;
  const users = messages.filter((m) => m.role === 'user');
  if (users.length >= 3) return true;
  const blob = users.map((m) => m.content).join(' ');
  return INTENT_RE.test(blob);
}

export function formatTranscriptSnippet(messages: SiteChatMessage[]): string {
  const lines = messages.map((m) => `${m.role === 'user' ? 'Visitor' : 'Telfin'}: ${m.content}`);
  return lines.join('\n').slice(0, SITE_CHAT_TRANSCRIPT_CHARS);
}

export function isValidEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  return email.length >= 6 && email.length <= 120 && EMAIL_RE.test(email);
}

export interface SiteChatLeadDraft {
  name: string;
  email: string | null;
  phoneE164: string | null;
  emailConsent: boolean;
  smsConsent: boolean;
  conversationId: string | null;
  pagePath: string | null;
  transcript: string;
}

export type SiteChatLeadValidation =
  | { ok: true; data: SiteChatLeadDraft }
  | { ok: false; message: string };

export function validateSiteChatLead(body: unknown): SiteChatLeadValidation {
  const rec = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = typeof rec['name'] === 'string' ? rec['name'].replace(/\s+/g, ' ').trim() : '';
  if (name.length < 2 || name.length > 80) {
    return { ok: false, message: 'Enter your name so we know who to follow up with.' };
  }

  const emailRaw = typeof rec['email'] === 'string' ? rec['email'].trim().toLowerCase() : '';
  const email = emailRaw && isValidEmail(emailRaw) ? emailRaw : null;
  if (emailRaw && !email) {
    return { ok: false, message: 'Enter a valid email, or leave it blank and use a phone instead.' };
  }

  const phoneRaw = typeof rec['phone'] === 'string' ? rec['phone'] : '';
  let phoneE164: string | null = null;
  if (phoneRaw.trim()) {
    const normalized = normalizeUsCaPhone(phoneRaw);
    if (!normalized || isJunkDemoNumber(normalized)) {
      return { ok: false, message: 'Enter a valid US or Canada mobile, or leave phone blank.' };
    }
    phoneE164 = normalized;
  }

  if (!email && !phoneE164) {
    return { ok: false, message: 'Leave an email and/or a US/Canada phone so we can follow up.' };
  }

  const emailConsent = rec['emailConsent'] === true;
  const smsConsent = rec['smsConsent'] === true;
  if (email && !emailConsent) {
    return { ok: false, message: 'Check the box to agree to product emails, or clear the email field.' };
  }
  if (phoneE164 && !smsConsent) {
    return {
      ok: false,
      message: 'Check the box to agree to a call or text on that number, or clear the phone field.',
    };
  }

  const conversationId =
    typeof rec['conversationId'] === 'string' && rec['conversationId'].trim().length > 8
      ? rec['conversationId'].trim().slice(0, 80)
      : null;
  const pagePath =
    typeof rec['pagePath'] === 'string' ? rec['pagePath'].trim().slice(0, 200) : null;

  const clientMessages = sanitizeChatMessages(rec['messages']);
  const transcript = formatTranscriptSnippet(clientMessages);

  return {
    ok: true,
    data: {
      name,
      email,
      phoneE164,
      emailConsent: Boolean(email) && emailConsent,
      smsConsent: Boolean(phoneE164) && smsConsent,
      conversationId,
      pagePath: pagePath || null,
      transcript,
    },
  };
}

export function mergeConversation(
  stored: SiteChatMessage[] | null,
  incoming: SiteChatMessage[],
): SiteChatMessage[] {
  const base = stored && stored.length > 0 ? stored : incoming.slice(0, -1);
  const lastUser = lastUserMessage(incoming);
  if (!lastUser) return base.slice(-SITE_CHAT_MAX_MESSAGES);
  const next = [...base, { role: 'user' as const, content: lastUser }];
  return next.slice(-SITE_CHAT_MAX_MESSAGES);
}

export function fallbackChatReply(): string {
  return "I can help with Telfin — the AI phone receptionist. Ask about pricing, voices, going live, or hearing a demo on your phone. Or Try Free (no card) whenever you're ready.";
}

export function offTopicFallback(): string {
  return "I'm here for Telfin questions only — the AI phone receptionist. Want pricing, a live phone demo, or how to go live?";
}

export interface GrokChatCompletionJson {
  choices?: Array<{ message?: { content?: unknown } }>;
}

export function extractGrokChatText(json: unknown): string {
  const rec = json && typeof json === 'object' ? (json as GrokChatCompletionJson) : null;
  const content = rec?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return '';
  return content.replace(/\s+\n/g, '\n').trim();
}
