// ============================================================
// Voice × Language sample data.
//
// Single source of truth for the VoiceLanguageDemo component and
// the generate-voice-language-samples.ts script.
//
// 5 voices × 7 languages = 35 audio files.
// Audio lives at: public/audio/voices/<voice>_<lang>.mp3
//
// To regenerate MP3s:
//   XAI_API_KEY=xai-... pnpm tsx scripts/generate-voice-language-samples.ts
// ============================================================

export type VoiceId = 'ara' | 'eve' | 'leo' | 'rex' | 'sal';
export type LangCode = 'en' | 'es' | 'it' | 'ar' | 'fa' | 'hy' | 'ru';

export interface VoiceSample {
  voice: VoiceId;
  lang: LangCode;
  lines: Array<{ role: 'ai' | 'caller'; text: string }>;
}

// ── Voice metadata ────────────────────────────────────────────
export const VOICES: Record<VoiceId, { label: string; description: string }> = {
  ara: { label: 'Ara', description: 'Warm & professional' },
  eve: { label: 'Eve', description: 'Clear & friendly' },
  leo: { label: 'Leo', description: 'Confident & calm' },
  rex: { label: 'Rex', description: 'Crisp & precise' },
  sal: { label: 'Sal', description: 'Approachable & warm' },
};

export const VOICE_IDS = Object.keys(VOICES) as VoiceId[];

// ── Language metadata ─────────────────────────────────────────
export const LANGUAGES: Record<LangCode, { label: string; flag: string; xaiCode: string }> = {
  en: { label: 'English',  flag: '🇺🇸', xaiCode: 'en' },
  es: { label: 'Spanish',  flag: '🇲🇽', xaiCode: 'es' },
  it: { label: 'Italian',  flag: '🇮🇹', xaiCode: 'it' },
  ar: { label: 'Arabic',   flag: '🇸🇦', xaiCode: 'ar' },
  fa: { label: 'Farsi',    flag: '🇮🇷', xaiCode: 'fa' },
  hy: { label: 'Armenian', flag: '🇦🇲', xaiCode: 'hy' },
  ru: { label: 'Russian',  flag: '🇷🇺', xaiCode: 'ru' },
};

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

// ── Scripts — one per language, shared across all 5 voices ───
// Each voice uses the same text; voice_id changes the audio output.
// AI lines total ≤ ~75 words (~25–30 s at 150 wpm).

const LANG_SCRIPTS: Record<LangCode, VoiceSample['lines']> = {
  en: [
    { role: 'ai',     text: "Hi there! Thank you for calling. This is Aria, your AI receptionist. I can help you schedule an appointment, get answers about our services, or connect you with our team. What can I do for you today?" },
    { role: 'caller', text: "I'd like to book an appointment for next week." },
    { role: 'ai',     text: "Of course! I have availability on Tuesday at 10 AM or Thursday at 2 PM. Which works better for you?" },
    { role: 'caller', text: "Tuesday at 10 is perfect." },
    { role: 'ai',     text: "You're all set! Tuesday at 10 AM is confirmed. You'll receive a text confirmation shortly. Is there anything else I can help with?" },
  ],

  es: [
    { role: 'ai',     text: "¡Hola! Gracias por llamar. Soy Aria, su recepcionista virtual. Puedo ayudarle a agendar una cita, responder sus preguntas, o conectarle con nuestro equipo. ¿En qué le puedo ayudar hoy?" },
    { role: 'caller', text: "Me gustaría agendar una cita para la próxima semana." },
    { role: 'ai',     text: "¡Con gusto! Tengo disponibilidad el martes a las diez de la mañana o el jueves a las dos de la tarde. ¿Cuál le funciona mejor?" },
    { role: 'caller', text: "El martes a las diez está perfecto." },
    { role: 'ai',     text: "¡Listo! Cita confirmada para el martes a las diez. Recibirá un mensaje de confirmación. ¿Hay algo más en que le pueda ayudar?" },
  ],

  it: [
    { role: 'ai',     text: "Salve! Grazie per aver chiamato. Sono Aria, la sua receptionist virtuale. Posso aiutarla a fissare un appuntamento, rispondere alle sue domande, o metterla in contatto con il nostro team. Come posso esserle utile?" },
    { role: 'caller', text: "Vorrei prenotare un appuntamento per la prossima settimana." },
    { role: 'ai',     text: "Certo! Ho disponibilità martedì alle dieci o giovedì alle due del pomeriggio. Quale preferisce?" },
    { role: 'caller', text: "Martedì alle dieci va benissimo." },
    { role: 'ai',     text: "Perfetto! Appuntamento confermato per martedì alle dieci. Riceverà una conferma via SMS. Posso aiutarla con altro?" },
  ],

  ar: [
    { role: 'ai',     text: "مرحباً! شكراً لاتصالك بنا. أنا أريا، مساعدتك الافتراضية. يمكنني مساعدتك في تحديد موعد، الإجابة على استفساراتك، أو التواصل مع فريقنا. كيف يمكنني مساعدتك اليوم؟" },
    { role: 'caller', text: "أريد حجز موعد للأسبوع القادم." },
    { role: 'ai',     text: "بالطبع! لدي توفر يوم الثلاثاء الساعة العاشرة صباحاً أو الخميس الساعة الثانية مساءً. أيهما يناسبك؟" },
    { role: 'caller', text: "الثلاثاء الساعة العاشرة ممتاز." },
    { role: 'ai',     text: "رائع! تم تأكيد موعدك يوم الثلاثاء الساعة العاشرة. ستتلقى رسالة تأكيد قريباً. هل هناك شيء آخر أستطيع مساعدتك به؟" },
  ],

  fa: [
    { role: 'ai',     text: "سلام! ممنون از تماس شما. من آریا هستم، منشی مجازی شما. می‌توانم به شما در تعیین وقت، پاسخ به سوالاتتان، یا ارتباط با تیم ما کمک کنم. چطور می‌توانم امروز کمکتان کنم؟" },
    { role: 'caller', text: "می‌خواهم برای هفته آینده وقت بگیرم." },
    { role: 'ai',     text: "البته! سه‌شنبه ساعت ده صبح یا پنج‌شنبه ساعت دو بعدازظهر در دسترس دارم. کدام برایتان بهتر است؟" },
    { role: 'caller', text: "سه‌شنبه ساعت ده عالیه." },
    { role: 'ai',     text: "عالی! وقت شما سه‌شنبه ساعت ده تأیید شد. به زودی پیام تأیید دریافت خواهید کرد. آیا کمک دیگری می‌توانم بکنم؟" },
  ],

  hy: [
    { role: 'ai',     text: "Բարև ձեզ! Շնորհակալ ենք, որ զանգեցիք: Ես Արիան եմ, ձեր վիրտուալ ռեսեպցիոնիստը: Կարող եմ օգնել ժամանակ ամրագրելու, հարցերին պատասխանելու կամ թիմի հետ կապ հաստատելու հարցում: Ինչո՞վ կարող եմ օգնել:" },
    { role: 'caller', text: "Ուզում եմ հաջորդ շաբաթ ժամ ամրագրել:" },
    { role: 'ai',     text: "Իհարկե: Ունեմ հնարավորություն երեքշաբթի ժամը տասին կամ հինգշաբթի ժամը երկուին: Ո՞րն է ավելի հարմար ձեզ համար:" },
    { role: 'caller', text: "Երեքշաբթի ժամը տասը կատարյալ է:" },
    { role: 'ai',     text: "Հիանալի: Ձեր ժամը հաստատված է երեքշաբթի ժամը տասին: Շուտով կստանաք հաստատման հաղորդագրություն: Կարո՞ղ եմ էլ ինչ-ինչ կերպ օգնել:" },
  ],

  ru: [
    { role: 'ai',     text: "Добрый день! Спасибо, что позвонили. Меня зовут Ария, ваш виртуальный администратор. Я могу помочь вам записаться на приём, ответить на вопросы или соединить вас с нашей командой. Чем я могу помочь вам сегодня?" },
    { role: 'caller', text: "Я бы хотел записаться на следующей неделе." },
    { role: 'ai',     text: "Конечно! У меня есть свободное время во вторник в десять утра или в четверг в два часа дня. Что вам удобнее?" },
    { role: 'caller', text: "Вторник в десять — отлично." },
    { role: 'ai',     text: "Замечательно! Приём во вторник в десять утра подтверждён. Вы получите SMS-подтверждение в ближайшее время. Могу ли я ещё чем-то помочь?" },
  ],
};

// ── Flat VOICE_SAMPLES array (5 voices × 7 languages = 35 entries) ──
export const VOICE_SAMPLES: VoiceSample[] = VOICE_IDS.flatMap((voice) =>
  LANG_CODES.map((lang) => ({
    voice,
    lang,
    lines: LANG_SCRIPTS[lang],
  }))
);

/** Look up a specific voice+language sample. */
export function getVoiceSample(voice: VoiceId, lang: LangCode): VoiceSample {
  const sample = VOICE_SAMPLES.find((s) => s.voice === voice && s.lang === lang);
  // All 35 combinations always exist in the array, so this is always defined.
  return sample!;
}
