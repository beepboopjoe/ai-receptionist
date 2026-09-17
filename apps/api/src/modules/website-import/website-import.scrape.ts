// ============================================================
// Fetch a public website (homepage + a few obvious paths).
// SSRF-hardened: http(s) only, blocked hosts / private IPs,
// size + timeout caps. Failures are skippable — never throw
// to the go-live path.
// ============================================================
import { lookup } from 'node:dns/promises';
import {
  extraPathsForSite,
  htmlToText,
  extractTitle,
  extractMetaDescription,
  isBlockedHostname,
  isBlockedIp,
  MAX_PAGE_BYTES,
  MAX_PAGES,
  SCRAPE_TIMEOUT_MS,
  type ScrapedPage,
} from './website-import.helpers.js';

export interface ScrapeResult {
  ok: boolean;
  pages: ScrapedPage[];
  reason?: 'blocked' | 'unreachable' | 'empty';
}

const USER_AGENT = 'TelfinSetup/1.0 (+https://telfin.ai)';

export async function scrapeWebsite(startHref: string, hostname: string): Promise<ScrapeResult> {
  const origin = new URL(startHref).origin;
  const candidates = uniqueHrefs([
    startHref,
    ...extraPathsForSite().map((p) => `${origin}${p}`),
  ]).slice(0, MAX_PAGES);

  const pages: ScrapedPage[] = [];
  for (const href of candidates) {
    const page = await fetchPublicPage(href, hostname);
    if (page) pages.push(page);
    if (pages.length >= MAX_PAGES) break;
  }

  if (pages.length === 0) {
    return { ok: false, pages: [], reason: 'unreachable' };
  }
  const hasText = pages.some((p) => p.text.length > 40);
  if (!hasText) {
    return { ok: false, pages, reason: 'empty' };
  }
  return { ok: true, pages };
}

async function fetchPublicPage(href: string, expectedHost: string): Promise<ScrapedPage | null> {
  let current = href;
  for (let hop = 0; hop < 4; hop++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (isBlockedHostname(host)) return null;
    if (hop === 0 && host !== expectedHost) return null;

    const resolved = await resolvePublicIps(host);
    if (!resolved.ok) return null;

    try {
      const res = await fetch(url.href, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.4',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        current = new URL(loc, url).href;
        continue;
      }
      if (!res.ok) return null;
      const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
      if (ctype && !/text\/html|application\/xhtml|text\/plain/.test(ctype)) return null;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_PAGE_BYTES) return null;
      const html = buf.toString('utf8');
      const title = extractTitle(html);
      const meta = extractMetaDescription(html);
      const body = htmlToText(html);
      const text = [title, meta, body].filter(Boolean).join('\n\n').slice(0, 20_000);
      return { url: url.href, title, text };
    } catch {
      return null;
    }
  }
  return null;
}

async function resolvePublicIps(hostname: string): Promise<{ ok: boolean }> {
  if (isBlockedIp(hostname)) return { ok: false };
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return { ok: false };
    for (const rec of records) {
      if (isBlockedIp(rec.address)) return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function uniqueHrefs(hrefs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of hrefs) {
    if (seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }
  return out;
}
