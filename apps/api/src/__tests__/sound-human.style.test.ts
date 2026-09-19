// ============================================================
// Phone-agent realism: spoken fillers + short pauses.
// Prompt-only — engine first-audio path stays force_message +
// reasoning.effort=none (see grok-first-turn / grok.adapter).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSystemPrompt } from '../modules/voice-agent/prompt-builder.js';
import { buildCallMeDemoPrompt } from '../modules/voice-agent/call-me-demo.prompt.js';
import { buildOutboundQualificationPrompt } from '../modules/campaigns/outbound-qualification.prompt.js';
import {
  SOUND_HUMAN_MARKERS,
  SOUND_HUMAN_PROMPT_SECTION,
} from '../modules/voice-agent/sound-human.style.js';
import { firstTurnGreetingText } from '../modules/telephony/grok-first-turn.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const BASE_CTX = {
  practiceName: 'Test Tenant',
  timezone: 'America/New_York',
  officeHours: {
    monday: { open: true, start: '09:00', end: '17:00' },
    tuesday: { open: true, start: '09:00', end: '17:00' },
    wednesday: { open: true, start: '09:00', end: '17:00' },
    thursday: { open: true, start: '09:00', end: '17:00' },
    friday: { open: true, start: '09:00', end: '17:00' },
    saturday: { open: false, start: '09:00', end: '13:00' },
    sunday: { open: false, start: '09:00', end: '13:00' },
  } as any,
  appointmentTypes: [],
  providers: [],
  caller: null,
  workflowHint: 'new_contact' as const,
  transferNumber: null,
};

describe('SOUND_HUMAN_PROMPT_SECTION', () => {
  it('asks for spoken um/uh and short [pause] on ongoing turns, never a long think', () => {
    for (const marker of SOUND_HUMAN_MARKERS) {
      expect(SOUND_HUMAN_PROMPT_SECTION, `missing marker: ${marker}`).toContain(marker);
    }
    expect(SOUND_HUMAN_PROMPT_SECTION).toMatch(/ONGOING TURNS/);
    expect(SOUND_HUMAN_PROMPT_SECTION).toMatch(/NEVER use \[long-pause\]/);
    expect(SOUND_HUMAN_PROMPT_SECTION).not.toMatch(/\[long-pause\] tag is OK/i);
  });

  it('is wired into inbound, demo, and outbound phone prompts', () => {
    const inbound = buildSystemPrompt({ ...BASE_CTX, vertical: 'dental' });
    const demo = buildCallMeDemoPrompt();
    const outbound = buildOutboundQualificationPrompt({
      practiceName: 'Acme Dental',
      leadFirstName: 'Sam',
      availableAppointmentTypes: 'Consultation',
      campaignId: 'camp_1',
      campaignContactId: 'cc_1',
    });

    for (const [label, prompt] of [
      ['inbound', inbound],
      ['demo', demo],
      ['outbound', outbound],
    ] as const) {
      for (const marker of SOUND_HUMAN_MARKERS) {
        expect(prompt, `${label} missing ${marker}`).toContain(marker);
      }
    }
  });

  it('keeps paying-tenant and demo first greetings filler-free', () => {
    const inbound = firstTurnGreetingText({
      isDemo: false,
      isOutbound: false,
      practiceName: 'Acme Dental',
    });
    const demo = firstTurnGreetingText({
      isDemo: true,
      isOutbound: false,
      practiceName: 'Acme Dental',
    });
    expect(inbound.toLowerCase()).not.toMatch(/\bum\b/);
    expect(inbound.toLowerCase()).not.toMatch(/\buh\b/);
    expect(inbound).not.toContain('[pause]');
    expect(demo).toBe('Hey, this is a representative of Telfin.');
    expect(demo.toLowerCase()).not.toMatch(/\bum+\b/);
    expect(demo).not.toMatch(/actually AI/i);
    expect(demo).not.toContain('[pause]');
    expect(demo).not.toContain('[long-pause]');
  });
});

describe('engine first-audio path stays fast', () => {
  it('does not invent filler session fields or re-enable high reasoning', () => {
    const adapter = readFileSync(
      join(srcRoot, 'modules/voice-agent/adapters/grok.adapter.ts'),
      'utf8',
    );
    const style = readFileSync(
      join(srcRoot, 'modules/voice-agent/sound-human.style.ts'),
      'utf8',
    );
    expect(adapter).toContain("effort: 'none'");
    expect(adapter).toContain('tools: []');
    expect(adapter).not.toMatch(/enable_fillers|speech_style|ssml/i);
    expect(style).toMatch(/Prompt-only/);
    expect(style).toMatch(/force_message/);
  });

  it('does not flip DEMO_SKIP_COOLDOWN', () => {
    const style = readFileSync(
      join(srcRoot, 'modules/voice-agent/sound-human.style.ts'),
      'utf8',
    );
    expect(style).not.toMatch(/DEMO_SKIP_COOLDOWN/);
  });
});
