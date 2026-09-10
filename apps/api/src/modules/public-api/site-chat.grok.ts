// ============================================================
// Grok chat completions for the public marketing FAQ widget.
// OpenAI-compatible POST https://api.x.ai/v1/chat/completions.
// Never throws to the request path — returns a fallback string.
// ============================================================
import { config } from '../../config.js';
import { inspectXaiApiKey, xaiAuthorizationHeader, redactXaiSecrets } from '../../lib/xai-auth.js';
import {
  DEFAULT_XAI_CHAT_MODEL,
  SITE_CHAT_GROK_TIMEOUT_MS,
  XAI_CHAT_COMPLETIONS_URL,
  extractGrokChatText,
  fallbackChatReply,
  type SiteChatMessage,
} from './site-chat.helpers.js';
import { SITE_CHAT_SYSTEM_PROMPT } from './site-chat.prompt.js';

export interface SiteChatGrokLog {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
  error: (obj: object, msg: string) => void;
}

export async function completeSiteChat(params: {
  messages: SiteChatMessage[];
  log?: SiteChatGrokLog;
}): Promise<{ reply: string; model: string; degraded: boolean }> {
  const model = (config.XAI_CHAT_MODEL || DEFAULT_XAI_CHAT_MODEL).trim() || DEFAULT_XAI_CHAT_MODEL;
  const keyFields = inspectXaiApiKey(config.XAI_API_KEY);
  const auth = xaiAuthorizationHeader(config.XAI_API_KEY);
  if (!auth || !keyFields.apiKeyPresent) {
    params.log?.warn({ model }, 'Site chat skipped — XAI_API_KEY missing');
    return { reply: fallbackChatReply(), model, degraded: true };
  }

  try {
    const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 450,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: SITE_CHAT_SYSTEM_PROMPT },
          ...params.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
      signal: AbortSignal.timeout(SITE_CHAT_GROK_TIMEOUT_MS),
    });

    const raw = await res.text();
    if (!res.ok) {
      params.log?.warn(
        { status: res.status, body: redactXaiSecrets(raw).slice(0, 240), model },
        'Site chat Grok HTTP error',
      );
      return { reply: fallbackChatReply(), model, degraded: true };
    }

    let json: unknown = null;
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      params.log?.warn({ model }, 'Site chat Grok returned non-JSON');
      return { reply: fallbackChatReply(), model, degraded: true };
    }

    const text = extractGrokChatText(json);
    if (!text) {
      params.log?.warn({ model }, 'Site chat Grok empty content');
      return { reply: fallbackChatReply(), model, degraded: true };
    }
    return { reply: text.slice(0, 1600), model, degraded: false };
  } catch (err) {
    params.log?.warn({ err, model }, 'Site chat Grok request failed');
    return { reply: fallbackChatReply(), model, degraded: true };
  }
}
