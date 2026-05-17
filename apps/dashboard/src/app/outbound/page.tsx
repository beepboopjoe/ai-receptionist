// ============================================================
// /outbound — Public marketing page positioning AI outbound
// calling as the practice's reactivation engine. Uses the
// new warm theme (cream + terracotta + serif headings).
// No auth, no sidebar — uses the root layout.
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Phone, ShieldCheck, Sparkles, AlertCircle, MessageSquare, Clock, Bell } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { CampaignFlowDiagram } from '@/components/ui/campaign-flow-diagram';
import { BRAND_NAME } from '@/lib/brand';

// SampleCallPlayer uses Web Speech API at click-time. Lazy-load it
// so the marketing page's first paint isn't blocked on its TTS code.
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
  title: 'AI Outbound Calling — book more appointments automatically',
  description:
    'Reactivate inactive contacts, follow up on leads, and run recall campaigns — all on autopilot. AI outbound for any appointment-based business.',
};

const CAMPAIGN_TYPES = [
  {
    title: 'Inactive Contact Reactivation',
    bookingRange: '6–11%',
    sample: '"Hi Emma, this is Aria from [Your Business Name]. It\'s been a while since your last visit — we\'d love to get you back in. Do you have any availability this week?"',
    bullets: [
      'Contacts inactive 3–24+ months',
      'Lower-pressure, friendly tone',
      'Opt-out detected automatically',
    ],
  },
  {
    title: 'Lead Follow-Up',
    bookingRange: '20–28%',
    sample: '"Hi Michael — you reached out last week about scheduling a consultation. I have a few openings this week if you\'d like to get it on the calendar."',
    bullets: [
      'Leads who expressed interest but didn\'t book',
      'Highest-value campaign type',
      'References original inquiry automatically',
    ],
  },
  {
    title: 'Appointment Reminders & Recall',
    bookingRange: '12–18%',
    sample: '"Hi Sarah, this is Aria from [Your Business Name]. I noticed you\'re overdue for a follow-up — would Tuesday at 2 work, or is morning better?"',
    bullets: [
      'Contacts past their scheduled return window',
      'Polite, single-call outreach',
      'Reschedule-friendly fallback',
    ],
  },
];

const COMPLIANCE = [
  {
    title: 'TCPA-aware',
    desc: 'Calls only to existing contact relationships during legal calling windows. Time-zone aware, holiday aware, do-not-call list aware.',
  },
  {
    title: 'Opt-out handled in conversation',
    desc: 'If a contact says "stop calling" or "remove me," the AI confirms, exits gracefully, and flags them in your CRM. No second call.',
  },
  {
    title: 'Recorded with consent',
    desc: 'Every call is recorded and transcribed, with consent disclosed at the start. Stored encrypted, accessible from your dashboard.',
  },
  {
    title: 'Voicemail done right',
    desc: 'When a machine picks up, the AI leaves a tailored 15-second message — your business name, why we called, and a callback number. No robocall script.',
  },
];

export default function OutboundPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mesh-gradient-light pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            AI outbound calling — for any appointment-based business
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight leading-[1.05]">
            Inbound is table stakes.
            <br />
            <span className="gradient-text">Outbound fills the calendar.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Your AI calls inactive contacts, follows up on unbooked leads,
            and runs recall campaigns — booking real appointments while your team
            handles the people in front of them.
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
            Included on Growth and Scale plans · Pay monthly or annual · No contracts
          </p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <CampaignFlowDiagram />

      {/* ── Three campaign types ──────────────────────────── */}
      <section className="bg-cream-100 py-20 px-6 border-y border-cream-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Campaign types</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Three campaigns, running on their own.
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              Each one tuned for a different contact relationship. Mix and match — or run all three.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CAMPAIGN_TYPES.map((c) => (
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
                  <span className="text-xs text-cream-500">Typical booking rate</span>
                  <span className="font-serif text-xl text-cream-900">{c.bookingRange}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-cream-100 border border-cream-200 text-cream-700 text-xs font-semibold px-4 py-2 rounded-full mb-5">
            <ShieldCheck size={13} className="text-brand-600" />
            Built like a real receptionist, not a robocaller
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Outbound that won&apos;t embarrass your business.
          </h2>
          <p className="text-cream-600 mt-3 max-w-2xl mx-auto leading-relaxed">
            Every call sounds like someone who actually works there. Callers hang up surprised — not annoyed.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {COMPLIANCE.map((c) => (
            <div key={c.title} className="rounded-2xl bg-white border border-cream-200 p-6 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} className="text-brand-600" />
              </div>
              <div>
                <h3 className="font-semibold text-cream-900">{c.title}</h3>
                <p className="text-sm text-cream-600 mt-1.5 leading-relaxed">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who uses outbound ─────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-4">
        <div className="rounded-2xl bg-brand-50 border border-brand-100 p-7">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-4">Which industries use outbound?</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { emoji: '📋', label: 'Insurance', desc: 'Quote follow-ups and policy renewal reminders' },
              { emoji: '⚖️', label: 'Law Firms', desc: 'Lead follow-up and consultation booking' },
              { emoji: '🏠', label: 'Real Estate', desc: 'Showing scheduling and buyer/seller follow-up' },
              { emoji: '🦷', label: 'Healthcare', desc: 'Patient recalls and treatment plan follow-ups' },
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


      {/* ── Dashboard preview ─────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">What you get inside</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Outbound campaigns. Booked appointments. One dashboard.
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              Live campaign progress, every dial logged, every booked appointment pushed to your calendar.
            </p>
          </div>
          <DashboardTeaser />
        </div>
      </section>

      {/* ── Audio Samples (outbound) ─────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-12 pt-12">
        <div className="text-center mb-6">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-2">Hear an outbound call</p>
          <h2 className="font-serif text-3xl text-cream-900 tracking-tight">Three campaign types. Hear exactly how it sounds.</h2>
          <p className="text-cream-600 mt-2 text-sm">Reactivation, lead follow-up, and recall — real AI, real conversation flow.</p>
        </div>
        <SampleCallPlayer callType="outbound" />
      </section>

      {/* ── Voice × Language demo ───────────────────────── */}
      <section className="py-16 bg-cream-50 border-t border-cream-200">
        <VoiceLanguageDemo />
      </section>

      {/* ── SMS reminders + outbound texting ─────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Outbound isn&apos;t just calls</p>
          <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
            Every booking gets a text — automatically.
          </h2>
          <p className="text-cream-600 mt-3 max-w-2xl mx-auto leading-relaxed">
            Appointment reminders fire 24 hours and 2 hours before every booked slot. Two-way replies route to the same inbox your team is already using. Included on every plan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            {
              icon: Bell,
              title: '24-hour reminder',
              desc: 'Confirms the appointment the day before. Reply CONFIRM and the AI logs it; reply CANCEL and the slot reopens.',
              tag: 'T-24h',
            },
            {
              icon: Clock,
              title: '2-hour reminder',
              desc: 'Quick nudge two hours before the appointment so no-shows drop. Same number, same thread, no friction.',
              tag: 'T-2h',
            },
            {
              icon: MessageSquare,
              title: 'Two-way inbox',
              desc: 'Replies land in a shared inbox in your dashboard. Pick up where the AI left off — full history, no copy-paste.',
              tag: 'Shared',
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

        {/* Today's reminders mock stat */}
        <div className="rounded-3xl bg-cream-50 border border-cream-200 p-6 max-w-xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cream-500 mb-3 text-center">
            Today&apos;s reminders (sample)
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-serif text-3xl text-cream-900">32</p>
              <p className="text-xs text-cream-500 mt-0.5">sent</p>
            </div>
            <div className="border-x border-cream-200">
              <p className="font-serif text-3xl text-emerald-600">28</p>
              <p className="text-xs text-cream-500 mt-0.5">confirmed</p>
            </div>
            <div>
              <p className="font-serif text-3xl text-cream-900">0</p>
              <p className="text-xs text-cream-500 mt-0.5">errors</p>
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

      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 flex gap-4">
          <AlertCircle size={20} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Outbound is a tool, not a megaphone.</p>
            <p className="text-sm text-amber-800 mt-1.5 leading-relaxed">
              We rate-limit calls, respect quiet hours, and stop the moment a contact asks. If a campaign feels off, you can pause every active call from one button. Your reputation is the product — we treat it that way.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing CTA ───────────────────────────────────── */}
      <section className="bg-cream-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight">
            Outbound is included on Growth.
          </h2>
          <p className="text-cream-300 mt-4 max-w-xl mx-auto">
            Growth ($199/mo) covers inbound, outbound, and SMS on one number. Scale ($399/mo) adds multi-location, advanced analytics, and a dedicated success manager.
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

      {/* ── Cross-link to /inbound ──────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/inbound"
          className="block rounded-2xl bg-white border border-cream-200 p-6 hover:border-brand-300 transition-colors group"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-1">Looking for inbound?</p>
              <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Same AI answers your inbound calls 24/7 →</h3>
              <p className="text-sm text-cream-600 mt-1.5">Books appointments straight into your calendar, handles after-hours, and switches to Spanish automatically. Included on every plan.</p>
            </div>
            <Phone size={28} className="text-brand-600 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
