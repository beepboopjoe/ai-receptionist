// ============================================================
// Live homepage / demo opener — keep in lockstep with
// apps/api/src/modules/voice-agent/call-me-demo.prompt.ts
// (DEMO_OPENING_EN / DEMO_OPENING_ES). Marketing shows this as
// honest script copy. The real audio is the live call-me widget.
// Do not invent MP3s or pretend this is a recording.
// ============================================================

export const DEMO_OPENING_EN =
  "Hey, this is Telfin, your future agent representative. Umm, I know this might sound crazy and I may sound real, but umm, I'm actually AI.";

export const DEMO_OPENING_ES =
  'Hola, soy Telfin, tu futuro representante. Umm, sé que esto puede sonar loco y tal vez sueno de verdad, pero umm, en realidad soy IA.';

export type SampleCallLang = 'en' | 'es';

export interface SampleCallLine {
  role: 'telfin' | 'you';
  text: string;
}

/** Short talk-track after the live opener. Not a feature dump. */
export const SAMPLE_CALL_SCRIPT: Record<SampleCallLang, SampleCallLine[]> = {
  en: [
    { role: 'telfin', text: DEMO_OPENING_EN },
    { role: 'you', text: 'Wait — you sound like a person.' },
    {
      role: 'telfin',
      text: 'Yeah. I answer the phone, book the calendar, and call people back. Same voice your customers would hear.',
    },
    { role: 'you', text: 'Can I hear the real thing without signing up?' },
    {
      role: 'telfin',
      text: "Yep. Drop your number above and I'll ring you. English or Spanish — your pick.",
    },
  ],
  es: [
    { role: 'telfin', text: DEMO_OPENING_ES },
    { role: 'you', text: 'Espera — suenas como una persona.' },
    {
      role: 'telfin',
      text: 'Sí. Contesto el teléfono, agendo en el calendario y devuelvo llamadas. La misma voz que oirían tus clientes.',
    },
    { role: 'you', text: '¿Puedo oírlo de verdad sin registrarme?' },
    {
      role: 'telfin',
      text: 'Claro. Deja tu número arriba y te llamo. Inglés o español — tú eliges.',
    },
  ],
};
