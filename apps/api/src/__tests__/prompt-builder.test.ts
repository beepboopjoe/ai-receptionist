// ============================================================
// Smoke tests for the vertical-aware prompt builder.
// We don't assert exact text — these tests catch regressions
// where a vertical stops referencing its business noun, drops
// its escalation vocab, or fails to render entirely.
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, VERTICAL_ESCALATION_VOCAB } from '../modules/voice-agent/prompt-builder.js';
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
});
