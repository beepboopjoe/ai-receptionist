import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_GROK_VOICES,
  DEFAULT_PUBLIC_GROK_VOICE,
  LEGACY_GROK_VOICES,
  PUBLIC_GROK_VOICES,
  PUBLIC_GROK_VOICE_META,
  asGrokVoice,
  grokVoiceLabel,
  pickRandomPublicGrokVoice,
  resolveSessionGrokVoice,
} from '@ai-receptionist/shared';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../modules');

describe('Grok voice catalog', () => {
  it('offers only aurora, castor, cosmo, zenith publicly', () => {
    expect(PUBLIC_GROK_VOICES).toEqual(['aurora', 'castor', 'cosmo', 'zenith']);
    expect(DEFAULT_PUBLIC_GROK_VOICE).toBe('aurora');
    for (const id of PUBLIC_GROK_VOICES) {
      expect(PUBLIC_GROK_VOICE_META[id].label).toBe(id[0]!.toUpperCase() + id.slice(1));
    }
  });

  it('keeps the prior Grok IDs as a hidden legacy allowlist', () => {
    expect(LEGACY_GROK_VOICES).toEqual(['eve', 'ara', 'rex', 'sal', 'leo']);
    expect([...ALL_GROK_VOICES]).toEqual([...PUBLIC_GROK_VOICES, ...LEGACY_GROK_VOICES]);
  });

  it('asGrokVoice keeps public + legacy and maps unknown to aurora', () => {
    expect(asGrokVoice('Castor')).toBe('castor');
    expect(asGrokVoice('Eve')).toBe('eve');
    expect(asGrokVoice('21m00Tcm4TlvDq8ikWAM')).toBe('aurora');
    expect(asGrokVoice(undefined)).toBe('aurora');
  });

  it('pickRandomPublicGrokVoice stays inside the public four', () => {
    expect(pickRandomPublicGrokVoice(() => 0)).toBe('aurora');
    expect(pickRandomPublicGrokVoice(() => 0.25)).toBe('castor');
    expect(pickRandomPublicGrokVoice(() => 0.5)).toBe('cosmo');
    expect(pickRandomPublicGrokVoice(() => 0.75)).toBe('zenith');
    expect(pickRandomPublicGrokVoice(() => 0.999)).toBe('zenith');
  });

  it('resolveSessionGrokVoice randomizes demo independently of tenant voice', () => {
    expect(
      resolveSessionGrokVoice({ isDemo: true, demoVoice: 'cosmo', tenantVoice: 'eve' }),
    ).toBe('cosmo');
    expect(
      resolveSessionGrokVoice({ isDemo: false, demoVoice: 'cosmo', tenantVoice: 'eve' }),
    ).toBe('eve');
    expect(grokVoiceLabel('zenith')).toBe('Zenith');
    expect(grokVoiceLabel('leo')).toBe('Leo');
  });
});

describe('call-me pins Aurora for every public dial', () => {
  it('POST /public/call-me uses DEMO_DEFAULT_VOICE (aurora), not a random picker', () => {
    const src = readFileSync(join(srcRoot, 'public-api/public-demo.router.ts'), 'utf8');
    expect(src).toContain('DEMO_DEFAULT_VOICE');
    expect(src).not.toContain('pickRandomPublicGrokVoice');
    expect(src).toContain('voice,');
    expect(src).toMatch(/mode:\s*'demo'/);
  });

  it('media-stream applies the dialed demo voice only on demo calls', () => {
    const src = readFileSync(join(srcRoot, 'telephony/media-stream.handler.ts'), 'utf8');
    expect(src).toContain('resolveSessionGrokVoice');
    expect(src).toContain('demoVoice: voice');
    expect(src).toContain('tenantVoice: settingsRow?.voiceName');
  });
});
