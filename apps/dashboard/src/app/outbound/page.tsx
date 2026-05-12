// ============================================================
// /outbound — Public marketing page positioning AI outbound
// calling as the practice's reactivation engine. Uses the
// new warm theme (cream + terracotta + serif headings).
// No auth, no sidebar — uses the root layout.
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Phone, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { CampaignFlowDiagram } from '@/components/ui/campaign-flow-diagram';
import { OutboundRoi } from '@/components/ui/outbound-roi';
import { BRAND_NAME } from '@/lib/brand';

// SampleCallPlayer uses Web Speech API at click-time. Lazy-load it
// so the marketing page's first paint isn't blocked on its TTS code.
const SampleCallPlayer = dynamic(
  () => import('@/components/ui/sample-call-player').then((m) => m.SampleCallPlayer),
  { ssr: false }
);

export const metadata = {
  title: 'AI Outbound Calling — book more appointments automatically',
  description:
    'Reactivate inactive contacts, follow up on leads, and run recall campaigns — all on autopilot. AI outbound for any appointment-based business.',
};

const PROBLEMS = [
  {
    stat: '32%',
    label: 'of contacts never return after a single visit',
    note: 'They go cold. Most businesses never follow up — and revenue walks out the door.',
  },
  {
    stat: '$2.4K',
    label: 'avg value left on the table per missed follow-up',
    note: "Leads who said yes but never scheduled — the most painful kind of pipeline leak.",
  },
  {
    stat: '64%',
    label: 'of inactive contact lists are never touched',
    note: 'Staff don\'t have bandwidth for outbound. Outsourced callers cost more than they recover.',
  },
];

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
      {/* ── Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-nav border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-serif text-lg shadow-sm">
              ar
            </div>
            <span className="font-serif text-lg text-cream-900">{BRAND_NAME}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <Link href="/inbound" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Inbound</Link>
            <Link href="/outbound" className="text-sm font-medium text-brand-600">Outbound</Link>
            <Link href="/pricing" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Pricing</Link>
            <Link href="/demo" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Demo</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/onboarding/plan"
              className="glow-btn inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              Start free trial →
            </Link>
          </div>
        </div>
      </header>

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
              href="/onboarding/plan"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              Start free trial →
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-800 bg-white border border-cream-200 rounded-xl hover:bg-cream-50 transition-colors"
            >
              Try it live →
            </Link>
          </div>
          <p className="text-xs text-cream-500 mt-5">
            Included on Growth and Pro plans · 14-day free trial · No contracts
          </p>
        </div>
      </section>

      {/* ── The problem ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">The reality</p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Most businesses already have a six-figure pipeline.
            <br />
            <span className="text-cream-500">It's just not getting called.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEMS.map((p) => (
            <div key={p.stat} className="rounded-2xl bg-white border border-cream-200 p-7">
              <p className="font-serif text-5xl text-brand-600 tracking-tight">{p.stat}</p>
              <p className="font-semibold text-cream-900 mt-3">{p.label}</p>
              <p className="text-sm text-cream-600 mt-2 leading-relaxed">{p.note}</p>
            </div>
          ))}
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

      {/* ── ROI calculator ────────────────────────────────── */}
      <OutboundRoi />

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

      {/* ── Sample Call Demo ──────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-12 pt-8">
        <div className="text-center mb-6">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-2">Hear it yourself</p>
          <h2 className="font-serif text-3xl text-cream-900 tracking-tight">Listen to real AI outbound calls</h2>
          <p className="text-cream-600 mt-2 text-sm">Pre-scripted samples — press play to hear the voice quality and natural conversation flow.</p>
        </div>
        <SampleCallPlayer />
        <p className="text-center mt-5">
          <Link href="/demo" className="text-sm font-semibold text-brand-600 hover:underline">
            Talk to the AI yourself in real time →
          </Link>
        </p>
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
            Growth ($399/mo) covers inbound and outbound on one number. Pro ($799/mo) adds multi-location, advanced analytics, and a dedicated success manager.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding/plan"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              <Phone size={15} /> Start free trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-100 border border-white/20 rounded-xl hover:bg-white/5 transition-colors"
            >
              Compare all plans →
            </Link>
          </div>
          <p className="text-xs text-cream-400 mt-5">
            14-day free trial · 200 minutes included · No credit card required
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

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-cream-200 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-cream-500">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">ar</div>
            <span className="font-serif text-cream-700">{BRAND_NAME}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-cream-900 transition-colors">Home</Link>
            <Link href="/inbound" className="hover:text-cream-900 transition-colors">Inbound</Link>
            <Link href="/outbound" className="hover:text-cream-900 transition-colors">Outbound</Link>
            <Link href="/pricing" className="hover:text-cream-900 transition-colors">Pricing</Link>
            <Link href="/demo" className="hover:text-cream-900 transition-colors">Demo</Link>
            <a href="mailto:hello@aireceptionist.ai" className="hover:text-cream-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
