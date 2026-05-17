// ============================================================
// /pricing — Public pricing page. Cream theme matching
// /inbound, /outbound, /demo. Pulls plans from the shared
// catalog (single source of truth) and uses the PricingCards
// client component for the monthly/annual toggle.
// Enterprise is now part of the card grid (Contact Sales CTA).
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Clock, Mic, Phone, Calendar, Sparkles, Zap } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { PLANS, PAY_AS_YOU_GO } from '@ai-receptionist/shared';
import { PricingCards } from '@/components/ui/pricing-cards';
import { PlanComparisonTable } from '@/components/ui/plan-comparison-table';
import { Skeleton } from '@/components/ui/skeleton';

const RoiSection = dynamic(
  () => import('@/components/ui/roi-section').then((m) => m.RoiSection),
  {
    ssr: false,
    loading: () => <Skeleton width="w-full" height="h-64" rounded="lg" />,
  }
);

// Sellable plans shown in the card grid — trial excluded, enterprise included
const PRICING_PLANS = PLANS.filter((p) => p.key !== 'trial');

const FAQS = [
  {
    q: 'What happens when I run out of minutes?',
    a: 'Your AI keeps answering — calls never drop mid-conversation. Overage minutes are billed at the per-minute rate for your plan (Starter $0.29/min, Growth $0.25/min, Scale $0.19/min) and added to your next invoice. We email you at 80% usage so there are no surprises.',
  },
  {
    q: 'Does it handle both inbound and outbound calls?',
    a: 'Inbound 24/7 answering is on every plan. Outbound calling campaigns (autodialer, voicemail drop, retries) are included on Growth and Scale. Most competitors charge $99–$199/mo extra for outbound — we bundle it from Growth up.',
  },
  {
    q: 'Does SMS come included?',
    a: 'Yes — the two-way SMS inbox, automated appointment reminders (24h + 2h), and missed-call text-back are all included on every paid plan. SMS is sent from your business number (BYO or provisioned).',
  },
  {
    q: 'Can the AI speak Spanish?',
    a: 'Included on every plan. Your AI greets callers in English and switches to Spanish automatically when the caller does — no configuration needed. More languages coming soon.',
  },
  {
    q: 'What phone number do I get?',
    a: 'Starter is BYO — forward your existing business line to the AI, or port your number to us for free. Growth includes 2 local numbers, Scale includes 5. Need an extra line on any plan? Add one for $5/mo.',
  },
  {
    q: 'Can I change plans or cancel at any time?',
    a: 'Yes. Upgrades are prorated and effective immediately. Downgrades apply at the next billing cycle. Monthly plans cancel any time — no fees, no minimums. Annual plans are paid up front but you can cancel auto-renew any time.',
  },
  {
    q: 'Is there a free trial?',
    a: 'You can sign up for a 10-minute trial on a temporary platform number for testing the voice. For real business usage with your own number and the full SMS + outbound toolkit, pick a paid plan.',
  },
  {
    q: 'Is my data secure? What about HIPAA?',
    a: 'All call recordings and contact data are encrypted at rest and in transit. For healthcare practices we sign a Business Associate Agreement (BAA) and maintain HIPAA-compliant workflows. Contact us to set this up on any plan.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mesh-gradient-light pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            Simple, transparent pricing
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-900 tracking-tight leading-[1.05]">
            AI phone agents for inbound calls,
            <br />
            <span className="gradient-text">outbound follow-up, and lead intake.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Answer every call, qualify every lead, and follow up automatically — without hiring more staff.
          </p>
          <p className="text-sm text-cream-500 mt-4">
            Monthly or annual · Cancel anytime · 30-day money-back guarantee
          </p>
        </div>
      </section>

      {/* ── Pricing cards (client — has monthly/annual toggle) ── */}
      <section id="plans" className="max-w-7xl mx-auto px-6 pb-4 pt-6">
        <PricingCards plans={PRICING_PLANS} />
        <p className="text-center text-sm text-cream-500 mt-8">
          <a href="#compare" className="text-brand-600 hover:underline font-medium">
            Compare every feature side-by-side ↓
          </a>
        </p>
      </section>

      {/* ── Feature comparison matrix ─────────────────────── */}
      <section id="compare" className="max-w-7xl mx-auto px-6 py-16 scroll-mt-20">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Compare plans</p>
          <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
            What&apos;s included in each plan.
          </h2>
          <p className="text-cream-600 mt-3 max-w-2xl mx-auto">
            SMS, transcripts, and bilingual answering are on every plan. Growth and Scale unlock outbound campaigns, integrations, and analytics.
          </p>
        </div>
        <PlanComparisonTable />
      </section>

      {/* ── PAYG footnote strip ───────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <p className="text-center text-xs text-cream-400">
          Not ready for a subscription?{' '}
          <Link href="/signup?plan=payg" className="text-brand-500 hover:underline font-medium">
            Pay as you go at ${PAY_AS_YOU_GO.perMinute.toFixed(2)}/min
          </Link>
          {' '}— no monthly commitment. Good for low-volume testing.
        </p>
      </section>

      {/* ── What counts as an AI voice minute? ───────────── */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">How minutes work</p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
              What counts as an AI voice minute?
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              One minute = one minute of active AI conversation time. Simple.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: <Mic size={20} className="text-brand-600" />,
                title: 'Counted',
                color: 'bg-brand-50 border-brand-100',
                items: [
                  'Time the AI is actively talking with a caller',
                  'Time the caller is speaking and the AI is listening',
                  'Both inbound and outbound call time',
                ],
              },
              {
                icon: <Clock size={20} className="text-cream-500" />,
                title: 'Not counted',
                color: 'bg-cream-50 border-cream-200',
                items: [
                  'Ringing before the caller picks up',
                  'Hold time / on-hold music',
                  'Time after the call ends (transcription, logging)',
                ],
              },
              {
                icon: <Zap size={20} className="text-amber-600" />,
                title: 'Good to know',
                color: 'bg-amber-50 border-amber-100',
                items: [
                  'Average inbound call: 2–4 minutes',
                  'Average outbound follow-up: 1–2 minutes',
                  'Minutes reset at each billing cycle',
                ],
              },
            ].map(({ icon, title, color, items }) => (
              <div key={title} className={`rounded-2xl border p-6 ${color}`}>
                <div className="flex items-center gap-2 mb-4">
                  {icon}
                  <h3 className="font-semibold text-cream-900">{title}</h3>
                </div>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-cream-600">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-cream-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-cream-50 border border-cream-200 px-8 py-5 text-center">
            <p className="text-sm text-cream-600">
              <span className="font-semibold text-cream-900">Example:</span> Growth plan (750 min/mo) typically handles{' '}
              <span className="font-semibold text-cream-900">200–375 inbound calls</span> per month,
              or a mix of inbound + outbound campaigns. Most growing practices never hit the limit.
            </p>
          </div>
        </div>
      </section>

      {/* ── After-hours value block ──────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-5">
              <Calendar size={22} className="text-brand-600" />
            </div>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
              Every missed call is a missed appointment.
            </h2>
            <p className="text-cream-600 mt-3 leading-relaxed">
              67% of callers reach out outside business hours. Your AI answers every call, qualifies the lead, and books the appointment on the spot — even at 11 PM on a Sunday. At $150–$600 per booking, one recovered call per day pays for the plan many times over.
            </p>
            <a href="#plans" className="glow-btn mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors">
              <Phone size={16} /> Choose your plan ↑
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { stat: '24/7', label: 'Always available' },
              { stat: '< 2s', label: 'Answer time' },
              { stat: '94%', label: 'Booking success rate' },
              { stat: '$0', label: 'Missed call cost' },
            ].map(({ stat, label }) => (
              <div key={label} className="rounded-xl bg-white border border-cream-200 p-5 text-center">
                <p className="font-serif text-3xl text-cream-900">{stat}</p>
                <p className="text-xs text-cream-600 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROI Calculator ────────────────────────────────── */}
      <div className="bg-cream-100 border-y border-cream-200">
        <RoiSection />
      </div>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="font-serif text-4xl text-cream-900 text-center mb-10">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="rounded-xl bg-white border border-cream-200 group">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none font-medium text-cream-900 text-sm">
                {q}
                <span className="faq-icon text-cream-400 text-xl leading-none">+</span>
              </summary>
              <p className="px-6 pb-5 text-sm text-cream-600 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Become a partner ──────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-cream-100 border border-cream-200 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-cream-900">Become a partner</h3>
            <p className="text-sm text-cream-600 mt-1">
              Resell AI Receptionist to your clients and earn a recurring commission on every customer you refer.
            </p>
          </div>
          <Link
            href="/partners"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-cream-300 text-cream-800 font-semibold text-sm hover:bg-cream-50 transition-colors"
          >
            Join the program →
          </Link>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────── */}
      <section className="bg-cream-900 text-white py-20 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl text-white mb-3">Ready to stop missing calls?</h2>
          <p className="text-cream-300 mb-10 max-w-xl mx-auto">
            Pick a plan, pay securely with Stripe, and your AI is live in under 10 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#plans"
              className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white transition-colors"
            >
              <CheckCircle size={18} /> Choose your plan ↑
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:bg-white/10 px-8 py-4 text-base font-semibold text-white transition-colors"
            >
              <Mic size={18} /> Hear a Live Demo
            </Link>
            <a
              href="mailto:hello@aireceptionist.ai"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:bg-white/10 px-8 py-4 text-base font-semibold text-cream-300 transition-colors"
            >
              Contact Sales
            </a>
          </div>
          <p className="text-xs text-cream-500 mt-8">
            Questions? Email{' '}
            <a href="mailto:hello@aireceptionist.ai" className="text-brand-300 hover:underline">
              hello@aireceptionist.ai
            </a>
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
