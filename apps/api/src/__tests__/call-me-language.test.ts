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
  callMeAutoDetectPromptBlock,
  isAutoCallMeLanguage,
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

  it('English sample opening is the closer AI-reveal line', async () => {
    const { DEMO_CLOSER_OPENING_EN } = await import('../modules/voice-agent/call-me-demo.prompt.js');
    expect(CALL_ME_LANG_GREETING.en).toBe(DEMO_CLOSER_OPENING_EN);
  });
});

describe('call-me auto-detect', () => {
  it('treats missing / empty / auto as detect-on-call', () => {
    expect(isAutoCallMeLanguage(undefined)).toBe(true);
    expect(isAutoCallMeLanguage(null)).toBe(true);
    expect(isAutoCallMeLanguage('')).toBe(true);
    expect(isAutoCallMeLanguage('auto')).toBe(true);
    expect(isAutoCallMeLanguage('en')).toBe(false);
    expect(isAutoCallMeLanguage('es')).toBe(false);
  });

  it('auto-detect block opens in English and does not claim a form pick', () => {
    const block = callMeAutoDetectPromptBlock();
    expect(block).toMatch(/Detect the caller's language from their speech/);
    expect(block).toContain(CALL_ME_LANG_GREETING.en);
    expect(block).not.toMatch(/chose English/);
    expect(block).not.toMatch(/call-me form/);
  });
});

describe('call-me language is wired through the public dial path', () => {
  it('POST /public/call-me dials demo without a pre-selected language', () => {
    const src = readFileSync(join(srcRoot, 'public-api/public-demo.router.ts'), 'utf8');
    expect(src).toContain('normalizeCallMeLanguage');
    expect(src).toMatch(/mode:\s*'demo'/);
    expect(src).toMatch(/language:\s*'auto'/);
    expect(src).not.toMatch(/language,\s*\n\s*voice/);
  });
});
