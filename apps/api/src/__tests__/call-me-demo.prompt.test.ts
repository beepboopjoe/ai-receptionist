// ============================================================
// Homepage call-me product-demo prompt — Telfin closer, ≤2 minutes.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  buildCallMeDemoPrompt,
  CALL_ME_DEMO_FEATURE_MARKERS,
  DEMO_AGENT_NAME,
} from '../modules/voice-agent/call-me-demo.prompt.js';

describe('buildCallMeDemoPrompt', () => {
  it('covers the closer track the sales demo must follow', () => {
    const prompt = buildCallMeDemoPrompt({ timezone: 'America/New_York' });
    for (const marker of CALL_ME_DEMO_FEATURE_MARKERS) {
      expect(prompt, `missing feature marker: ${marker}`).toContain(marker);
    }
  });

  it('is Telfin (not Aria), not a fake office, and forbids after-hours deflection', () => {
    const prompt = buildCallMeDemoPrompt();
    expect(DEMO_AGENT_NAME).toBe('Telfin');
    expect(prompt).toMatch(/You are Telfin/);
    expect(prompt).toMatch(/telfin\.ai/i);
    expect(prompt).toMatch(/one-time product demo/i);
    expect(prompt).toMatch(/Never say you are closed/);
    expect(prompt).toMatch(/2 minutes/);
    expect(prompt).not.toMatch(/\bAria\b/);
    expect(prompt).not.toMatch(/You are the AI receptionist for Bright Smile/i);
    expect(prompt).toMatch(/ONLY if they ask/);
  });

  it('defaults to English and greets in Spanish when language=es', () => {
    const en = buildCallMeDemoPrompt();
    expect(en).toMatch(/chose English/);
    expect(en).toContain('Hey, this is Telfin');

    const es = buildCallMeDemoPrompt({ language: 'es' });
    expect(es).toMatch(/Speak Spanish from the VERY FIRST word/);
    expect(es).toContain('Hola, soy Telfin');
    expect(es).not.toMatch(/chose English/);
  });

  it.each(['it', 'ar', 'fa', 'hy', 'ru'] as const)('includes a native greeting for %s', (lang) => {
    const prompt = buildCallMeDemoPrompt({ language: lang });
    expect(prompt).toMatch(/VERY FIRST word/);
    expect(prompt.length).toBeGreaterThan(400);
  });
});
