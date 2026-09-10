// ============================================================
// Smoke tests for the vertical-aware prompt builder.
// We don't assert exact text — these tests catch regressions
// where a vertical stops referencing its business noun, drops
// its escalation vocab, or fails to render entirely.
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, VERTICAL_ESCALATION_VOCAB } from '../modules/voice-agent/prompt-builder.js';
import { SOUND_HUMAN_MARKERS } from '../modules/voice-agent/sound-human.style.js';
import { VERTICAL_VALUES, type Vertical } from '@ai-receptionist/shared';

const BASE_CTX = {
  practiceName: 'Test Tenant',
  timezone: 'America/New_York',
  officeHours: {
    monday:    { open: true, start: '09:00', end: '17:00' },
    tuesday:   { open: true, start: '09:00', end: '17:00' },
    wednesday: { open: true, start: '09:00', end: '17:00' },
    thursday:  { open: true, start: '09:00', end: '17:00' },
    friday:    { open: true, start: '09:00', end: '17:00' },
    saturday:  { open: false, start: '09:00', end: '13:00' },
    sunday:    { open: false, start: '09:00', end: '13:00' },
  } as any,
  appointmentTypes: [],
  providers: [],
  caller: null,
  workflowHint: 'new_contact' as const,
  transferNumber: null,
};

const EXPECTED_LABEL: Record<Vertical, RegExp> = {
  dental:        /dental practice/i,
  insurance:     /insurance agency/i,
  legal:         /law firm/i,
  real_estate:   /real estate brokerage/i,
  home_services: /home services/i,
  generic:       /business/i,
};

describe('buildSystemPrompt', () => {
  it.each(VERTICAL_VALUES)('renders for vertical %s without throwing', (v: Vertical) => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, vertical: v });
    expect(prompt).toBeTypeOf('string');
    expect(prompt.length).toBeGreaterThan(200);
  });

  it.each(VERTICAL_VALUES)('mentions the right business label for %s', (v: Vertical) => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, vertical: v });
    expect(prompt).toMatch(EXPECTED_LABEL[v]);
  });

  it.each(VERTICAL_VALUES)('includes vertical-appropriate escalation vocabulary for %s', (v: Vertical) => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, vertical: v });
    const vocab = VERTICAL_ESCALATION_VOCAB[v];
    // At least one of the vertical's escalation terms should appear (verbatim
    // or as part of a longer phrase). Defends against the bullets being
    // accidentally stripped by a future refactor.
    const hasAnyVocab = vocab.some((word) => prompt.toLowerCase().includes(word.toLowerCase()));
    expect(hasAnyVocab).toBe(true);
  });

  it('defaults to dental escalation vocab when vertical is unspecified', () => {
    const prompt = buildSystemPrompt({ ...BASE_CTX });
    // dental vocab includes 'pain' and 'swelling' — the original defaults.
    expect(prompt.toLowerCase()).toContain('pain');
  });

  it('isDemo uses the Telfin product script, not a fake office, and never says closed', () => {
    const prompt = buildSystemPrompt({
      ...BASE_CTX,
      practiceName: 'Bright Smile Dental',
      vertical: 'dental',
      workflowHint: 'after_hours',
      isDemo: true,
    });
    expect(prompt).toMatch(/assistant from Telfin/i);
    expect(prompt).toMatch(/product demo/i);
    expect(prompt).not.toMatch(/dental practice/i);
    expect(prompt).not.toMatch(/The office is currently closed/i);
    expect(prompt).toMatch(/Never say you are closed/i);
    expect(prompt).toMatch(/2 minutes/);
    expect(prompt).toMatch(/Try Free/);
    expect(prompt).toMatch(/sound really realistic/);
    expect(prompt).toMatch(/Sound human/);
    expect(prompt).toMatch(/hmm/);
    expect(prompt).not.toMatch(/\bAria\b/);
  });

  it('paying-tenant Grok receptionist uses the same human-rhythm style as the demo', () => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, vertical: 'dental' });
    for (const marker of SOUND_HUMAN_MARKERS) {
      expect(prompt, `missing human-rhythm marker: ${marker}`).toContain(marker);
    }
    expect(prompt).not.toMatch(/product demo/i);
  });

  it('non-demo after_hours still tells paying-tenant callers the office is closed', () => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, workflowHint: 'after_hours' });
    expect(prompt).toMatch(/The office is currently closed/);
    expect(prompt).not.toMatch(/product demo/i);
  });

  it('isDemo honors demoLanguage without affecting non-demo tenants', () => {
    const demo = buildSystemPrompt({ ...BASE_CTX, isDemo: true, demoLanguage: 'es' });
    expect(demo).toMatch(/Speak Spanish from the VERY FIRST word/);
    expect(demo).toContain('asistente de Telfin');

    const paying = buildSystemPrompt({ ...BASE_CTX, vertical: 'dental', demoLanguage: 'es' });
    expect(paying).toMatch(/dental practice/i);
    expect(paying).not.toMatch(/Speak Spanish from the VERY FIRST word/);
  });
});
