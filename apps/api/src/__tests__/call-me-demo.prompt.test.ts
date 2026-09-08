// ============================================================
// Homepage call-me product-demo prompt — feature coverage.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  buildCallMeDemoPrompt,
  CALL_ME_DEMO_FEATURE_MARKERS,
} from '../modules/voice-agent/call-me-demo.prompt.js';

describe('buildCallMeDemoPrompt', () => {
  it('covers every major product capability the sales demo must articulate', () => {
    const prompt = buildCallMeDemoPrompt({ timezone: 'America/New_York' });
    for (const marker of CALL_ME_DEMO_FEATURE_MARKERS) {
      expect(prompt, `missing feature marker: ${marker}`).toContain(marker);
    }
  });

  it('is a Telfin product demo, not a fake office, and forbids after-hours deflection', () => {
    const prompt = buildCallMeDemoPrompt();
    expect(prompt).toMatch(/Aria/);
    expect(prompt).toMatch(/telfin\.ai/i);
    expect(prompt).toMatch(/one-time product demo/i);
    expect(prompt).toMatch(/Never say you are closed/);
    expect(prompt).not.toMatch(/You are the AI receptionist for Bright Smile/i);
    expect(prompt).toMatch(/ONLY if they ask/i);
    expect(prompt).toMatch(/dental, legal \/ PI, real estate, insurance, home services/i);
  });

  it('defaults to English and greets in Spanish when language=es', () => {
    const en = buildCallMeDemoPrompt();
    expect(en).toMatch(/chose English/);
    expect(en).toContain("Hi, this is Aria with Telfin");

    const es = buildCallMeDemoPrompt({ language: 'es' });
    expect(es).toMatch(/Speak Spanish from the VERY FIRST word/);
    expect(es).toContain('Hola, soy Aria de Telfin');
    expect(es).not.toMatch(/chose English/);
  });

  it.each(['it', 'ar', 'fa', 'hy', 'ru'] as const)('includes a native greeting for %s', (lang) => {
    const prompt = buildCallMeDemoPrompt({ language: lang });
    expect(prompt).toMatch(/VERY FIRST word/);
    expect(prompt.length).toBeGreaterThan(400);
  });
});
