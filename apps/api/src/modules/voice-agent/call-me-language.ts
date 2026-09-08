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
  en: "Hi, this is Aria with Telfin — thanks for trying the live demo. You're hearing the same AI that would answer your business line, twenty-four seven. What kind of business are you calling from?",
  es: 'Hola, soy Aria de Telfin — gracias por probar la demo en vivo. Está escuchando la misma inteligencia artificial que contestaría la línea de su negocio, las veinticuatro horas. ¿A qué se dedica su negocio?',
  it: 'Salve, sono Aria di Telfin — grazie per aver provato la demo dal vivo. Sta ascoltando la stessa intelligenza artificiale che risponderebbe alla linea della sua azienda, ventiquattro ore su ventiquattro. Che tipo di attività gestisce?',
  ar: 'مرحباً، أنا آريا من تلفين — شكراً لتجربة العرض المباشر. أنت تسمع نفس الذكاء الاصطناعي الذي سيجيب على خط عملك على مدار الساعة. ما نوع عملك؟',
  fa: 'سلام، من آریا از تلفین هستم — ممنون که دموی زنده را امتحان کردید. همان هوش مصنوعی را می‌شنوید که خط کسب‌وکار شما را شبانه‌روز پاسخ می‌دهد. کسب‌وکار شما چیست؟',
  hy: 'Բարև ձեզ, ես Արիան եմ Թելֆինից — շնորհակալ ենք, որ փորձում եք ուղիղ դեմոն. Դուք լսում եք նույն արհեստական բանականությունը, որը կպատասխանի ձեր բիզնեսի գծին՝ շուրջօրյա։ Ի՞նչ տեսակի բիզնես ունեք։',
  ru: 'Здравствуйте, меня зовут Ария, это Telfin — спасибо, что пробуете живое демо. Вы слышите тот же ИИ, который отвечал бы на линию вашего бизнеса круглосуточно. Чем занимается ваша компания?',
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
