// ============================================================
// Homepage call-me spoken-language catalog.
// Matches product languages: EN ES IT AR FA HY RU.
// Used by POST /public/call-me, the demo prompt, and (via the
// dashboard's voice-samples.ts) the call-me widget.
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
  en: "Hey, this is Telfin — I'm the AI receptionist that answers the phone, books appointments, follows up, and sets things up for a business. What's your name?",
  es: 'Hola, soy Telfin — la recepcionista de inteligencia artificial que contesta, agenda citas, da seguimiento y deja todo listo. ¿Cómo te llamas?',
  it: 'Ciao, sono Telfin — la receptionist AI che risponde, prenota appuntamenti, fa il follow-up e sistema il resto. Come ti chiami?',
  ar: 'مرحباً، أنا تلفين — مساعدة الذكاء الاصطناعي التي ترد على المكالمات وتحجز المواعيد وتتابع. ما اسمك؟',
  fa: 'سلام، من تلفین هستم — منشی هوش مصنوعی که جواب می‌دهد، وقت می‌گذارد و پیگیری می‌کند. اسم شما چیست؟',
  hy: 'Բարև, ես Թելֆինն եմ — արհեստական բանականության ռեսեպցիոնիստ, որ պատասխանում է, ամրագրում է և հետևում է. Ի՞նչ է ձեր անունը։',
  ru: 'Привет, это Telfin — ИИ-ресепшн, который отвечает, записывает на приём и делает фоллоу-ап. Как вас зовут?',
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
 * Coerce a widget/API value to a supported demo language.
 * Unknown / missing → English so older clients without `language` still work.
 */
export function normalizeCallMeLanguage(input: unknown): CallMeLangCode {
  if (input == null) return DEFAULT_CALL_ME_LANG;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return DEFAULT_CALL_ME_LANG;
  if (isCallMeLangCode(raw)) return raw;
  return ALIASES[raw] ?? DEFAULT_CALL_ME_LANG;
}

export function callMeLanguagePromptBlock(lang: CallMeLangCode): string {
  const label = CALL_ME_LANG_LABEL[lang];
  const greeting = CALL_ME_LANG_GREETING[lang];
  if (lang === 'en') {
    return `# Spoken language
The visitor chose English for this demo. Open in English.
If they switch to Spanish, Italian, Arabic, Farsi, Armenian, or Russian, follow them automatically — that auto-switch is a product feature.

Sample opening (vary the wording so it does not sound scripted):
"${greeting}"`;
  }
  return `# Spoken language (IMPORTANT)
The visitor chose ${label} (${lang}) on the call-me form BEFORE we dialed.
- Speak ${label} from the VERY FIRST word of the greeting. Do not start in English.
- Do not ask if ${label} is OK — they already selected it.
- Do not apologize for your ${label}. Do not switch to English to "explain better" unless they ask or they start speaking English.
- If they switch to English or another of the seven languages (English, Spanish, Italian, Arabic, Farsi, Armenian, Russian), follow them automatically — that auto-switch is a product feature.

Sample opening in ${label} (use a close natural variant, not a robotic recitation):
"${greeting}"`;
}
