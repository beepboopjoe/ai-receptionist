// ============================================================
// Homepage call-me product-demo prompt — English AI-reveal open,
// no spelled URL, ≤2 minutes.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCallMeDemoPrompt,
  buildDemoOpeningEn,
  CALL_ME_DEMO_FEATURE_MARKERS,
  DEMO_AGENT_NAME,
  DEMO_OPENING_EN,
  resolveDemoAgentName,
} from '../modules/voice-agent/call-me-demo.prompt.js';
import { SOUND_HUMAN_MARKERS } from '../modules/voice-agent/sound-human.style.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../modules');

describe('buildCallMeDemoPrompt', () => {
  it('covers the closer track the sales demo must follow', () => {
    const prompt = buildCallMeDemoPrompt({ timezone: 'America/New_York' });
    for (const marker of CALL_ME_DEMO_FEATURE_MARKERS) {
      expect(prompt, `missing feature marker: ${marker}`).toContain(marker);
    }
  });

  it('opens as Telfin, not a fake office, and forbids after-hours deflection', () => {
    const prompt = buildCallMeDemoPrompt();
    expect(DEMO_AGENT_NAME).toBe('Telfin');
    expect(DEMO_OPENING_EN).toBe(
      'Hey, this is Telfin, your future agent representative. Umm, I know this might sound crazy and I may sound real, but umm, I\'m actually AI.',
    );
    expect(DEMO_OPENING_EN).not.toMatch(/receptionist/i);
    expect(DEMO_OPENING_EN).toMatch(/\bAI\b/);
    expect(prompt).toContain(DEMO_OPENING_EN);
    expect(prompt).toMatch(/future AI agent representative/);
    expect(prompt).toMatch(/one-time product demo/i);
    expect(prompt).toMatch(/Never say you are closed/);
    expect(prompt).toMatch(/2 minutes/);
    expect(prompt).toMatch(/Sound human/);
    expect(prompt).not.toMatch(/\bAria\b/);
    expect(prompt).not.toMatch(/You are the AI receptionist for Bright Smile/i);
    expect(prompt).toMatch(/ONLY if they ask/);
  });

  it('reveals AI in the English opener and never spells a URL or vendor brand', () => {
    const prompt = buildCallMeDemoPrompt({
      signupUrl: 'https://telfin.ai/signup?plan=trial',
    });
    expect(prompt).toMatch(/I'm actually AI/);
    expect(prompt).toMatch(/already said you are AI/);
    expect(prompt).toMatch(/Do not spell any URL/);
    expect(prompt).toMatch(/try it free on our site/);
    expect(prompt).not.toMatch(/https:\/\//);
    expect(prompt).not.toMatch(/telfin\.ai/i);
    expect(prompt).not.toMatch(/say it slowly/);
    expect(prompt).not.toMatch(/\bGrok\b/);
    expect(prompt).not.toMatch(/\bxAI\b/);
    expect(prompt).not.toMatch(/\bTelnyx\b/);
    expect(DEMO_OPENING_EN).not.toMatch(/receptionist/i);
  });

  it('uses the shared human-rhythm style (short turns, spoken um/uh, short pauses)', () => {
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
    expect(en).toContain(DEMO_OPENING_EN);

    const auto = buildCallMeDemoPrompt({ language: 'auto' });
    expect(auto).toMatch(/Detect the caller's language from their speech/);

    const es = buildCallMeDemoPrompt({ language: 'es' });
    expect(es).toMatch(/Speak Spanish \(es\) from the VERY FIRST word/);
    expect(es).toContain('representante de Telfin');
    expect(es).not.toMatch(/Detect the caller's language from their speech/);
  });

  it('interpolates a spoken name and falls back to Telfin', () => {
    expect(resolveDemoAgentName(undefined)).toBe('Telfin');
    expect(resolveDemoAgentName('')).toBe('Telfin');
    expect(resolveDemoAgentName('Our Office')).toBe('Telfin');
    expect(resolveDemoAgentName('Telfin Demo')).toBe('Telfin');
    expect(resolveDemoAgentName('Alex')).toBe('Alex');
    expect(buildDemoOpeningEn('Alex')).toBe(
      'Hey, this is Alex, your future agent representative. Umm, I know this might sound crazy and I may sound real, but umm, I\'m actually AI.',
    );
    const named = buildCallMeDemoPrompt({ agentName: 'Alex' });
    expect(named).toContain(buildDemoOpeningEn('Alex'));
    expect(named).not.toContain(DEMO_OPENING_EN);
  });

  it('does not flip DEMO_SKIP_COOLDOWN', () => {
    const src = readFileSync(join(srcRoot, 'voice-agent/call-me-demo.prompt.ts'), 'utf8');
    expect(src).not.toMatch(/DEMO_SKIP_COOLDOWN/);
  });

  it.each(['it', 'ar', 'fa', 'hy', 'ru'] as const)('includes a native greeting for %s', (lang) => {
    const prompt = buildCallMeDemoPrompt({ language: lang });
    expect(prompt).toMatch(/VERY FIRST word/);
    expect(prompt.length).toBeGreaterThan(400);
  });
});
