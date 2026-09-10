// ============================================================
// Voice × Language sample data.
//
// Public catalog from @ai-receptionist/shared (aurora / castor /
// cosmo / zenith). Legacy Grok IDs stay in the shared allowlist
// but are not listed here — marketing + settings only offer the four.
//
// 4 voices × 7 languages = 28 audio files.
// Audio lives at: public/audio/voices/<voice>_<lang>.mp3
//
// To regenerate MP3s:
//   XAI_API_KEY=xai-... pnpm tsx scripts/generate-voice-language-samples.ts
// ============================================================
import {
  DEFAULT_PUBLIC_GROK_VOICE,
  PUBLIC_GROK_VOICES,
  PUBLIC_GROK_VOICE_META,
  type PublicGrokVoice,
} from '@ai-receptionist/shared';

export type VoiceId = PublicGrokVoice;
export type LangCode = 'en' | 'es' | 'it' | 'ar' | 'fa' | 'hy' | 'ru';

export interface VoiceSample {
  voice: VoiceId;
  lang: LangCode;
  lines: Array<{ role: 'ai' | 'caller'; text: string }>;
}

export const VOICES = PUBLIC_GROK_VOICE_META;
export const VOICE_IDS = PUBLIC_GROK_VOICES;
export const DEFAULT_VOICE_ID = DEFAULT_PUBLIC_GROK_VOICE;

export const VOICE_CARD_STYLES: Record<VoiceId, { color: string; textColor: string }> = {
  aurora: { color: 'bg-rose-100', textColor: 'text-rose-700' },
  castor: { color: 'bg-blue-100', textColor: 'text-blue-700' },
  cosmo: { color: 'bg-amber-100', textColor: 'text-amber-700' },
  zenith: { color: 'bg-violet-100', textColor: 'text-violet-700' },
};

// ── Language metadata ─────────────────────────────────────────
export const LANGUAGES: Record<LangCode, { label: string; flag: string; xaiCode: string; native: string }> = {
  en: { label: 'English',  flag: '🇺🇸', xaiCode: 'en', native: 'English' },
  es: { label: 'Spanish',  flag: '🇲🇽', xaiCode: 'es', native: 'Español' },
  it: { label: 'Italian',  flag: '🇮🇹', xaiCode: 'it', native: 'Italiano' },
  ar: { label: 'Arabic',   flag: '🇸🇦', xaiCode: 'ar', native: 'العربية' },
  fa: { label: 'Farsi',    flag: '🇮🇷', xaiCode: 'fa', native: 'فارسی' },
  hy: { label: 'Armenian', flag: '🇦🇲', xaiCode: 'hy', native: 'Հայերեն' },
  ru: { label: 'Russian',  flag: '🇷🇺', xaiCode: 'ru', native: 'Русский' },
};

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

/** Shared across homepage / demo / inbound / outbound voice cards. */
export const SAMPLE_LANG_STORAGE_KEY = 'telfin-voice-sample-lang';

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === 'string' && (LANG_CODES as string[]).includes(value);
}

/** Arabic and Farsi are RTL. Armenian (hy) is LTR. */
export function isRtlLang(lang: LangCode): boolean {
  return lang === 'ar' || lang === 'fa';
}

export function voiceSampleSrc(voice: VoiceId, lang: LangCode): string {
  return `/audio/voices/${voice}_${lang}.mp3`;
}

export function parseStoredSampleLang(raw: string | null | undefined): LangCode | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  return isLangCode(code) ? code : null;
}

export function readStoredSampleLang(): LangCode | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredSampleLang(window.localStorage.getItem(SAMPLE_LANG_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistSampleLang(lang: LangCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAMPLE_LANG_STORAGE_KEY, lang);
  } catch {
    /* private mode */
  }
}

/** One-sentence “who we are” intro — marketing samples, not a feature pitch. */
export function voiceIntroLine(voice: VoiceId, lang: LangCode): string {
  const name = VOICES[voice].label;
  switch (lang) {
    case 'en':
      return `Hi, I'm ${name} from Telfin — your AI phone receptionist.`;
    case 'es':
      return `Hola, soy ${name} de Telfin — su recepcionista de IA.`;
    case 'it':
      return `Ciao, sono ${name} di Telfin — la sua receptionist AI.`;
    case 'ar':
      return `مرحباً، أنا ${name} من تلفين — موظفة الاستقبال بالذكاء الاصطناعي.`;
    case 'fa':
      return `سلام، من ${name} از تلفین هستم — منشی تلفنی هوش مصنوعی شما.`;
    case 'hy':
      return `Բարև, ես ${name} եմ Թելֆինից — ձեր արհեստական բանականության հեռախոսային ռեսեպցիոնիստը։`;
    case 'ru':
      return `Привет, я ${name} из Telfin — ваш ИИ-ресепшн на телефоне.`;
  }
}

// ── Flat VOICE_SAMPLES array (4 voices × 7 languages = 28 entries) ──
export const VOICE_SAMPLES: VoiceSample[] = VOICE_IDS.flatMap((voice) =>
  LANG_CODES.map((lang) => ({
    voice,
    lang,
    lines: [{ role: 'ai' as const, text: voiceIntroLine(voice, lang) }],
  }))
);

/** Look up a specific voice+language sample. */
export function getVoiceSample(voice: VoiceId, lang: LangCode): VoiceSample {
  const sample = VOICE_SAMPLES.find((s) => s.voice === voice && s.lang === lang);
  return sample!;
}
