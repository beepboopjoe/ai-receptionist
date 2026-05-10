'use client';
// ============================================================
// SampleCallPlayer — Pre-scripted call demo, multi-vertical
// Uses Web Speech API (built into every modern browser, zero API
// key required) to read lines aloud while revealing the
// transcript one line at a time.
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { Vertical } from '@/lib/verticals';

interface CallLine {
  role: 'ai' | 'caller';
  text: string;
}

interface SampleCall {
  id: string;
  title: string;
  scenario: string;
  lang: 'en' | 'es';
  vertical: Vertical;
  durationLabel: string;
  lines: CallLine[];
}

// ── Pre-scripted call dialogues ───────────────────────────────
const SAMPLE_CALLS: SampleCall[] = [
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
      { role: 'ai',     text: "Thank you for calling Smith & Associates Law. This is Aria, the AI assistant. I can help you get started — is this regarding a new matter?" },
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

// Approx reading speed multiplier (lower = faster)
const RATE_AI = 0.92;
const RATE_CALLER = 1.0;

// ── Individual call card ──────────────────────────────────────
function CallCard({ call, dark = false }: { call: SampleCall; dark?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const lineIndexRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelledRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setTtsAvailable(false);
    }
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleLines]);

  const speakLine = useCallback((index: number) => {
    if (cancelledRef.current || index >= call.lines.length) {
      setPlaying(false);
      return;
    }

    const line = call.lines[index]!;
    setVisibleLines(index + 1);

    if (!ttsAvailable) {
      setTimeout(() => {
        lineIndexRef.current = index + 1;
        speakLine(index + 1);
      }, 900 + line.text.length * 25);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = call.lang === 'es' ? 'es-ES' : 'en-US';
    utterance.rate = line.role === 'ai' ? RATE_AI : RATE_CALLER;
    utterance.pitch = line.role === 'ai' ? 1.05 : 1.0;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = call.lang === 'es' ? 'es' : 'en';
    const match = voices.find(v => v.lang.startsWith(langPrefix) && v.localService) ??
                  voices.find(v => v.lang.startsWith(langPrefix));
    if (match) utterance.voice = match;

    utterance.onend = () => {
      if (!cancelledRef.current) {
        lineIndexRef.current = index + 1;
        setTimeout(() => speakLine(index + 1), line.role === 'caller' ? 300 : 150);
      }
    };
    utterance.onerror = () => {
      if (!cancelledRef.current) speakLine(index + 1);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [call, ttsAvailable]);

  const handlePlay = useCallback(() => {
    cancelledRef.current = false;
    lineIndexRef.current = 0;
    setVisibleLines(0);
    setPlaying(true);

    if (ttsAvailable) {
      const tryPlay = () => {
        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            speakLine(0);
          };
        } else {
          speakLine(0);
        }
      };
      tryPlay();
    } else {
      speakLine(0);
    }
  }, [ttsAvailable, speakLine]);

  const handlePause = useCallback(() => {
    cancelledRef.current = true;
    if (ttsAvailable) window.speechSynthesis.cancel();
    setPlaying(false);
  }, [ttsAvailable]);

  const handleReset = useCallback(() => {
    cancelledRef.current = true;
    if (ttsAvailable) window.speechSynthesis.cancel();
    setPlaying(false);
    setVisibleLines(0);
    lineIndexRef.current = 0;
  }, [ttsAvailable]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const bg = dark
    ? 'bg-white/5 border-white/10 text-white'
    : 'bg-white border-cream-200 text-cream-900';
  const headerBg = dark ? 'border-white/10' : 'border-cream-200';
  const mutedText = dark ? 'text-white/40' : 'text-cream-500';
  const transcriptBg = dark ? 'bg-black/30 border-white/5' : 'bg-cream-50 border-cream-200';

  return (
    <div className={`rounded-2xl border overflow-hidden ${bg}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${headerBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg shrink-0">{call.lang === 'en' ? '🇺🇸' : '🇪🇸'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${dark ? 'text-brand-400' : 'text-brand-600'}`}>
                Sample Call
              </p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-white/10 text-white/50' : 'bg-cream-100 text-cream-500'}`}>
                {call.durationLabel}
              </span>
            </div>
            <p className={`text-sm font-semibold mt-0.5 truncate ${dark ? 'text-white' : 'text-cream-900'}`}>{call.title}</p>
            <p className={`text-xs truncate ${mutedText}`}>{call.scenario}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {visibleLines > 0 && (
            <button
              onClick={handleReset}
              className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-white/10 text-white/50 hover:text-white' : 'hover:bg-cream-100 text-cream-500 hover:text-cream-800'}`}
              title="Reset"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            onClick={playing ? handlePause : handlePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? 'Pause' : visibleLines > 0 ? 'Resume' : 'Play'}
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className={`p-4 max-h-56 overflow-y-auto rounded-b-xl ${transcriptBg}`}>
        {visibleLines === 0 ? (
          <p className={`text-xs text-center py-4 ${mutedText}`}>
            {ttsAvailable ? '▶ Press Play to hear this call' : '▶ Press Play to read this call'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {call.lines.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${line.role === 'caller' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'fadeIn 0.3s ease' }}
              >
                {line.role === 'ai' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold bg-brand-600 text-white">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    line.role === 'ai'
                      ? dark ? 'bg-brand-600/20 text-brand-200' : 'bg-brand-50 text-brand-900 border border-brand-100'
                      : dark ? 'bg-white/10 text-white/70' : 'bg-white text-cream-700 border border-cream-200'
                  }`}
                >
                  {line.text}
                </div>
                {line.role === 'caller' && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${dark ? 'bg-white/20 text-white/70' : 'bg-cream-200 text-cream-700'}`}>
                    You
                  </div>
                )}
              </div>
            ))}
            {playing && visibleLines < call.lines.length && (
              <div className="flex gap-1 pl-8 py-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand-400"
                    style={{ animation: `pulse 1s ease ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────
export function SampleCallPlayer({
  dark = false,
  singleLang,
  vertical,
}: {
  dark?: boolean;
  /** If provided, only show calls for this language */
  singleLang?: 'en' | 'es';
  /** If provided, show calls for this vertical only */
  vertical?: Vertical;
}) {
  let calls = SAMPLE_CALLS;
  if (vertical) calls = calls.filter(c => c.vertical === vertical);
  if (singleLang) calls = calls.filter(c => c.lang === singleLang);

  // If no scripts match (e.g. Spanish requested for a vertical with only English
  // scripts), fall back to the same vertical in any language before falling
  // back to a generic English script — never show a dental script while the
  // user has Real Estate or Legal selected.
  if (calls.length === 0 && vertical) {
    calls = SAMPLE_CALLS.filter(c => c.vertical === vertical);
  }
  if (calls.length === 0) {
    calls = SAMPLE_CALLS.filter(c => c.vertical === 'generic' && (!singleLang || c.lang === singleLang));
  }
  if (calls.length === 0) {
    calls = SAMPLE_CALLS.filter(c => c.vertical === 'generic');
  }

  return (
    <div className={`grid grid-cols-1 ${calls.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
      {calls.map(call => (
        <CallCard key={call.id} call={call} dark={dark} />
      ))}
    </div>
  );
}
