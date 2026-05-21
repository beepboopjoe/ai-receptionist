// ============================================================
// /inbound — Public marketing page positioning the AI receptionist
// for inbound call answering. Mirrors /outbound's warm cream +
// terracotta + serif theme and section structure exactly so the
// pair feels intentional. No auth, no sidebar — uses root layout.
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Phone, ShieldCheck, Sparkles, Moon, Globe, MessageSquare, Clock, Reply } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';

// Lazy-load — TTS audio code shouldn't block initial paint.
const SampleCallPlayer = dynamic(
  () => import('@/components/ui/sample-call-player').then((m) => m.SampleCallPlayer),
  { ssr: false }
);
const VoiceLanguageDemo = dynamic(
  () => import('@/components/ui/voice-language-demo').then((m) => m.VoiceLanguageDemo),
  { ssr: false }
);
const DashboardTeaser = dynamic(
  () => import('@/components/ui/dashboard-teaser').then((m) => m.DashboardTeaser),
  { ssr: false }
);

export const metadata = {
  title: 'AI Receptionist — answer every call, 24/7',
  description:
    'Your AI receptionist answers every inbound call, books appointments, and qualifies leads — in English and Spanish, around the clock.',
};

const USE_CASES = [
  {
    title: 'Appointment Booking',
    bookingRange: '85–94%',
    sample:
      '"Hi! Thanks for calling [Your Business Name]. I\'d be happy to book that for you — would Tuesday at 10 or Thursday at 2 work better?"',
    bullets: [
      'Reads your live calendar availability',
      'Books straight into Google or Outlook',
      'Sends SMS confirmation in seconds',
    ],
  },
  {
    title: 'After-Hours Coverage',
    bookingRange: '24/7',
    sample:
      '"Thanks for calling — our team is closed for the day, but I can take down details and book you for tomorrow at 9 AM if you\'d like."',
    bullets: [
      'Answers nights, weekends, holidays',
      'Books real appointments, not voicemails',
      'Escalates urgent calls via SMS to staff',
    ],
  },
  {
    title: 'Spanish Bilingual',
    bookingRange: '~22%',
    sample:
      '"Hola, gracias por llamar. ¿Le gustaría agendar una cita para esta semana? Tenemos disponibilidad el martes a las dos."',
    bullets: [
      'Detects caller language automatically',
      'Switches between English and Spanish mid-call',
      'No extra charge — included on every plan',
    ],
  },
];

const QUALITY = [
  {
    title: 'Sounds like a real receptionist',
    desc: 'xAI Grok\'s latest voice model — natural cadence, conversational pauses, handles interruption. Most callers don\'t realize it\'s AI.',
  },
  {
    title: 'No hold music',
    desc: 'Average answer time under 2 seconds. The AI picks up on the first ring, every ring. No voicemail tag, no "press 1 for…".',
  },
  {
    title: 'Books on the spot',
    desc: 'Reads your live calendar, offers real openings, and writes the appointment back. No "we\'ll call you to confirm" handoff.',
  },
  {
    title: 'Full transcripts + recordings',
    desc: 'Every call is transcribed and recorded with caller consent. Searchable from your dashboard. Webhooks fire for every booking.',
  },
];

export default function InboundPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mesh-gradient-light pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            AI receptionist — for any appointment-based business
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight leading-[1.05]">
            Voicemail loses the customer.
            <br />
            <span className="gradient-text">Your AI never misses a call.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Your AI answers every inbound call — day, night, weekends, holidays —
            books appointments straight into your calendar, and switches to Spanish
            automatically when the caller does.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing#plans"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              See plans &amp; pricing →
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-800 bg-white border border-cream-200 rounded-xl hover:bg-cream-50 transition-colors"
            >
              Try it live →
            </Link>
          </div>
          <p className="text-xs text-cream-500 mt-5">
            Included on every plan · Pay monthly or annual · No contracts
          </p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Five seconds from ring to booking.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { n: '1', title: 'Caller dials your number', desc: 'Either your existing line (forwarded) or a number we provision for you.' },
              { n: '2', title: 'AI picks up immediately', desc: 'Under 2 seconds. Greets in English, switches to Spanish if the caller does.' },
              { n: '3', title: 'Books straight to calendar', desc: 'Reads your live availability, offers real openings, writes the appointment.' },
              { n: '4', title: 'You see it in the dashboard', desc: 'Recording, transcript, and structured data — pushed to your CRM via webhook.' },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-cream-50 border border-cream-200 p-6">
                <div className="w-9 h-9 rounded-full bg-brand-600 text-white font-serif flex items-center justify-center mb-3">
                  {s.n}
                </div>
                <h3 className="font-semibold text-cream-900">{s.title}</h3>
                <p className="text-sm text-cream-600 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard preview ─────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <DashboardTeaser />
        </div>
      </section>

      {/* ── Use cases ─────────────────────────────────────── */}
      <section className="bg-cream-100 py-20 px-6 border-b border-cream-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">What it handles</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Three use cases, one AI receptionist.
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              All three run on every plan, on the same phone number. No upsell wall.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {USE_CASES.map((c) => (
              <div key={c.title} className="rounded-2xl bg-white border border-cream-200 p-7 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">{c.title}</h3>
                </div>
                <div className="rounded-xl bg-cream-50 border border-cream-200 p-4 mb-4">
                  <p className="text-[10px] font-semibold text-cream-500 uppercase tracking-wider mb-2">Sample script</p>
                  <p className="text-sm text-cream-800 italic leading-relaxed">{c.sample}</p>
                </div>
                <ul className="space-y-2 mb-5 flex-1">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-cream-700">
                      <CheckCircle size={15} className="text-brand-500 shrink-0 mt-0.5" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-cream-200 flex items-center justify-between">
                  <span className="text-xs text-cream-500">Booking / availability</span>
                  <span className="font-serif text-xl text-cream-900">{c.bookingRange}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quality / what makes ours different ────────── */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-cream-100 border border-cream-200 text-cream-700 text-xs font-semibold px-4 py-2 rounded-full mb-5">
            <ShieldCheck size={13} className="text-brand-600" />
            Built like a real receptionist
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Inbound that won&apos;t embarrass your business.
          </h2>
          <p className="text-cream-600 mt-3 max-w-2xl mx-auto leading-relaxed">
            Every call sounds like someone who actually works there. Callers thank the AI by name.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {QUALITY.map((q) => (
            <div key={q.title} className="rounded-2xl bg-white border border-cream-200 p-6 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} className="text-brand-600" />
              </div>
              <div>
                <h3 className="font-semibold text-cream-900">{q.title}</h3>
                <p className="text-sm text-cream-600 mt-1.5 leading-relaxed">{q.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Industries ────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-4">
        <div className="rounded-2xl bg-brand-50 border border-brand-100 p-7">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-4">Which industries we cover</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { emoji: '🦷', label: 'Dental', desc: 'New patient intake, recall, emergencies' },
              { emoji: '⚖️', label: 'Law Firms', desc: 'Case intake + qualification, after-hours' },
              { emoji: '🏠', label: 'Real Estate', desc: 'Buyer/seller inquiries, showing requests' },
              { emoji: '🏘️', label: 'Home Services', desc: 'HVAC / plumbing dispatch, emergency calls' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-1">
                <span className="text-2xl">{item.emoji}</span>
                <p className="font-semibold text-cream-900 text-sm">{item.label}</p>
                <p className="text-xs text-cream-600 leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Audio Samples (secondary fallback) ─────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-12 pt-12">
        <div className="text-center mb-6">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-2">Hear the voice</p>
          <h2 className="font-serif text-3xl text-cream-900 tracking-tight">Audio samples</h2>
          <p className="text-cream-600 mt-2 text-sm">If you'd rather just hear it — same scripts, audio only.</p>
        </div>
        <SampleCallPlayer callType="inbound" />
      </section>

      {/* ── Voice × Language demo ───────────────────────── */}
      <section className="py-16 bg-cream-50 border-t border-cream-200">
        <VoiceLanguageDemo />
      </section>

      {/* ── SMS follow-up section ─────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Every call gets a text</p>
          <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
            Every call gets a text follow-up.
          </h2>
          <p className="text-cream-600 mt-3 max-w-2xl mx-auto leading-relaxed">
            Built-in SMS handles the moments your voice AI can&apos;t reach. Included on every paid plan — sent from your business number.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Reply,
              title: 'Missed-call text-back',
              desc: 'If a caller hangs up before the AI can help, they get a text within 10 seconds: "We missed you — how can we help?"',
              tag: 'Under 10s',
            },
            {
              icon: Clock,
              title: 'Appointment reminders',
              desc: 'Automated reminders at 24 hours and 2 hours before every booked appointment. Reply CONFIRM or CANCEL to manage the booking.',
              tag: '24h + 2h',
            },
            {
              icon: MessageSquare,
              title: 'Two-way SMS inbox',
              desc: 'Your team picks up the thread right where the AI left off — full history, one inbox, sent from the same number callers already know.',
              tag: 'Shared inbox',
            },
          ].map(({ icon: Icon, title, desc, tag }) => (
            <div key={title} className="rounded-2xl bg-white border border-cream-200 p-7">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <Icon size={20} className="text-indigo-600" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                  {tag}
                </span>
              </div>
              <h3 className="font-serif text-xl text-cream-900 mb-2">{title}</h3>
              <p className="text-sm text-cream-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Phone bubble illustration */}
        <div className="mt-12 max-w-md mx-auto rounded-3xl bg-cream-50 border border-cream-200 p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-3 text-center">
            Sample missed-call text-back
          </p>
          <div className="flex justify-start mb-2">
            <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm max-w-[80%] leading-relaxed">
              Hi! We missed your call at Downtown Dental. How can we help? Reply here or call us back anytime.
            </div>
          </div>
          <div className="flex justify-end mb-2">
            <div className="bg-brand-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm max-w-[80%] leading-relaxed">
              I&apos;d like to book a cleaning for next week
            </div>
          </div>
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm max-w-[80%] leading-relaxed">
              Done — Tuesday at 10 AM works. Reply CONFIRM to lock it in.
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/pricing#plans"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
          >
            See plans →
          </Link>
        </div>
      </section>

      {/* ── After-hours value strip ─────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-cream-100 border border-cream-200 p-6 flex gap-4">
          <Moon size={20} className="text-brand-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-cream-900">Your AI never sleeps.</p>
            <p className="text-sm text-cream-700 mt-1.5 leading-relaxed">
              No coverage gaps. No off-hours voicemail. The same AI that answers Tuesday at 10 AM picks up Sunday at midnight — same quality, same booking flow, same calendar writes.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing CTA ──────────────────────────────── */}
      <section className="bg-cream-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight">
            Inbound + SMS included on every plan.
          </h2>
          <p className="text-cream-300 mt-4 max-w-xl mx-auto">
            Starter ($79/mo) covers 200 minutes. Growth ($199/mo) adds outbound campaigns and 750 minutes. Scale ($399/mo) handles 1,500. Bilingual + SMS + transcripts included on all of them.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing#plans"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              <Phone size={15} /> Choose your plan
            </Link>
            <Link
              href="/pricing#compare"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-100 border border-white/20 rounded-xl hover:bg-white/5 transition-colors"
            >
              Compare all plans →
            </Link>
          </div>
          <p className="text-xs text-cream-400 mt-5">
            Pay monthly or annual · Cancel anytime · 30-day money-back guarantee
          </p>
        </div>
      </section>

      {/* ── Cross-link to /outbound ──────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/outbound"
          className="block rounded-2xl bg-white border border-cream-200 p-6 hover:border-brand-300 transition-colors group"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-1">Looking for outbound?</p>
              <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Same AI runs your outbound campaigns →</h3>
              <p className="text-sm text-cream-600 mt-1.5">Inactive contact reactivation, lead follow-up, recall reminders. Books real appointments while your team handles the people in front of them.</p>
            </div>
            <Globe size={28} className="text-brand-600 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
