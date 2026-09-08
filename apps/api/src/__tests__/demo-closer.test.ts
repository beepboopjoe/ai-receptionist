import { describe, it, expect } from 'vitest';
import {
  buildDemoCloserPrompt,
  extractDemoLeadFromTranscript,
  formatDemoLeadNotes,
  emptyDemoLeadDraft,
  splitLeadName,
} from '../modules/public-api/demo-closer.js';
import {
  DEMO_AGENT_NAME,
  DEMO_DEFAULT_VOICE,
  DEMO_PUBLIC_VOICES,
  resolveDemoVoice,
} from '../modules/public-api/public-demo.helpers.js';

describe('buildDemoCloserPrompt', () => {
  it('greets as Telfin with a closer pitch, not a fake dental desk', () => {
    const prompt = buildDemoCloserPrompt({
      signupUrl: 'https://telfin.ai/signup?plan=trial',
    });
    expect(prompt).toContain('You are Telfin');
    expect(prompt).toMatch(/Hey, this is Telfin/);
    expect(prompt).toMatch(/closes deals/i);
    expect(prompt).toMatch(/book(?:s)? appointments/i);
    expect(prompt).toMatch(/Their name/);
    expect(prompt).toMatch(/Their business/);
    expect(prompt).toContain('https://telfin.ai/signup?plan=trial');
    expect(prompt).toMatch(/not a dental front desk/i);
    expect(prompt).not.toMatch(/Thank you for calling, this is Telfin/i);
  });
});

describe('extractDemoLeadFromTranscript', () => {
  it('pulls name, business, vertical, and leaves the lead not-closed', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'agent', text: 'Hey, this is Telfin.' },
      { role: 'caller', text: "Hi, my name is Jane Cooper. I run Cooper Dental downtown." },
    ]);
    expect(draft.firstName).toBe('Jane');
    expect(draft.lastName).toBe('Cooper');
    expect(draft.business.toLowerCase()).toContain('cooper dental');
    expect(draft.vertical).toBe('dental');
    expect(draft.closed).toBe(false);
    expect(draft.language).toBe('en');
  });

  it('marks closed when they say they will try free', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'caller', text: "I'm Alex. I'll sign up and try free tonight." },
    ]);
    expect(draft.firstName).toBe('Alex');
    expect(draft.closed).toBe(true);
  });

  it('detects Spanish', () => {
    const draft = extractDemoLeadFromTranscript([
      { role: 'caller', text: 'Hola, gracias. Mi negocio es una clínica.' },
    ]);
    expect(draft.language).toBe('es');
  });
});

describe('formatDemoLeadNotes', () => {
  it('tags not-closed follow-up and round-trips the block', () => {
    const first = formatDemoLeadNotes({
      phone: '+14153211212',
      draft: { ...emptyDemoLeadDraft(), firstName: 'Jane', business: 'Cooper Dental' },
    });
    expect(first).toContain('demo-call-me, not-closed, follow-up');
    expect(first).toContain('phone: +14153211212');
    const second = formatDemoLeadNotes({
      existing: `Keep this note.\n\n${first}`,
      phone: '+14153211212',
      draft: {
        ...emptyDemoLeadDraft(),
        firstName: 'Jane',
        lastName: 'Cooper',
        business: 'Cooper Dental',
        closed: true,
      },
    });
    expect(second).toContain('Keep this note.');
    expect(second).toContain('demo-call-me, closed, follow-up');
    expect(second.match(/demo-call-me-v1/g)?.length).toBe(2);
  });
});

describe('splitLeadName', () => {
  it('falls back to Visitor Lead when nothing was captured', () => {
    expect(splitLeadName(emptyDemoLeadDraft())).toEqual({
      firstName: 'Visitor',
      lastName: 'Lead',
    });
  });
});

describe('demo voice pin', () => {
  it('pins aurora for every demo dial and does not randomize the catalog', () => {
    expect(DEMO_AGENT_NAME).toBe('Telfin');
    expect(DEMO_DEFAULT_VOICE).toBe('aurora');
    expect(DEMO_PUBLIC_VOICES).toEqual(['aurora', 'castor', 'cosmo', 'zenith']);
    expect(resolveDemoVoice({ mode: 'demo' })).toBe('aurora');
    expect(resolveDemoVoice({})).toBe('aurora');
  });
});
