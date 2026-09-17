// ============================================================
// Chat completions for the inbound SMS receptionist.
// Same model stack as other text agents. Never throws to the
// webhook path — returns null so the caller can skip a reply.
// ============================================================
import { config } from '../../config.js';
import { inspectXaiApiKey, xaiAuthorizationHeader, redactXaiSecrets } from '../../lib/xai-auth.js';
import {
  DEFAULT_XAI_CHAT_MODEL,
  XAI_CHAT_COMPLETIONS_URL,
  extractGrokChatText,
} from '../public-api/site-chat.helpers.js';
import { parseSmsAgentDecision, type SmsAgentDecision } from './sms-agent.prompt.js';
import pino from 'pino';

const logger = pino({ name: 'sms-agent' });
const TIMEOUT_MS = 18_000;

export async function completeSmsAgent(systemPrompt: string): Promise<SmsAgentDecision | null> {
  const model = (config.XAI_CHAT_MODEL || DEFAULT_XAI_CHAT_MODEL).trim() || DEFAULT_XAI_CHAT_MODEL;
  const keyFields = inspectXaiApiKey(config.XAI_API_KEY);
  const auth = xaiAuthorizationHeader(config.XAI_API_KEY);
  if (!auth || !keyFields.apiKeyPresent) {
    logger.warn({ model }, 'SMS agent skipped — chat key missing');
    return null;
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
        temperature: 0.2,
        max_tokens: 400,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Return the JSON decision for this inbound text.' },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const raw = await res.text();
    if (!res.ok) {
      logger.warn(
        { status: res.status, body: redactXaiSecrets(raw).slice(0, 240), model },
        'SMS agent HTTP error',
      );
      return null;
    }

    let json: unknown = null;
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      logger.warn({ model }, 'SMS agent returned non-JSON envelope');
      return null;
    }

    const text = extractGrokChatText(json);
    if (!text) return null;
    return parseSmsAgentDecision(text);
  } catch (err) {
    logger.warn({ err, model }, 'SMS agent request failed');
    return null;
  }
}
