// ============================================================
// Pre-scripted sample call dialogues used by the marketing
// SampleCallPlayer + the audio-generation script.
//
// Single source of truth — when adding/editing a script, also
// re-run `pnpm tsx scripts/generate-sample-voices.ts` to refresh
// the corresponding MP3 in apps/dashboard/public/audio/samples/.
// ============================================================
import type { Vertical } from '@/lib/verticals';

export interface CallLine {
  role: 'ai' | 'caller';
  text: string;
}

export interface SampleCall {
  id: string;
  title: string;
  scenario: string;
  lang: 'en' | 'es';
  vertical: Vertical;
  durationLabel: string;
  lines: CallLine[];
}

export const SAMPLE_CALLS: SampleCall[] = [
  // ── Dental ────────────────────────────────────────────────
  {
    id: 'dental_en_recall',
    title: 'Patient Recall',
    scenario: 'Overdue for cleaning — AI books the appointment',
    lang: 'en',
    vertical: 'dental',
    durationLabel: '~45s',
    lines: [
      { role: 'ai',     text: "Hi, this is Aria calling from Riverside Dental. Am I speaking with Sarah Johnson?" },
      { role: 'caller', text: "Yes, this is Sarah." },
      { role: 'ai',     text: "Hi Sarah! I'm reaching out because you're due for your six-month cleaning — it's been about eight months since your last visit. We have a few openings this week. Would Tuesday at 2 PM work for you?" },
      { role: 'caller', text: "Actually, can we do Thursday morning?" },
      { role: 'ai',     text: "Absolutely! I have Thursday at 10 AM with Dr. Chen. Should I go ahead and book that?" },
      { role: 'caller', text: "That sounds perfect." },
      { role: 'ai',     text: "Wonderful! I've booked you for Thursday at 10 AM. You'll get a text confirmation shortly. Is there anything else I can help you with?" },
      { role: 'caller', text: "No, that's all. Thanks!" },
      { role: 'ai',     text: "Have a great day, Sarah. We'll see you Thursday!" },
    ],
  },
  {
    id: 'dental_es_reminder',
    title: 'Recordatorio de Cita',
    scenario: 'Confirmación de cita — el AI confirma en español',
    lang: 'es',
    vertical: 'dental',
    durationLabel: '~35s',
    lines: [
      { role: 'ai',     text: "Hola, habla Aria de la Clínica Dental Riverside. ¿Estoy hablando con Carlos Rodríguez?" },
      { role: 'caller', text: "Sí, soy yo." },
      { role: 'ai',     text: "¡Hola Carlos! Le llamo porque tiene una cita de limpieza dental esta semana — el jueves a las tres de la tarde con el Doctor Chen. ¿Puede confirmar su asistencia?" },
      { role: 'caller', text: "Sí, ahí estaré. ¿Tengo que llevar algo?" },
      { role: 'ai',     text: "Solo su tarjeta de seguro, si puede. También le pedimos llegar cinco minutos antes para el papeleo. ¿Tiene alguna pregunta?" },
      { role: 'caller', text: "No, todo claro. Gracias." },
      { role: 'ai',     text: "¡Perfecto! Le enviamos un recordatorio por mensaje de texto. ¡Hasta el jueves, Carlos!" },
    ],
  },

  // ── Insurance ─────────────────────────────────────────────
  {
    id: 'insurance_en_lead_followup',
    title: 'Quote Follow-Up',
    scenario: 'Warm lead who requested a quote — AI books a consultation',
    lang: 'en',
    vertical: 'insurance',
    durationLabel: '~50s',
    lines: [
      { role: 'ai',     text: "Hi, this is Aria from Apex Insurance Group. I'm calling for James Miller — is this a good time?" },
      { role: 'caller', text: "Yeah, go ahead." },
      { role: 'ai',     text: "Great! You requested a home and auto bundle quote earlier this week. I wanted to follow up and answer any questions, and see if you'd like to schedule a quick call with one of our licensed agents." },
      { role: 'caller', text: "Sure, I've been meaning to switch. What's the typical savings?" },
      { role: 'ai',     text: "On average our clients save 18 to 25 percent bundling home and auto together. To get you an accurate number, I'd love to book a 15-minute call with our agent. Does tomorrow at 3 PM work?" },
      { role: 'caller', text: "3 PM tomorrow works." },
      { role: 'ai',     text: "Perfect! I've booked you with Agent Rivera for tomorrow at 3 PM. You'll get a calendar invite with a call-in number. Anything else?" },
      { role: 'caller', text: "No, that covers it. Thanks." },
      { role: 'ai',     text: "Talk to you tomorrow, James. Have a great day!" },
    ],
  },

  // ── Legal ─────────────────────────────────────────────────
  {
    id: 'legal_en_intake',
    title: 'New Case Intake',
    scenario: 'Potential client calls after hours — AI qualifies and books',
    lang: 'en',
    vertical: 'legal',
    durationLabel: '~55s',
    lines: [
      { role: 'ai',     text: "Thank you for calling Smith and Associates Law. This is Aria, the AI assistant. I can help you get started — is this regarding a new matter?" },
      { role: 'caller', text: "Yes, I was just in a car accident and I need to talk to someone." },
      { role: 'ai',     text: "I'm sorry to hear that. Our attorneys handle personal injury cases, and I can schedule a free consultation for you. First, were you injured in the accident?" },
      { role: 'caller', text: "Yes, I hurt my back. The other driver ran a red light." },
      { role: 'ai',     text: "I understand. That sounds like a case our team would want to review. Can I get your name to schedule a consultation?" },
      { role: 'caller', text: "It's Maria Lopez." },
      { role: 'ai',     text: "Thank you Maria. I can book you for a free 30-minute consultation tomorrow at 10 AM or 2 PM — which works better?" },
      { role: 'caller', text: "10 AM please." },
      { role: 'ai',     text: "Done! You're booked for tomorrow at 10 AM. You'll receive a confirmation text shortly. An attorney will review your case details before the call." },
    ],
  },

  // ── Real Estate ───────────────────────────────────────────
  {
    id: 'real_estate_en_showing',
    title: 'Showing Request',
    scenario: 'Buyer lead requests a showing — AI schedules instantly',
    lang: 'en',
    vertical: 'real_estate',
    durationLabel: '~45s',
    lines: [
      { role: 'ai',     text: "Hi, this is Aria from Horizon Realty. I saw you inquired about the property on 42 Maple Street. Are you still interested in scheduling a showing?" },
      { role: 'caller', text: "Yes! I've been looking at it online. Is it still available?" },
      { role: 'ai',     text: "Great news — it's still active! The listing is a 3-bed, 2-bath at $485,000. I can book a showing directly — are you flexible this weekend?" },
      { role: 'caller', text: "Saturday afternoon would be perfect." },
      { role: 'ai',     text: "I have Saturday at 2 PM available with Agent Kim. Does that work?" },
      { role: 'caller', text: "Yes, that's great." },
      { role: 'ai',     text: "Confirmed! You're booked for Saturday at 2 PM at 42 Maple Street. Agent Kim will meet you there. I'll send a confirmation to your number." },
      { role: 'caller', text: "Awesome, thank you!" },
      { role: 'ai',     text: "Looking forward to it! See you Saturday." },
    ],
  },

  // ── Home Services ─────────────────────────────────────────
  {
    id: 'home_services_en_booking',
    title: 'Job Booking',
    scenario: 'Homeowner calls for HVAC repair — AI books the appointment',
    lang: 'en',
    vertical: 'home_services',
    durationLabel: '~40s',
    lines: [
      { role: 'ai',     text: "Thanks for calling ProFix Home Services! This is Aria. What can I help you with today?" },
      { role: 'caller', text: "My AC stopped working and it's 90 degrees in here. Can you send someone?" },
      { role: 'ai',     text: "Absolutely, I can get a technician out to you. Is this a residential property? And are you available today or would tomorrow morning work?" },
      { role: 'caller', text: "Today if possible — it's really hot." },
      { role: 'ai',     text: "I have a technician available this afternoon between 3 and 5 PM. Does that window work for you?" },
      { role: 'caller', text: "Yes, perfect." },
      { role: 'ai',     text: "Great! I've booked you for today between 3 and 5 PM. You'll get a text when the tech is 30 minutes out. What's the best number to reach you?" },
      { role: 'caller', text: "555-867-5309." },
      { role: 'ai',     text: "Got it! You're all set. Our technician will see you this afternoon." },
    ],
  },

  // ── Generic ───────────────────────────────────────────────
  {
    id: 'generic_en_receptionist',
    title: 'Inbound Call',
    scenario: 'Caller inquires and books an appointment',
    lang: 'en',
    vertical: 'generic',
    durationLabel: '~40s',
    lines: [
      { role: 'ai',     text: "Thank you for calling! This is Aria, the AI assistant. How can I help you today?" },
      { role: 'caller', text: "Hi, I'd like to schedule an appointment." },
      { role: 'ai',     text: "I'd be happy to help with that! Do you have a preference for date and time?" },
      { role: 'caller', text: "Sometime next week, maybe Tuesday or Wednesday morning." },
      { role: 'ai',     text: "I have Tuesday at 10 AM or Wednesday at 9 AM available. Which works better for you?" },
      { role: 'caller', text: "Tuesday at 10 works great." },
      { role: 'ai',     text: "Perfect! I've booked you for Tuesday at 10 AM. You'll receive a confirmation text shortly. Is there anything else I can help you with?" },
      { role: 'caller', text: "No, that's everything. Thanks!" },
      { role: 'ai',     text: "You're all set! We'll see you Tuesday. Have a wonderful day!" },
    ],
  },
];
