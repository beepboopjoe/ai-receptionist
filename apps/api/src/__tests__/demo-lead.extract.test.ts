// ============================================================
// Demo lead extraction from call-me transcripts.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  emptyDemoLeadDraft,
  extractDemoLeadFromTranscript,
} from '../modules/public-api/demo-lead.extract.js';
import {
  DEMO_AGENT_NAME,
  DEMO_DEFAULT_VOICE,
  DEMO_CALL_ME_NUM_COOLDOWN_SECONDS,
} from '../modules/public-api/public-demo.helpers.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../modules');

describe('extractDemoLeadFromTranscript', () => {
  it('pulls name and business and leaves the lead not-closed', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'agent', text: 'Hey, this is Telfin.' },
      { role: 'caller', text: "Hi, my name is Jane Cooper. I run Cooper Dental downtown." },
    ]);
    expect(draft.name).toBe('Jane Cooper');
    expect(draft.business.toLowerCase()).toContain('cooper dental');
    expect(draft.closed).toBe(false);
  });

  it('marks closed when they say they will try free', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'caller', text: "I'm Alex. I'll sign up and try free tonight." },
    ]);
    expect(draft.name).toBe('Alex');
    expect(draft.closed).toBe(true);
  });

  it('detects Spanish', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'caller', text: 'Hola, gracias. Mi negocio es una clínica.' },
    ]);
    expect(draft.languageHint).toBe('es');
  });

  it('captures a bare name and business after the agent asks (call-me friend path)', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'agent', text: 'Hey, this is a representative of Telfin.' },
      { role: 'caller', text: 'Hello?' },
      { role: 'agent', text: 'We answer phones and book appointments. What is your name?' },
      { role: 'caller', text: 'Mike' },
      { role: 'agent', text: 'Nice to meet you, Mike. What kind of business are you in?' },
      { role: 'caller', text: 'A plumbing company downtown.' },
      { role: 'agent', text: 'Want me to note an email?' },
      { role: 'caller', text: 'Sure, mike@plumbers.com' },
    ]);
    expect(draft.name).toBe('Mike');
    expect(draft.business.toLowerCase()).toContain('plumbing');
    expect(draft.email).toBe('mike@plumbers.com');
    expect(draft.closed).toBe(false);
  });

  it('does not treat I run a shop as a person name', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'caller', text: "I'm a plumber. I run Harbor Pipe downtown." },
    ]);
    expect(draft.name).toBe('');
    expect(draft.business.toLowerCase()).toContain('harbor pipe');
  });
});

describe('emptyDemoLeadDraft', () => {
  it('defaults to aurora / not closed', () => {
    expect(emptyDemoLeadDraft()).toMatchObject({
      name: '',
      voice: 'aurora',
      closed: false,
      language: 'en',
    });
  });
});

describe('demo call-me pin + cooldown + lead persist', () => {
  it('pins aurora and uses an 8-second anti-double-click cooldown', () => {
    expect(DEMO_AGENT_NAME).toBe('Telfin');
    expect(DEMO_DEFAULT_VOICE).toBe('aurora');
    expect(DEMO_CALL_ME_NUM_COOLDOWN_SECONDS).toBe(8);
  });

  it('POST /public/call-me stubs a lead, pins aurora, and does not randomize voice', () => {
    const src = readFileSync(join(srcRoot, 'public-api/public-demo.router.ts'), 'utf8');
    expect(src).toContain('DEMO_DEFAULT_VOICE');
    expect(src).toContain('stubDemoLead');
    expect(src).toContain('DEMO_CALL_ME_NUM_COOLDOWN_SECONDS');
    expect(src).not.toContain('pickRandomPublicGrokVoice');
    expect(src).toMatch(/mode:\s*'demo'/);
  });

  it('platform admin lists demo_leads', () => {
    const src = readFileSync(join(srcRoot, 'platform/platform.router.ts'), 'utf8');
    expect(src).toContain('/platform/demo-leads');
    expect(src).toContain('demoLeads');
  });

  it('hangup enrich writes extracted name, business, and email', () => {
    const src = readFileSync(join(srcRoot, 'public-api/demo-lead.service.ts'), 'utf8');
    expect(src).toContain('name: extracted.name');
    expect(src).toContain('business: extracted.business');
    expect(src).toContain('email: extracted.email');
    expect(src).toContain("source: 'call_me'");
  });
});
