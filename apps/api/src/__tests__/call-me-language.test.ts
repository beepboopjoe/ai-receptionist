// ============================================================
// Call-me spoken-language catalog + coercion.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALL_ME_LANG_CODES,
  CALL_ME_LANG_GREETING,
  DEFAULT_CALL_ME_LANG,
  normalizeCallMeLanguage,
} from '../modules/voice-agent/call-me-language.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../modules');

describe('normalizeCallMeLanguage', () => {
  it('defaults missing / junk values to English', () => {
    expect(normalizeCallMeLanguage(undefined)).toBe(DEFAULT_CALL_ME_LANG);
    expect(normalizeCallMeLanguage(null)).toBe('en');
    expect(normalizeCallMeLanguage('')).toBe('en');
    expect(normalizeCallMeLanguage('zz')).toBe('en');
    expect(normalizeCallMeLanguage(12)).toBe('en');
  });

  it.each(CALL_ME_LANG_CODES)('accepts ISO code %s', (code) => {
    expect(normalizeCallMeLanguage(code)).toBe(code);
    expect(normalizeCallMeLanguage(code.toUpperCase())).toBe(code);
  });

  it('accepts common aliases', () => {
    expect(normalizeCallMeLanguage('Spanish')).toBe('es');
    expect(normalizeCallMeLanguage('persian')).toBe('fa');
    expect(normalizeCallMeLanguage('italiano')).toBe('it');
  });

  it('has a native greeting for every product language', () => {
    expect(CALL_ME_LANG_CODES).toEqual(['en', 'es', 'it', 'ar', 'fa', 'hy', 'ru']);
    for (const code of CALL_ME_LANG_CODES) {
      expect(CALL_ME_LANG_GREETING[code].length).toBeGreaterThan(20);
    }
  });
});

describe('call-me language is wired through the public dial path', () => {
  it('POST /public/call-me normalizes language and passes it to dialDirect', () => {
    const src = readFileSync(join(srcRoot, 'public-api/public-demo.router.ts'), 'utf8');
    expect(src).toContain('normalizeCallMeLanguage');
    expect(src).toContain('language,');
    expect(src).toMatch(/mode:\s*'demo'/);
  });
});
