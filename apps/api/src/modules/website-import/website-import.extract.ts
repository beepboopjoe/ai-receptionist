// ============================================================
// Optional LLM refine of scraped website text.
// Heuristic extract is the source of truth; this only fills
// gaps. Failures are silent — go-live must not wait on it.
// ============================================================
import { config } from '../../config.js';
import { inspectXaiApiKey, xaiAuthorizationHeader } from '../../lib/xai-auth.js';
import {
  DEFAULT_XAI_CHAT_MODEL,
  XAI_CHAT_COMPLETIONS_URL,
  extractGrokChatText,
} from '../public-api/site-chat.helpers.js';
import {
  factsHaveContent,
  parseFactsJson,
  type ScrapedPage,
  type WebsiteFacts,
} from './website-import.helpers.js';

const EXTRACT_TIMEOUT_MS = 12_000;

const SYSTEM = `Extract facts a small-business phone receptionist should know.
Return ONLY JSON with keys: businessName, services, hours, location, faqs, notes.
- services: short bullet lines of offerings
- hours: opening hours as plain text
- location: street / city if present
- faqs: "Q: ... A: ..." pairs if the page has them
- notes: 1-3 sentences about the business
Use empty strings when unknown. No vendor names. No markdown fences.`;

export async function refineFactsWithLlm(
  pages: ScrapedPage[],
  fallback: WebsiteFacts,
): Promise<WebsiteFacts> {
  const auth = xaiAuthorizationHeader(config.XAI_API_KEY);
  const key = inspectXaiApiKey(config.XAI_API_KEY);
  if (!auth || !key.apiKeyPresent) return fallback;

  const excerpt = pages
    .map((p) => `URL: ${p.url}\n${p.text}`)
    .join('\n\n----\n\n')
    .slice(0, 12_000);

  try {
    const model = (config.XAI_CHAT_MODEL || DEFAULT_XAI_CHAT_MODEL).trim() || DEFAULT_XAI_CHAT_MODEL;
    const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: excerpt },
        ],
      }),
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
    });
    if (!res.ok) return fallback;
    const text = extractGrokChatText(await res.json());
    const parsed = parseFactsJson(text, fallback.sourceUrl);
    if (!parsed || !factsHaveContent(parsed)) return fallback;
    return mergeFacts(fallback, parsed);
  } catch {
    return fallback;
  }
}

function mergeFacts(base: WebsiteFacts, extra: WebsiteFacts): WebsiteFacts {
  return {
    businessName: extra.businessName || base.businessName,
    services: extra.services || base.services,
    hours: extra.hours || base.hours,
    location: extra.location || base.location,
    faqs: extra.faqs || base.faqs,
    notes: extra.notes || base.notes,
    sourceUrl: base.sourceUrl || extra.sourceUrl,
  };
}
