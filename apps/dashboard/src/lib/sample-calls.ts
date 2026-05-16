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
  callType: 'inbound' | 'outbound';
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
    callType: 'inbound',
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
    callType: 'inbound',
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
    callType: 'inbound',
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
    callType: 'inbound',
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
    callType: 'inbound',
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
    callType: 'inbound',
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

  // ── Generic inbound ───────────────────────────────────────
  {
    id: 'generic_en_receptionist',
    title: 'Inbound Call',
    scenario: 'Caller inquires and books an appointment',
    lang: 'en',
    vertical: 'generic',
    durationLabel: '~40s',
    callType: 'inbound',
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

  // ── Insurance (Spanish) ───────────────────────────────────
  {
    id: 'insurance_es_consulta',
    title: 'Consulta de Seguro',
    scenario: 'Cliente solicita cotización — el AI agenda la consulta',
    lang: 'es',
    vertical: 'insurance',
    durationLabel: '~45s',
    callType: 'inbound',
    lines: [
      { role: 'ai',     text: "Hola, habla Aria de Apex Insurance Group. ¿Estoy hablando con Elena García?" },
      { role: 'caller', text: "Sí, soy yo." },
      { role: 'ai',     text: "¡Hola Elena! Veo que solicitó una cotización para seguro de auto esta semana. Me gustaría agendar una llamada rápida con uno de nuestros agentes para darle los mejores precios. ¿Tiene disponibilidad mañana por la tarde?" },
      { role: 'caller', text: "Sí, en la tarde está bien." },
      { role: 'ai',     text: "Perfecto. La agendo para mañana a las tres de la tarde con el agente Martínez. Le llegará una confirmación por mensaje de texto. ¿Tiene alguna pregunta?" },
      { role: 'caller', text: "No, muchas gracias." },
      { role: 'ai',     text: "¡Con gusto, Elena! Hasta mañana." },
    ],
  },

  // ── Legal (Spanish) ────────────────────────────────────────
  {
    id: 'legal_es_consulta',
    title: 'Consulta Legal',
    scenario: 'Nuevo cliente llama para asesoría — el AI califica y agenda',
    lang: 'es',
    vertical: 'legal',
    durationLabel: '~50s',
    callType: 'inbound',
    lines: [
      { role: 'ai',     text: "Gracias por llamar a Smith y Asociados. Soy Aria, la asistente de IA. ¿En qué le puedo ayudar hoy?" },
      { role: 'caller', text: "Hola, tuve un accidente de auto y quisiera hablar con un abogado." },
      { role: 'ai',     text: "Lo siento mucho. Nuestros abogados se especializan en accidentes de tráfico y podemos agendar una consulta gratuita. ¿Resultó usted lesionado en el accidente?" },
      { role: 'caller', text: "Sí, me lastimé el cuello. El otro conductor se pasó la luz roja." },
      { role: 'ai',     text: "Entiendo, eso suena como un caso que nuestro equipo querría revisar. ¿Puedo tomar su nombre para agendar la consulta?" },
      { role: 'caller', text: "Soy Roberto Sánchez." },
      { role: 'ai',     text: "Gracias Roberto. Tengo disponible mañana a las diez de la mañana o a las dos de la tarde. ¿Cuál le funciona mejor?" },
      { role: 'caller', text: "Las diez está bien." },
      { role: 'ai',     text: "¡Perfecto! Lo agendo para mañana a las diez. Recibirá un mensaje de confirmación pronto. ¡Hasta mañana, Roberto!" },
    ],
  },

  // ── Home Services (Spanish) ──────────────────────────────────
  {
    id: 'home_services_es_servicio',
    title: 'Solicitud de Servicio',
    scenario: 'Propietario llama por reparación de AC — el AI agenda',
    lang: 'es',
    vertical: 'home_services',
    durationLabel: '~40s',
    callType: 'inbound',
    lines: [
      { role: 'ai',     text: "¡Gracias por llamar a ProFix! Soy Aria. ¿En qué le puedo ayudar hoy?" },
      { role: 'caller', text: "Mi aire acondicionado no está funcionando y hace mucho calor." },
      { role: 'ai',     text: "Entiendo, eso es urgente. Puedo enviarle un técnico hoy mismo. ¿Es una casa o apartamento? ¿Y está disponible esta tarde?" },
      { role: 'caller', text: "Es casa, y sí, puedo estar en la tarde." },
      { role: 'ai',     text: "Tengo un técnico disponible hoy entre las tres y las cinco de la tarde. ¿Le funciona ese horario?" },
      { role: 'caller', text: "Sí, perfecto." },
      { role: 'ai',     text: "¡Listo! Lo agendé para hoy de tres a cinco. Le avisaremos por mensaje cuando el técnico esté en camino. ¡Que pase buen día!" },
    ],
  },

  // ── Real Estate (Spanish) ────────────────────────────────────
  {
    id: 'real_estate_es_visita',
    title: 'Solicitud de Visita',
    scenario: 'Comprador pide ver una propiedad — el AI agenda al instante',
    lang: 'es',
    vertical: 'real_estate',
    durationLabel: '~40s',
    callType: 'inbound',
    lines: [
      { role: 'ai',     text: "Hola, habla Aria de Horizon Realty. Vi que se interesó en la propiedad de la Calle Maple 42. ¿Sigue disponible para agendar una visita?" },
      { role: 'caller', text: "Sí, quiero verla. ¿Todavía está disponible?" },
      { role: 'ai',     text: "¡Claro que sí! La propiedad sigue activa. Tengo disponibilidad este sábado por la tarde con la agente Kim. ¿Le funciona a las dos?" },
      { role: 'caller', text: "Sí, el sábado a las dos está perfecto." },
      { role: 'ai',     text: "¡Confirmado! Lo agendo para el sábado a las dos de la tarde en Calle Maple 42. La agente Kim lo estará esperando. Le enviaré la confirmación en un momento." },
      { role: 'caller', text: "Muchas gracias." },
      { role: 'ai',     text: "¡Con gusto! Nos vemos el sábado." },
    ],
  },

  // ── Outbound — Inactive Contact Reactivation ──────────────
  {
    id: 'outbound_en_reactivation',
    title: 'Inactive Contact Reactivation',
    scenario: 'AI reaches out to a contact who hasn\'t been in for months',
    lang: 'en',
    vertical: 'generic',
    durationLabel: '~45s',
    callType: 'outbound',
    lines: [
      { role: 'ai',     text: "Hi Emma, this is Aria calling from [Your Business Name]. I noticed it's been a while since we last connected — we'd love to get you back in. Do you have any availability this week or next?" },
      { role: 'caller', text: "Oh hi! Yeah, it has been a while. What days do you have open?" },
      { role: 'ai',     text: "We have Tuesday at 10 AM or Thursday at 2 PM available right now. Which works better for you?" },
      { role: 'caller', text: "Thursday at 2 works for me." },
      { role: 'ai',     text: "Perfect — I've got you booked for Thursday at 2 PM. You'll get a confirmation text shortly. We look forward to seeing you, Emma!" },
      { role: 'caller', text: "Great, thank you!" },
      { role: 'ai',     text: "Of course! Have a wonderful rest of your day." },
    ],
  },

  // ── Outbound — Lead Follow-Up ─────────────────────────────
  {
    id: 'outbound_en_lead_followup',
    title: 'Lead Follow-Up',
    scenario: 'AI follows up on an unbooked lead who expressed interest',
    lang: 'en',
    vertical: 'generic',
    durationLabel: '~50s',
    callType: 'outbound',
    lines: [
      { role: 'ai',     text: "Hi Michael, this is Aria from [Your Business Name]. You reached out last week about scheduling a consultation — I just wanted to follow up and see if you'd like to get that on the calendar." },
      { role: 'caller', text: "Yes actually — I've been meaning to call back." },
      { role: 'ai',     text: "Great timing! I have a few openings this week — Wednesday at 11 AM or Friday at 3 PM. Would either of those work for you?" },
      { role: 'caller', text: "Wednesday at 11 is perfect." },
      { role: 'ai',     text: "Wonderful — I've confirmed you for Wednesday at 11 AM. Is this the best number to send your reminder to?" },
      { role: 'caller', text: "Yes, this is fine." },
      { role: 'ai',     text: "You're all set. We'll send a reminder the evening before. See you Wednesday, Michael!" },
    ],
  },

  // ── Outbound — Appointment Recall ─────────────────────────
  {
    id: 'outbound_en_recall',
    title: 'Appointment Recall',
    scenario: 'AI calls a contact who is overdue for their scheduled follow-up',
    lang: 'en',
    vertical: 'generic',
    durationLabel: '~40s',
    callType: 'outbound',
    lines: [
      { role: 'ai',     text: "Hi Sarah, this is Aria from [Your Business Name]. I'm calling because you're coming up on your scheduled follow-up and we want to make sure we get you in on time. Would Tuesday at 2 PM work, or is morning better for you?" },
      { role: 'caller', text: "Morning is better. Do you have anything around 9?" },
      { role: 'ai',     text: "I have Tuesday at 9 AM available. Should I go ahead and book that for you?" },
      { role: 'caller', text: "Yes please." },
      { role: 'ai',     text: "Done — Tuesday at 9 AM is confirmed. You'll get a text reminder the evening before. Thanks, Sarah — we'll see you then!" },
    ],
  },
];
