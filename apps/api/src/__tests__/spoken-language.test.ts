// ============================================================
// First-class English / Spanish tenant setting.
// Does not flip DEMO_SKIP_COOLDOWN or change prices.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isSpokenLanguage,
  normalizeSpokenLanguage,
  SPOKEN_LANGUAGE_VALUES,
} from '@ai-receptionist/shared';
import {
  afterHoursHoldReplyEs,
  inboundGreetingEs,
  outboundGreetingEs,
  smsFallbackReplyEs,
  spokenLanguagePromptBlock,
  usesSpanishCopy,
} from '../modules/voice-agent/spoken-language.js';
import { buildSystemPrompt } from '../modules/voice-agent/prompt-builder.js';
import { firstTurnGreetingText } from '../modules/telephony/grok-first-turn.js';
import { DEMO_OPENING_ES, buildDemoOpeningEs } from '../modules/voice-agent/call-me-demo.prompt.js';
import { buildSmsSystemPrompt, afterHoursHoldReply } from '../modules/sms/sms-agent.prompt.js';
import { renderSmsTemplate } from '../modules/notifications/templates/sms.templates.js';
import { buildMissedCallTextBackBody } from '../modules/sms/missed-call-textback.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const BASE_CTX = {
  practiceName: 'Test Tenant',
  timezone: 'America/New_York',
  officeHours: {
    monday: { open: true, start: '09:00', end: '17:00' },
  } as any,
  appointmentTypes: [],
  providers: [],
  caller: null,
  workflowHint: 'new_contact' as const,
  transferNumber: null,
};

describe('normalizeSpokenLanguage', () => {
  it('defaults missing / junk to English', () => {
    expect(normalizeSpokenLanguage(undefined)).toBe('en');
    expect(normalizeSpokenLanguage(null)).toBe('en');
    expect(normalizeSpokenLanguage('')).toBe('en');
    expect(normalizeSpokenLanguage('fr')).toBe('en');
    expect(SPOKEN_LANGUAGE_VALUES).toEqual(['en', 'es', 'auto']);
    expect(isSpokenLanguage('es')).toBe(true);
    expect(isSpokenLanguage('it')).toBe(false);
  });

  it('accepts aliases', () => {
    expect(normalizeSpokenLanguage('Spanish')).toBe('es');
    expect(normalizeSpokenLanguage('bilingual')).toBe('auto');
    expect(normalizeSpokenLanguage('en-es')).toBe('auto');
  });
});

describe('paying-tenant language prompts', () => {
  it('injects English-primary instructions by default', () => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, vertical: 'dental' });
    expect(prompt).toMatch(/English is the primary language/);
    expect(prompt).not.toMatch(/Speak Spanish from the VERY FIRST word/);
    expect(prompt).not.toMatch(/Grok|Telnyx|xAI/);
  });

  it('locks Spanish when spokenLanguage is es', () => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, vertical: 'legal', spokenLanguage: 'es' });
    expect(prompt).toMatch(/Speak Spanish from the VERY FIRST word/);
    expect(spokenLanguagePromptBlock('es')).toMatch(/VERY FIRST word/);
  });

  it('uses bilingual auto-detect for auto', () => {
    const prompt = buildSystemPrompt({ ...BASE_CTX, vertical: 'generic', spokenLanguage: 'auto' });
    expect(prompt).toMatch(/This line is bilingual: English and Spanish/);
    expect(prompt).toMatch(/Open in English as the safe fallback/);
  });
});

describe('first-turn greetings', () => {
  it('greets inbound Spanish tenants in Spanish', () => {
    expect(
      firstTurnGreetingText({
        isDemo: false,
        isOutbound: false,
        practiceName: 'Clínica Sol',
        spokenLanguage: 'es',
      }),
    ).toBe('Gracias por llamar a Clínica Sol.');
    expect(
      inboundGreetingEs({ practiceName: 'Clínica Sol', callerFirstName: 'María' }),
    ).toMatch(/Hola María/);
    expect(outboundGreetingEs({ practiceName: 'Clínica Sol', leadFirstName: 'Sam' })).toMatch(
      /puedo hablar con Sam/,
    );
  });

  it('uses the Spanish AI-reveal demo opener when language is es', () => {
    expect(
      firstTurnGreetingText({
        isDemo: true,
        isOutbound: false,
        practiceName: 'Telfin Demo',
        language: 'es',
      }),
    ).toBe(DEMO_OPENING_ES);
    expect(DEMO_OPENING_ES).toMatch(/en realidad soy IA/);
    expect(DEMO_OPENING_ES).not.toMatch(/Grok|Telnyx|xAI|receptionist/i);
    expect(buildDemoOpeningEs('Alex')).toContain('Alex');
  });
});

describe('SMS language', () => {
  it('asks the SMS agent to reply in Spanish when locked', () => {
    const prompt = buildSmsSystemPrompt({
      practiceName: 'Bright Smile',
      vertical: 'dental',
      timezone: 'America/New_York',
      officeHours: {},
      transferNumber: null,
      contact: null,
      afterHours: false,
      thread: [],
      inboundBody: 'Hola',
      spokenLanguage: 'es',
    });
    expect(prompt).toMatch(/Reply in Spanish/);
    expect(afterHoursHoldReply('Bright Smile', 'es')).toMatch(/oficina está cerrada/);
    expect(afterHoursHoldReplyEs('Bright Smile')).toMatch(/URGENTE/);
    expect(usesSpanishCopy('es')).toBe(true);
    expect(smsFallbackReplyEs({ practiceName: 'X', afterHours: false, urgent: false, newContact: true })).toMatch(
      /nombre/,
    );
  });

  it('renders customer appointment SMS in Spanish', () => {
    const body = renderSmsTemplate('confirmation', {
      contactName: 'Ana',
      appointmentType: 'limpieza',
      appointmentDate: 'martes',
      appointmentTime: '2:00',
      language: 'es',
    });
    expect(body).toMatch(/está confirmada/);
    expect(body).not.toMatch(/is confirmed/);
  });

  it('sends missed-call text-back in Spanish when locked', () => {
    const body = buildMissedCallTextBackBody({
      businessName: 'Downtown Dental',
      publicNumber: '+14155551234',
      language: 'es',
    });
    expect(body).toMatch(/Perdón que no pudimos atenderle/);
    expect(body).toContain('(415) 555-1234');
    expect(body).not.toMatch(/Grok|Telnyx|xAI/);
  });
});

describe('Spanish wiring (source)', () => {
  it('persists spoken_language and exposes a settings toggle', () => {
    const sql = readFileSync(join(srcRoot, 'db/migrations/0047_spoken_language.sql'), 'utf8');
    expect(sql).toContain('spoken_language');
    expect(sql).toContain("DEFAULT 'en'");

    const schema = readFileSync(join(srcRoot, 'db/schema.ts'), 'utf8');
    expect(schema).toContain("spokenLanguage: text('spoken_language')");

    const settings = readFileSync(join(srcRoot, 'modules/admin/settings.service.ts'), 'utf8');
    expect(settings).toContain('spokenLanguage');

    const ui = readFileSync(join(srcRoot, '../../dashboard/src/app/(app)/settings/voice-agent/page.tsx'), 'utf8');
    expect(ui).toContain('spokenLanguage');
    expect(ui).toContain('Español');
    expect(ui).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);

    const widget = readFileSync(join(srcRoot, '../../dashboard/src/components/ui/call-me-widget.tsx'), 'utf8');
    expect(widget).toContain("setLang('es')");
    expect(widget).toContain('language: lang');
  });

  it('does not flip DEMO_SKIP_COOLDOWN', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
    const prompt = readFileSync(join(srcRoot, 'modules/voice-agent/call-me-demo.prompt.ts'), 'utf8');
    expect(prompt).not.toMatch(/DEMO_SKIP_COOLDOWN/);
  });
});
