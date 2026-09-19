// ============================================================
// Homepage call-me spoken-language catalog.
// Matches product languages: EN ES IT AR FA HY RU.
// Live call-me detects language from speech (English fallback).
// The public widget does not send a pre-selected language.
// ============================================================

export const CALL_ME_LANG_CODES = ['en', 'es', 'it', 'ar', 'fa', 'hy', 'ru'] as const;
export type CallMeLangCode = (typeof CALL_ME_LANG_CODES)[number];
export const DEFAULT_CALL_ME_LANG: CallMeLangCode = 'en';

export const CALL_ME_LANG_LABEL: Record<CallMeLangCode, string> = {
  en: 'English',
  es: 'Spanish',
  it: 'Italian',
  ar: 'Arabic',
  fa: 'Farsi',
  hy: 'Armenian',
  ru: 'Russian',
};

/** Native autonym shown in the picker (English stays English). */
export const CALL_ME_LANG_NATIVE: Record<CallMeLangCode, string> = {
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  ar: 'العربية',
  fa: 'فارسی',
  hy: 'Հայերեն',
  ru: 'Русский',
};

/**
 * Sample first-turn greeting in the selected language. The model should
 * start with a close natural variant — not a robotic recitation.
 */
export const CALL_ME_LANG_GREETING: Record<CallMeLangCode, string> = {
  en: 'Hey, this is Telfin, your future agent representative. Umm, I know this might sound crazy and I may sound real, but umm, I\'m actually AI.',
  es: 'Hola, soy Telfin, tu futuro representante. Umm, sé que esto puede sonar loco y tal vez sueno de verdad, pero umm, en realidad soy IA.',
  it: 'Ciao, sono un rappresentante di Telfin.',
  ar: 'مرحباً، أنا ممثل من تلفين.',
  fa: 'سلام، من نماینده تلفین هستم.',
  hy: 'Բարև, ես Թելֆինի ներկայացուցիչն եմ.',
  ru: 'Привет, я представитель Telfin.',
};

const ALIASES: Record<string, CallMeLangCode> = {
  en: 'en',
  eng: 'en',
  english: 'en',
  es: 'es',
  spa: 'es',
  spanish: 'es',
  espanol: 'es',
  español: 'es',
  it: 'it',
  ita: 'it',
  italian: 'it',
  italiano: 'it',
  ar: 'ar',
  ara: 'ar',
  arabic: 'ar',
  fa: 'fa',
  fas: 'fa',
  per: 'fa',
  farsi: 'fa',
  persian: 'fa',
  hy: 'hy',
  hye: 'hy',
  arm: 'hy',
  armenian: 'hy',
  ru: 'ru',
  rus: 'ru',
  russian: 'ru',
};

export function isCallMeLangCode(value: string): value is CallMeLangCode {
  return (CALL_ME_LANG_CODES as readonly string[]).includes(value);
}

/**
 * Coerce a leftover API value to a supported demo language.
 * Unknown / missing → English. Live call-me ignores this for the greeting
 * and uses {@link callMeAutoDetectPromptBlock} instead.
 */
export function normalizeCallMeLanguage(input: unknown): CallMeLangCode {
  if (input == null) return DEFAULT_CALL_ME_LANG;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return DEFAULT_CALL_ME_LANG;
  if (isCallMeLangCode(raw)) return raw;
  return ALIASES[raw] ?? DEFAULT_CALL_ME_LANG;
}

/** True when the request asked for on-call detection (or sent nothing). */
export function isAutoCallMeLanguage(input: unknown): boolean {
  if (input == null) return true;
  const raw = String(input).trim().toLowerCase();
  return raw === '' || raw === 'auto';
}

/**
 * Default live-demo language instructions: open in English, then match
 * whatever the caller actually speaks. No UI picker is involved.
 */
export function callMeAutoDetectPromptBlock(greeting = CALL_ME_LANG_GREETING.en): string {
  return `# Spoken language
No language was pre-selected. Detect the caller's language from their speech.
- Open in English as the safe fallback (first greeting).
- As soon as you hear them speak Spanish, switch to Spanish from the next turn — do not ask "is this language OK?"
- Do not announce that you detected their language unless they ask.
- If you cannot tell, stay in English.
- English and Spanish are the product languages. Do not switch into other languages.

Sample opening (vary the wording so it does not sound scripted):
"${greeting}"`;
}

export function callMeLanguagePromptBlock(lang: CallMeLangCode, greetingOverride?: string): string {
  const label = CALL_ME_LANG_LABEL[lang];
  const greeting = greetingOverride ?? CALL_ME_LANG_GREETING[lang];
  if (lang === 'en') {
    return `# Spoken language
Open in English as the fallback.
If they switch to Spanish, follow them automatically — that auto-switch is a product feature.
English and Spanish are the product languages. Do not switch into other languages.

Sample opening (vary the wording so it does not sound scripted):
"${greeting}"`;
  }
  return `# Spoken language (IMPORTANT)
Speak ${label} (${lang}) from the VERY FIRST word of the greeting. Do not start in English.
- Do not ask if ${label} is OK.
- Do not apologize for your ${label}. Do not switch to English to "explain better" unless they ask or they start speaking English.
- If they switch to English or Spanish, follow them automatically — that auto-switch is a product feature.

Sample opening in ${label} (use a close natural variant, not a robotic recitation):
"${greeting}"`;
}
