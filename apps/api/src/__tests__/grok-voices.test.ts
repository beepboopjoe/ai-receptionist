import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
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
const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

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

describe('marketing samples speak the matching voice name', () => {
  it('preview TTS script uses voice_id + "Hi, I\'m [Name]" for each public voice', () => {
    const preview = readFileSync(join(repoRoot, 'scripts/generate-voice-previews.ts'), 'utf8');
    for (const id of PUBLIC_GROK_VOICES) {
      const name = PUBLIC_GROK_VOICE_META[id].label;
      expect(preview).toContain(`id: '${id}'`);
      expect(preview).toContain(`Hi, I'm ${name} from Telfin`);
    }
  });

  it('dashboard sample lines interpolate the display name per voice', () => {
    const src = readFileSync(
      join(repoRoot, 'apps/dashboard/src/lib/voice-samples.ts'),
      'utf8',
    );
    expect(src).toContain('function voiceIntroLine');
    expect(src).toContain("Hi, I'm ${name} from Telfin — your AI phone receptionist.");
    expect(src).toContain('VOICE_IDS.flatMap');
  });

  it('public preview MP3s are not leftover copies of eve/ara/rex/sal', () => {
    const dir = join(repoRoot, 'apps/dashboard/public/audio/voices');
    const pairs: Array<[string, string]> = [
      ['aurora-preview.mp3', 'eve-preview.mp3'],
      ['castor-preview.mp3', 'ara-preview.mp3'],
      ['cosmo-preview.mp3', 'rex-preview.mp3'],
      ['zenith-preview.mp3', 'sal-preview.mp3'],
    ];
    for (const [pub, legacy] of pairs) {
      const a = readFileSync(join(dir, pub));
      const b = readFileSync(join(dir, legacy));
      expect(Buffer.compare(a, b), `${pub} must not be a byte-copy of ${legacy}`).not.toBe(0);
    }
  });
});

describe('marketing voice sample languages', () => {
  const langs = ['en', 'es', 'it', 'ar', 'fa', 'hy', 'ru'] as const;
  const voicesDir = join(repoRoot, 'apps/dashboard/public/audio/voices');
  const samples = readFileSync(join(repoRoot, 'apps/dashboard/src/lib/voice-samples.ts'), 'utf8');
  const homepage = readFileSync(
    join(repoRoot, 'apps/dashboard/src/components/ui/homepage-voice-samples.tsx'),
    'utf8',
  );
  const demoUi = readFileSync(
    join(repoRoot, 'apps/dashboard/src/components/ui/voice-language-demo.tsx'),
    'utf8',
  );
  const demoPage = readFileSync(join(repoRoot, 'apps/dashboard/src/app/demo/page.tsx'), 'utf8');
  const callMe = readFileSync(
    join(repoRoot, 'apps/dashboard/src/components/ui/call-me-widget.tsx'),
    'utf8',
  );
  const chips = readFileSync(
    join(repoRoot, 'apps/dashboard/src/components/ui/sample-language-chips.tsx'),
    'utf8',
  );

  it('ships a one-liner MP3 for every public voice × language', () => {
    for (const voice of PUBLIC_GROK_VOICES) {
      for (const lang of langs) {
        const file = join(voicesDir, `${voice}_${lang}.mp3`);
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeGreaterThan(8_000);
      }
    }
  });

  it('persists sample language in localStorage and treats only ar/fa as RTL', () => {
    expect(samples).toContain("SAMPLE_LANG_STORAGE_KEY = 'telfin-voice-sample-lang'");
    expect(samples).toContain('function persistSampleLang');
    expect(samples).toContain('function voiceSampleSrc');
    expect(samples).toMatch(/return lang === 'ar' \|\| lang === 'fa'/);
    const rtlFn = samples.slice(
      samples.indexOf('export function isRtlLang'),
      samples.indexOf('export function voiceSampleSrc'),
    );
    expect(rtlFn).not.toContain("'hy'");
  });

  it('homepage and demo voice cards share language chips; call-me does not', () => {
    expect(homepage).toContain('SampleLanguageChips');
    expect(homepage).toContain('voiceSampleSrc');
    expect(homepage).not.toMatch(/\$\{voice\.id\}-preview\.mp3/);
    expect(demoUi).toContain('SampleLanguageChips');
    expect(demoUi).toContain('useSampleLanguage');
    expect(demoUi).not.toContain('hideLanguageSelector');
    expect(demoPage).not.toContain('hideLanguageSelector');
    expect(chips).toContain('Sample language');
    expect(chips).toContain('toUpperCase');
    expect(callMe).not.toContain('SampleLanguageChips');
    expect(callMe).not.toContain('useSampleLanguage');
    expect(callMe).toMatch(/Language is\s+detected when you pick up/);
  });
});
