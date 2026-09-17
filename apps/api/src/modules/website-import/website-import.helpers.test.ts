import { describe, it, expect } from 'vitest';
import {
  BUSINESS_CONTEXT_MAX,
  extraPathsForSite,
  factsHaveContent,
  formatFactsAsContext,
  hasWebsiteImportBlock,
  heuristicExtract,
  htmlToText,
  isBlockedHostname,
  isBlockedIp,
  mergeWebsiteImportBlock,
  normalizeWebsiteUrl,
  officeHoursAreEmpty,
  parseManualFacts,
  parseOfficeHoursFromText,
  parseFactsJson,
  WEBSITE_IMPORT_OPEN,
} from './website-import.helpers.js';

describe('normalizeWebsiteUrl', () => {
  it('adds https and accepts a bare domain', () => {
    const n = normalizeWebsiteUrl('acmeplumbing.com');
    expect(n.ok).toBe(true);
    if (n.ok) {
      expect(n.href).toBe('https://acmeplumbing.com/');
      expect(n.hostname).toBe('acmeplumbing.com');
    }
  });

  it('rejects private hosts, credentials, and non-http schemes', () => {
    expect(normalizeWebsiteUrl('').ok).toBe(false);
    expect(normalizeWebsiteUrl('ftp://example.com').ok).toBe(false);
    expect(normalizeWebsiteUrl('http://localhost/admin').ok).toBe(false);
    expect(normalizeWebsiteUrl('https://127.0.0.1/').ok).toBe(false);
    expect(normalizeWebsiteUrl('https://192.168.1.9/').ok).toBe(false);
    expect(normalizeWebsiteUrl('https://user:pass@example.com/').ok).toBe(false);
    expect(normalizeWebsiteUrl('not a url!!!').ok).toBe(false);
  });
});

describe('SSRF host / IP blocks', () => {
  it('blocks loopback, link-local, RFC1918, and metadata', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('metadata.google.internal')).toBe(true);
    expect(isBlockedHostname('foo.local')).toBe(true);
    expect(isBlockedIp('10.0.0.2')).toBe(true);
    expect(isBlockedIp('172.16.0.5')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedHostname('example.com')).toBe(false);
  });
});

describe('htmlToText + heuristicExtract', () => {
  const html = `
    <html><head>
      <title>Riverside Pets | Home</title>
      <meta name="description" content="Neighborhood pet care in Austin.">
      <script>alert('x')</script>
    </head><body>
      <h1>Riverside Pets</h1>
      <p>We are a neighborhood pet salon in Austin, Texas.</p>
      <h2>Services</h2>
      <ul><li>Bath and brush</li><li>Nail trim</li><li>Daycare</li></ul>
      <p>Hours: Mon–Fri 9am–5pm</p>
      <p>Visit us at 123 Main Street, Austin, TX 78701</p>
      <p>Q: Do I need an appointment?</p>
      <p>A: Walk-ins are welcome on weekdays before 4pm.</p>
    </body></html>
  `;

  it('strips scripts and keeps readable text', () => {
    const text = htmlToText(html);
    expect(text).toContain('Bath and brush');
    expect(text).not.toContain('alert');
  });

  it('pulls services, hours, location, and FAQs from a typical small-business page', () => {
    const facts = heuristicExtract(
      [{ url: 'https://riverside.example/', title: 'Riverside Pets | Home', text: htmlToText(html) }],
      'https://riverside.example/',
    );
    expect(facts.businessName).toMatch(/Riverside Pets/i);
    expect(facts.services.toLowerCase()).toMatch(/bath|daycare|nail/);
    expect(facts.hours.toLowerCase()).toMatch(/mon/);
    expect(facts.location).toMatch(/Austin/);
    expect(facts.faqs).toMatch(/appointment/i);
    expect(factsHaveContent(facts)).toBe(true);
  });
});

describe('business_context merge', () => {
  it('wraps facts in website-import anchors and preserves owner prose', () => {
    const merged = mergeWebsiteImportBlock('Keep my custom note.', {
      businessName: 'Acme',
      services: '- Plumbing\n- Drain cleaning',
      hours: 'Mon-Fri 8-5',
      location: 'Dallas, TX',
      faqs: '',
      notes: '',
      sourceUrl: 'https://acme.example/',
    });
    expect(merged).toContain(WEBSITE_IMPORT_OPEN);
    expect(merged).toContain('Keep my custom note.');
    expect(merged).toContain('Plumbing');
    expect(hasWebsiteImportBlock(merged)).toBe(true);
    expect(merged.length).toBeLessThanOrEqual(BUSINESS_CONTEXT_MAX);
  });

  it('replaces a previous import block on re-run', () => {
    const first = mergeWebsiteImportBlock('', {
      businessName: 'Old',
      services: '- A',
      hours: '',
      location: '',
      faqs: '',
      notes: '',
      sourceUrl: 'https://old.example/',
    });
    const second = mergeWebsiteImportBlock(first, {
      businessName: 'New',
      services: '- B',
      hours: '',
      location: '',
      faqs: '',
      notes: '',
      sourceUrl: 'https://new.example/',
    });
    expect(second).toContain('New');
    expect(second).not.toContain('Old');
    expect(second.match(/website-import-v1/g)?.length).toBe(2);
  });

  it('caps the merged string at 4000 characters', () => {
    const huge = mergeWebsiteImportBlock('x'.repeat(3500), {
      businessName: 'Huge',
      services: 'S'.repeat(2000),
      hours: 'H'.repeat(400),
      location: 'L'.repeat(200),
      faqs: 'F'.repeat(800),
      notes: 'N'.repeat(800),
      sourceUrl: 'https://huge.example/',
    });
    expect(huge.length).toBeLessThanOrEqual(BUSINESS_CONTEXT_MAX);
  });
});

describe('manual facts + hours parse', () => {
  it('accepts typed facts and skips empty payloads', () => {
    expect(factsHaveContent(parseManualFacts({}))).toBe(false);
    const facts = parseManualFacts({ services: 'Haircuts', hours: 'Mon-Fri 9am-5pm' });
    expect(facts.services).toBe('Haircuts');
    expect(factsHaveContent(facts)).toBe(true);
  });

  it('parses a weekday window into OfficeHours', () => {
    const hours = parseOfficeHoursFromText('Monday–Friday 9am–5pm');
    expect(hours?.mon).toEqual({ open: '09:00', close: '17:00' });
    expect(hours?.fri).toEqual({ open: '09:00', close: '17:00' });
    expect(hours?.sat).toBeUndefined();
    expect(parseOfficeHoursFromText('whenever')).toBeNull();
  });

  it('treats empty and holiday-only blobs as empty hours', () => {
    expect(officeHoursAreEmpty({})).toBe(true);
    expect(officeHoursAreEmpty({ holidays: ['2026-12-25'] })).toBe(true);
    expect(officeHoursAreEmpty({ mon: { open: '09:00', close: '17:00' } })).toBe(false);
  });
});

describe('LLM JSON parse + extra paths', () => {
  it('reads fenced JSON and ignores junk', () => {
    const facts = parseFactsJson(
      '```json\n{"businessName":"Oak Cafe","services":"Coffee","hours":"","location":"","faqs":"","notes":""}\n```',
      'https://oak.example/',
    );
    expect(facts?.businessName).toBe('Oak Cafe');
    expect(parseFactsJson('not json', 'https://x.test')).toBeNull();
  });

  it('tries a short list of obvious subpages', () => {
    expect(extraPathsForSite()).toContain('/about');
    expect(extraPathsForSite()).toContain('/hours');
    expect(formatFactsAsContext({
      businessName: 'Oak',
      services: 'Coffee',
      hours: '',
      location: '',
      faqs: '',
      notes: '',
      sourceUrl: '',
    })).toContain('## Services');
  });
});
