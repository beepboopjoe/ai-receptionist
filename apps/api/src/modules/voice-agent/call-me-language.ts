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
  en: "Hey, this is an assistant from Telfin — I know I sound really realistic, but I'm actually an AI receptionist that can answer your calls, book appointments, follow up with leads, and set things up for you.",
  es: 'Hola, soy un asistente de Telfin — sé que sueno muy real, pero en realidad soy una recepcionista de inteligencia artificial que puede contestar tus llamadas, agendar citas, dar seguimiento a leads y dejarlo todo listo.',
  it: 'Ciao, sono un assistente di Telfin — so di suonare molto realistico, ma in realtà sono una receptionist AI che può rispondere alle tue chiamate, prenotare appuntamenti, fare follow-up con i lead e sistemare il resto.',
  ar: 'مرحباً، أنا مساعد من تلفين — أعلم أنني أبدو واقعياً جداً، لكنني في الحقيقة موظفة استقبال بالذكاء الاصطناعي يمكنها الرد على مكالماتك وحجز المواعيد ومتابعة العملاء المحتملين وترتيب الأمور.',
  fa: 'سلام، من یک دستیار از طرف تلفین هستم — می‌دانم خیلی واقعی به نظر می‌رسم، اما در واقع یک منشی هوش مصنوعی هستم که می‌تواند به تماس‌هایتان جواب بدهد، وقت بگذارد، سرنخ‌ها را پیگیری کند و کارها را راه بیندازد.',
  hy: 'Բարև, ես Թելֆինի օգնական եմ — գիտեմ, որ շատ իրական եմ հնչում, բայց իրականում արհեստական բանականության ռեսեպցիոնիստ եմ, որ կարող է պատասխանել ձեր զանգերին, ամրագրել ժամեր, հետևել լիդերին և կարգավորել գործերը.',
  ru: 'Привет, я ассистент Telfin — знаю, что звучу очень реалистично, но на самом деле я ИИ-ресепшн: могу отвечать на звонки, записывать на приём, делать фоллоу-ап по лидам и всё настроить.',
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
