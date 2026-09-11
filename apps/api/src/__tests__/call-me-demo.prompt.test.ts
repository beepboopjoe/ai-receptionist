// ============================================================
// Homepage call-me product-demo prompt — representative open,
// late AI reveal, no spelled URL, ≤2 minutes.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  buildCallMeDemoPrompt,
  CALL_ME_DEMO_FEATURE_MARKERS,
  DEMO_AGENT_NAME,
  DEMO_OPENING_EN,
} from '../modules/voice-agent/call-me-demo.prompt.js';
import { SOUND_HUMAN_MARKERS } from '../modules/voice-agent/sound-human.style.js';

describe('buildCallMeDemoPrompt', () => {
  it('covers the closer track the sales demo must follow', () => {
    const prompt = buildCallMeDemoPrompt({ timezone: 'America/New_York' });
    for (const marker of CALL_ME_DEMO_FEATURE_MARKERS) {
      expect(prompt, `missing feature marker: ${marker}`).toContain(marker);
    }
  });

  it('opens as a Telfin representative, not a fake office, and forbids after-hours deflection', () => {
    const prompt = buildCallMeDemoPrompt();
    expect(DEMO_AGENT_NAME).toBe('Telfin');
    expect(DEMO_OPENING_EN).toMatch(/representative of Telfin/i);
    expect(DEMO_OPENING_EN).not.toMatch(/receptionist/i);
    expect(DEMO_OPENING_EN).not.toMatch(/\bAI\b/i);
    expect(prompt).toContain(DEMO_OPENING_EN);
    expect(prompt).toMatch(/representative of Telfin/);
    expect(prompt).toMatch(/one-time product demo/i);
    expect(prompt).toMatch(/Never say you are closed/);
    expect(prompt).toMatch(/2 minutes/);
    expect(prompt).toMatch(/Sound human/);
    expect(prompt).not.toMatch(/\bAria\b/);
    expect(prompt).not.toMatch(/You are the AI receptionist for Bright Smile/i);
    expect(prompt).toMatch(/ONLY if they ask/);
  });

  it('does not reveal AI in the opening and never spells a URL', () => {
    const prompt = buildCallMeDemoPrompt({
      signupUrl: 'https://telfin.ai/signup?plan=trial',
    });
    expect(prompt).toMatch(/Do NOT say you are AI/);
    expect(prompt).toMatch(/near the end only/i);
    expect(prompt).toMatch(/Do not spell any URL/);
    expect(prompt).toMatch(/try it free on our site/);
    expect(prompt).not.toMatch(/https:\/\//);
    expect(prompt).not.toMatch(/telfin\.ai/i);
    expect(prompt).not.toMatch(/say it slowly/);
    expect(prompt).not.toMatch(/sound really realistic/);
    expect(prompt).not.toMatch(/I'm actually an AI/);
    expect(DEMO_OPENING_EN).not.toMatch(/receptionist/i);
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
    expect(en).toContain('representative of Telfin');

    const auto = buildCallMeDemoPrompt({ language: 'auto' });
    expect(auto).toMatch(/Detect the caller's language from their speech/);

    const es = buildCallMeDemoPrompt({ language: 'es' });
    expect(es).toMatch(/Speak Spanish \(es\) from the VERY FIRST word/);
    expect(es).toContain('representante de Telfin');
    expect(es).not.toMatch(/Detect the caller's language from their speech/);
  });

  it.each(['it', 'ar', 'fa', 'hy', 'ru'] as const)('includes a native greeting for %s', (lang) => {
    const prompt = buildCallMeDemoPrompt({ language: lang });
    expect(prompt).toMatch(/VERY FIRST word/);
    expect(prompt.length).toBeGreaterThan(400);
  });
});
