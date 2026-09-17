// ============================================================
// Website → knowledge helpers (pure, no fetch / DB).
//
// Paste-URL go-live writes a round-trippable block into
// tenant_settings.business_context — the same field the voice
// agent already reads. Business-plan tenants may also get a
// Knowledge Base text doc; this module stays plan-agnostic.
// ============================================================
import type { OfficeHours, DayHours } from '@ai-receptionist/shared';

export const WEBSITE_IMPORT_OPEN = '<!-- website-import-v1 -->';
export const WEBSITE_IMPORT_CLOSE = '<!-- /website-import-v1 -->';
const BLOCK_RE = /<!--\s*website-import-v1\s*-->[\s\S]*?<!--\s*\/website-import-v1\s*-->/;

export const BUSINESS_CONTEXT_MAX = 4000;
export const MAX_PAGE_BYTES = 500_000;
export const MAX_PAGES = 5;
export const SCRAPE_TIMEOUT_MS = 8_000;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.internal',
]);

export interface WebsiteFacts {
  businessName: string;
  services: string;
  hours: string;
  location: string;
  faqs: string;
  notes: string;
  sourceUrl: string;
}

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
}

export type UrlNormalize =
  | { ok: true; href: string; hostname: string }
  | { ok: false; message: string };

export function normalizeWebsiteUrl(raw: unknown): UrlNormalize {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Paste a website address, like yourbusiness.com.' };
  }
  let input = raw.trim();
  if (!input) {
    return { ok: false, message: 'Paste a website address, like yourbusiness.com.' };
  }
  if (input.length > 500) {
    return { ok: false, message: 'That address is too long.' };
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
    input = `https://${input}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, message: 'That does not look like a website address.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'Use an http or https website address.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'That address cannot include a login.' };
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || isBlockedHostname(hostname)) {
    return { ok: false, message: 'That address cannot be imported.' };
  }
  parsed.hash = '';
  return { ok: true, href: parsed.href, hostname };
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return true;
  }
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  return isBlockedIp(host);
}

export function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    return isBlockedIp(lower.slice('::ffff:'.length));
  }
  return false;
}

export function extraPathsForSite(): string[] {
  return ['/about', '/contact', '/hours', '/faq', '/services'];
}

export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withBreaks = withoutNoise
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br|header|footer)>/gi, '\n')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ');
  const stripped = withBreaks.replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function extractTitle(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
  const raw = decodeEntities((title || h1).replace(/<[^>]+>/g, ' ')).trim();
  return raw.replace(/\s+/g, ' ').slice(0, 120);
}

export function extractMetaDescription(html: string): string {
  const m =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return decodeEntities(m?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

export function emptyFacts(sourceUrl = ''): WebsiteFacts {
  return {
    businessName: '',
    services: '',
    hours: '',
    location: '',
    faqs: '',
    notes: '',
    sourceUrl,
  };
}

export function heuristicExtract(pages: ScrapedPage[], sourceUrl: string): WebsiteFacts {
  const facts = emptyFacts(sourceUrl);
  const home = pages[0];
  facts.businessName = cleanBusinessName(home?.title ?? '');
  const blob = pages.map((p) => p.text).join('\n\n');
  const homeHtmlNotes = home?.text ? firstParagraphs(home.text, 3) : '';
  facts.notes = homeHtmlNotes;
  facts.services = pickSection(blob, /(?:our\s+)?services|what we (?:do|offer)|treatments|menu/i, 8);
  facts.hours = pickHours(blob);
  facts.location = pickLocation(blob);
  facts.faqs = pickFaqs(blob);
  if (!facts.services) {
    facts.services = bulletLines(blob).slice(0, 8).join('\n');
  }
  return facts;
}

export function factsHaveContent(facts: WebsiteFacts): boolean {
  return Boolean(
    facts.services.trim() ||
      facts.hours.trim() ||
      facts.location.trim() ||
      facts.faqs.trim() ||
      facts.notes.trim() ||
      facts.businessName.trim(),
  );
}

export function formatFactsAsContext(facts: WebsiteFacts): string {
  const sections: string[] = [];
  if (facts.businessName.trim()) sections.push(`## Business\n${facts.businessName.trim()}`);
  if (facts.services.trim()) sections.push(`## Services\n${facts.services.trim()}`);
  if (facts.hours.trim()) sections.push(`## Hours\n${facts.hours.trim()}`);
  if (facts.location.trim()) sections.push(`## Location\n${facts.location.trim()}`);
  if (facts.faqs.trim()) sections.push(`## FAQs\n${facts.faqs.trim()}`);
  if (facts.notes.trim()) sections.push(`## About\n${facts.notes.trim()}`);
  if (facts.sourceUrl.trim()) sections.push(`Source: ${facts.sourceUrl.trim()}`);
  return sections.join('\n\n');
}

export function mergeWebsiteImportBlock(
  existing: string,
  facts: WebsiteFacts,
  maxLen = BUSINESS_CONTEXT_MAX,
): string {
  const inner = formatFactsAsContext(facts).trim();
  if (!inner) {
    return existing.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  let block = `${WEBSITE_IMPORT_OPEN}\n${inner}\n${WEBSITE_IMPORT_CLOSE}`;
  const outside = existing.replace(BLOCK_RE, '').trim();
  let merged = outside ? `${block}\n\n${outside}` : block;
  if (merged.length <= maxLen) return merged;

  const room = Math.max(200, maxLen - outside.length - WEBSITE_IMPORT_OPEN.length - WEBSITE_IMPORT_CLOSE.length - 8);
  const clipped = inner.slice(0, room).trim();
  block = `${WEBSITE_IMPORT_OPEN}\n${clipped}\n${WEBSITE_IMPORT_CLOSE}`;
  merged = outside ? `${block}\n\n${outside}` : block;
  return merged.slice(0, maxLen);
}

export function hasWebsiteImportBlock(existing: string | null | undefined): boolean {
  return BLOCK_RE.test(existing ?? '');
}

export function parseFactsJson(raw: string, sourceUrl: string): WebsiteFacts | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const rec = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const str = (key: string, max: number) =>
      typeof rec[key] === 'string' ? rec[key].trim().slice(0, max) : '';
    const facts = emptyFacts(sourceUrl);
    facts.businessName = str('businessName', 80);
    facts.services = str('services', 2000);
    facts.hours = str('hours', 800);
    facts.location = str('location', 400);
    facts.faqs = str('faqs', 2000);
    facts.notes = str('notes', 1500);
    return facts;
  } catch {
    return null;
  }
}

export function parseManualFacts(body: unknown, sourceUrl = ''): WebsiteFacts {
  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const str = (key: string) =>
    typeof rec[key] === 'string' ? rec[key].replace(/\s+/g, ' ').trim().slice(0, 1500) : '';
  return {
    businessName: str('businessName'),
    services: typeof rec.services === 'string' ? rec.services.trim().slice(0, 2000) : '',
    hours: typeof rec.hours === 'string' ? rec.hours.trim().slice(0, 800) : '',
    location: typeof rec.location === 'string' ? rec.location.trim().slice(0, 400) : '',
    faqs: typeof rec.faqs === 'string' ? rec.faqs.trim().slice(0, 2000) : '',
    notes: typeof rec.notes === 'string' ? rec.notes.trim().slice(0, 1500) : '',
    sourceUrl,
  };
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_ALIASES: Record<string, (typeof DAY_KEYS)[number]> = {
  monday: 'mon',
  mon: 'mon',
  tuesday: 'tue',
  tue: 'tue',
  tues: 'tue',
  wednesday: 'wed',
  wed: 'wed',
  thursday: 'thu',
  thu: 'thu',
  thurs: 'thu',
  friday: 'fri',
  fri: 'fri',
  saturday: 'sat',
  sat: 'sat',
  sunday: 'sun',
  sun: 'sun',
};

/** Best-effort "Mon–Fri 9am–5pm" → OfficeHours. Null when we cannot parse a weekday window. */
export function parseOfficeHoursFromText(raw: string): OfficeHours | null {
  const text = raw.toLowerCase();
  const range = text.match(
    /(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?)\s*[-–to]+\s*(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)/i,
  );
  const times = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!times) return null;
  const open = to24h(times[1], times[2], times[3] ?? times[6]);
  const close = to24h(times[4], times[5], times[6] ?? times[3]);
  if (!open || !close) return null;

  const startKey = range ? DAY_ALIASES[range[1]!.toLowerCase()] : 'mon';
  const endKey = range ? DAY_ALIASES[range[2]!.toLowerCase()] : 'fri';
  if (!startKey || !endKey) return null;
  const startIdx = DAY_KEYS.indexOf(startKey);
  const endIdx = DAY_KEYS.indexOf(endKey);
  if (startIdx < 0 || endIdx < startIdx) return null;

  const hours: OfficeHours = {};
  const window: DayHours = { open, close };
  for (let i = startIdx; i <= endIdx; i++) {
    hours[DAY_KEYS[i]!] = window;
  }
  return hours;
}

export function officeHoursAreEmpty(hours: unknown): boolean {
  if (!hours || typeof hours !== 'object') return true;
  return !Object.entries(hours as Record<string, unknown>).some(([key, value]) => {
    if (key === 'holidays') return false;
    if (!value || typeof value !== 'object') return false;
    const day = value as Record<string, unknown>;
    return Boolean(day.open && day.close);
  });
}

function to24h(hourRaw: string | undefined, minRaw: string | undefined, ampm?: string): string | null {
  if (!hourRaw) return null;
  let hour = Number(hourRaw);
  const min = minRaw ? Number(minRaw) : 0;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || min < 0 || min > 59) return null;
  const mer = (ampm ?? '').toLowerCase();
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 31 ? String.fromCharCode(code) : ' ';
    });
}

function cleanBusinessName(title: string): string {
  return title
    .split(/\s+[|\-–—]\s+/)[0]
    ?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) ?? '';
}

function firstParagraphs(text: string, n: number): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40)
    .slice(0, n)
    .join('\n\n')
    .slice(0, 800);
}

function pickSection(blob: string, heading: RegExp, maxLines: number): string {
  const lines = blob.split('\n').map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => heading.test(l) && l.length < 80);
  if (idx < 0) return '';
  const picked: string[] = [];
  for (let i = idx + 1; i < lines.length && picked.length < maxLines; i++) {
    const line = lines[i]!;
    if (/^[A-Z][A-Za-z ]{2,40}$/.test(line) && picked.length > 0) break;
    if (line.length < 3) continue;
    picked.push(line.startsWith('-') ? line : `- ${line}`);
  }
  return picked.join('\n').slice(0, 1200);
}

function pickHours(blob: string): string {
  const lines = blob.split('\n').map((l) => l.trim());
  const hits = lines.filter((l) =>
    /\b(?:hours|open|closes?)\b/i.test(l) &&
    /\d/.test(l) &&
    /(am|pm|–|-|:)/i.test(l) &&
    l.length < 160,
  );
  if (hits.length) return hits.slice(0, 8).join('\n').slice(0, 600);
  const weekday = lines.filter((l) =>
    /\b(mon|tue|wed|thu|fri|sat|sun)/i.test(l) && /\d{1,2}/.test(l) && l.length < 120,
  );
  return weekday.slice(0, 8).join('\n').slice(0, 600);
}

function pickLocation(blob: string): string {
  const zip = blob.match(
    /[A-Z][A-Za-z0-9.,' ]{8,60}\b(?:AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV)\b\.?\s+\d{5}(?:-\d{4})?/,
  );
  if (zip) return zip[0].replace(/\s+/g, ' ').trim();
  const street = blob.match(
    /\d{1,6}\s+[A-Za-z0-9.' ]{3,40}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court)\b[^\n]{0,80}/i,
  );
  return street ? street[0].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

function pickFaqs(blob: string): string {
  const blocks: string[] = [];
  const qRe = /(?:^|\n)\s*(?:Q[:.]?\s+|[-*]\s+)?(.{8,140}\?)\s*(?:\n\s*)+(?:A[:.]?\s+)?(.{12,400})/gi;
  let m: RegExpExecArray | null;
  while ((m = qRe.exec(blob)) && blocks.length < 6) {
    const q = m[1]!.replace(/\s+/g, ' ').trim();
    const a = m[2]!.replace(/\s+/g, ' ').trim();
    if (q.length < 8 || a.length < 12) continue;
    blocks.push(`Q: ${q}\nA: ${a.slice(0, 280)}`);
  }
  return blocks.join('\n\n').slice(0, 1500);
}

function bulletLines(blob: string): string[] {
  return blob
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*•]/.test(l) && l.length > 4 && l.length < 140)
    .map((l) => l.replace(/^[-*•]\s*/, '- '));
}
