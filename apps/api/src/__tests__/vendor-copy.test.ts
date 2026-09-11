// ============================================================
// Tenant-facing copy must not name Grok / Telnyx / xAI.
// Source scan of dashboard UI + the marketing FAQ prompt.
// Legal subprocessors stay named (required disclosure).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IntegrationError } from '../lib/errors.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

const VENDOR_RE = /\b(Grok|Telnyx|xAI)\b/;
const ALLOWLIST = new Set([
  'app/legal/subprocessors/page.tsx',
]);

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Quoted strings + JSX text — the bits browsers can render. */
function extractCopy(src: string): string[] {
  const stripped = stripComments(src);
  const quoted = [...stripped.matchAll(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g)].map((m) => m[0]);
  const jsxText = [...stripped.matchAll(/>([^<>{]+)</g)].map((m) => m[1]);
  return [...quoted, ...jsxText];
}

describe('no vendor names in tenant-facing copy', () => {
  it('brand stack line is Telfin-neutral', () => {
    const brand = readFileSync(join(dashboardRoot, 'lib/brand.ts'), 'utf8');
    expect(brand).toContain("BRAND_STACK_LINE = 'Natural AI voice · Reliable calling'");
    expect(extractCopy(brand).join('\n')).not.toMatch(VENDOR_RE);
  });

  it('dashboard UI copy does not render Grok, Telnyx, or xAI', () => {
    const hits: string[] = [];
    for (const file of walkTsFiles(dashboardRoot)) {
      const rel = file.slice(dashboardRoot.length + 1).replace(/\\/g, '/');
      if (ALLOWLIST.has(rel)) continue;
      const copy = extractCopy(readFileSync(file, 'utf8'));
      for (const piece of copy) {
        if (VENDOR_RE.test(piece)) hits.push(`${rel}: ${piece.trim().slice(0, 120)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('marketing FAQ prompt never names vendors', () => {
    const prompt = readFileSync(join(srcRoot, 'modules/public-api/site-chat.prompt.ts'), 'utf8');
    expect(extractCopy(prompt).join('\n')).not.toMatch(VENDOR_RE);
    expect(prompt).toContain('Never name infrastructure vendors');
  });

  it('tenant-facing phone errors stay vendor-neutral', () => {
    const phones = readFileSync(join(srcRoot, 'modules/phone-numbers/phone.router.ts'), 'utf8');
    expect(phones).toContain("error: 'phone_not_configured'");
    expect(phones).toContain('Phone ordering is not configured');
    expect(phones).not.toContain('Telnyx not configured');

    const admin = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    expect(admin).toContain("'Number order failed'");
    expect(admin).not.toContain('Telnyx number order failed');

    expect(new IntegrationError('telnyx', 'dial failed').message).toBe(
      'Integration error [carrier]: dial failed',
    );
    expect(new IntegrationError('grok', 'session failed').message).toBe(
      'Integration error [voice]: session failed',
    );
  });
});
