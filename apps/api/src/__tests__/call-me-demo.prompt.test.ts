// ============================================================
// Homepage call-me product-demo prompt — Closer path, ≤2 minutes.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  buildCallMeDemoPrompt,
  CALL_ME_DEMO_FEATURE_MARKERS,
  DEMO_AGENT_NAME,
  DEMO_CLOSER_OPENING_EN,
} from '../modules/voice-agent/call-me-demo.prompt.js';
import { SOUND_HUMAN_MARKERS } from '../modules/voice-agent/sound-human.style.js';

describe('buildCallMeDemoPrompt', () => {
  it('covers the closer track the sales demo must follow', () => {
    const prompt = buildCallMeDemoPrompt({ timezone: 'America/New_York' });
    for (const marker of CALL_ME_DEMO_FEATURE_MARKERS) {
      expect(prompt, `missing feature marker: ${marker}`).toContain(marker);
    }
  });

  it('is an assistant from Telfin (not Aria), not a fake office, and forbids after-hours deflection', () => {
    const prompt = buildCallMeDemoPrompt();
    expect(DEMO_AGENT_NAME).toBe('Telfin');
    expect(prompt).toMatch(/assistant from Telfin/);
    expect(prompt).toContain(DEMO_CLOSER_OPENING_EN);
    expect(prompt).toMatch(/telfin\.ai/i);
    expect(prompt).toMatch(/one-time product demo/i);
    expect(prompt).toMatch(/Never say you are closed/);
    expect(prompt).toMatch(/2 minutes/);
    expect(prompt).toMatch(/Sound human/);
    expect(prompt).not.toMatch(/\bAria\b/);
    expect(prompt).not.toMatch(/You are the AI receptionist for Bright Smile/i);
    expect(prompt).toMatch(/ONLY if they ask/);
  });

  it('uses the shared human-rhythm style (short turns, sparse fillers)', () => {
    const prompt = buildCallMeDemoPrompt();
    for (const marker of SOUND_HUMAN_MARKERS) {
      expect(prompt, `missing human-rhythm marker: ${marker}`).toContain(marker);
    }
  });

  it('defaults to on-call language detection with an English fallback open', () => {
    const en = buildCallMeDemoPrompt();
    expect(en).toMatch(/Detect the caller's language from their speech/);
    expect(en).toMatch(/Open in English as the safe fallback/);
    expect(en).not.toMatch(/chose English/);
    expect(en).not.toMatch(/call-me form BEFORE we dialed/);
    expect(en).toContain('assistant from Telfin');
    expect(en).toContain('sound really realistic');

    const auto = buildCallMeDemoPrompt({ language: 'auto' });
    expect(auto).toMatch(/Detect the caller's language from their speech/);

    const es = buildCallMeDemoPrompt({ language: 'es' });
    expect(es).toMatch(/Speak Spanish \(es\) from the VERY FIRST word/);
    expect(es).toContain('asistente de Telfin');
    expect(es).not.toMatch(/Detect the caller's language from their speech/);
  });

  it.each(['it', 'ar', 'fa', 'hy', 'ru'] as const)('includes a native greeting for %s', (lang) => {
    const prompt = buildCallMeDemoPrompt({ language: lang });
    expect(prompt).toMatch(/VERY FIRST word/);
    expect(prompt.length).toBeGreaterThan(400);
  });
});
