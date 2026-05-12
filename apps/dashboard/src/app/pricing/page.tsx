// Public pricing page — no auth required, no sidebar
// Uses root layout (apps/dashboard/src/app/layout.tsx)
//
// Plan data is the single shared catalog from @ai-receptionist/shared.
// CTA buttons send the user to /signup with ?plan + ?cycle so the
// dashboard knows what to upsell post-signup. Authenticated users
// who land here go to /billing to upgrade through the Stripe Checkout
// flow.
import Link from 'next/link';
import { CheckCircle, Moon, Phone, Zap } from 'lucide-react';
import { RoiSection } from '@/components/ui/roi-section';
import { PLANS, PAY_AS_YOU_GO } from '@ai-receptionist/shared';
import { PricingCards } from '@/components/ui/pricing-cards';

const FAQS = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every paid plan starts with a 14-day free trial. No charges until day 15. Cancel any time during the trial and you pay nothing.',
  },
  {
    q: 'What happens if I exceed my minutes?',
    a: 'Your AI keeps answering — calls never drop. Overage minutes are added to your next invoice at $0.20/min on Starter, $0.18/min on Growth, and $0.15/min on Scale. We email you at 80% of plan minutes so there are no surprises.',
  },
  {
    q: 'What about a phone number?',
    a: 'Every plan includes one local US number free. Need extras? $5/mo per local number, $10/mo per toll-free. Already have a number? We port it free.',
  },
  {
    q: 'Inbound, outbound — both included?',
    a: 'Yes, all plans include inbound and outbound calling. Most competitors charge for outbound separately ($99–$199/mo extra). We don\'t.',
  },
  {
    q: 'Can I switch between monthly and annual?',
    a: 'Yes. Annual billing saves 15% (about 1.8 months free). Switch at any renewal cycle from your billing page.',
  },
  {
    q: 'Can I change plans at any time?',
    a: 'Yes. Upgrades are prorated and effective immediately. Downgrades apply at the next billing cycle. No fees either way.',
  },
  {
    q: 'Spanish bilingual?',
    a: 'Included on every plan. Your AI greets in English and switches to Spanish automatically when the caller does.',
  },
  {
    q: 'API access?',
    a: 'Public REST API with read + write endpoints is included on every plan, including Starter. No "enterprise tier" gate.',
  },
  {
    q: 'Do I need to sign a long-term contract?',
    a: 'Never. Monthly plans are month-to-month. Annual plans are paid up front but you can cancel auto-renew any time.',
  },
  {
    q: 'Is my data secure?',
    a: 'All call recordings and contact data are encrypted at rest and in transit. For healthcare customers, we sign a BAA and maintain HIPAA compliance.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 glass-nav border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-serif text-lg shadow-lg">
              ar
            </div>
            <span className="font-bold text-gray-900 text-lg">AI Receptionist</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/outbound" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Outbound</Link>
            <Link href="/pricing" className="text-sm font-medium text-brand-600">Pricing</Link>
            <Link href="/demo" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Demo</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="glow-btn inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              Start free trial →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mesh-gradient pt-20 pb-16 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 shimmer-badge bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <Zap size={13} />
            Simple, transparent pricing
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">
            Pay for what you use.{' '}
            <span className="gradient-text">Cancel anytime.</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            14-day free trial on every paid plan. No setup fees. No long-term contract. Outbound + Spanish + API included on every tier.
          </p>
        </div>
      </section>

      {/* ── Pricing cards (client — has monthly/annual toggle) ── */}
      <section className="max-w-6xl mx-auto px-6 pb-12 -mt-8">
        <PricingCards plans={PLANS.filter((p) => p.key !== 'enterprise')} />
      </section>

      {/* ── Pay-as-you-go strip ── */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="glass-card rounded-2xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">{PAY_AS_YOU_GO.name}</h3>
            <p className="text-sm text-gray-400 mt-1">
              {PAY_AS_YOU_GO.description} <span className="font-semibold text-white">${PAY_AS_YOU_GO.perMinute.toFixed(2)}/min</span> + ${PAY_AS_YOU_GO.phoneNumberMonthly}/mo per number.
            </p>
          </div>
          <Link
            href="/signup?plan=payg"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
          >
            Start pay-as-you-go →
          </Link>
        </div>
      </section>

      {/* ── Enterprise row ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="glass-card rounded-2xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Enterprise</h3>
            <p className="text-sm text-gray-400 mt-1">
              Custom pricing for groups, DSOs, or networks with 5+ locations. White-label available. Dedicated success manager + SLA.
            </p>
          </div>
          <a
            href="mailto:hello@aireceptionist.ai"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
          >
            Contact sales →
          </a>
        </div>
      </section>

      {/* ── After-hours value block ── */}
      <section className="bg-gray-900 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-5">
                <Moon size={22} className="text-brand-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Your AI never sleeps
              </h2>
              <p className="text-gray-400 text-base leading-relaxed">
                67% of callers reach out outside business hours. Every missed call is a missed appointment — often worth $150–$600 in revenue. Your AI receptionist answers every call, 24 hours a day, and books the appointment on the spot.
              </p>
              <Link href="/signup" className="glow-btn mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors">
                <Phone size={16} /> Start your free trial
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { stat: '24/7', label: 'Always available' },
                { stat: '< 2s', label: 'Answer time' },
                { stat: '94%', label: 'Booking success rate' },
                { stat: '$0', label: 'Missed call cost' },
              ].map(({ stat, label }) => (
                <div key={label} className="glass-card rounded-xl p-5 text-center">
                  <p className="text-3xl font-extrabold text-white">{stat}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ROI Calculator ── */}
      <div className="bg-gray-950">
        <RoiSection />
      </div>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-10">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="glass-card rounded-xl group">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none font-medium text-white text-sm">
                {q}
                <span className="faq-icon text-gray-400 text-xl leading-none">+</span>
              </summary>
              <p className="px-6 pb-5 text-sm text-gray-400 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="text-center py-16 px-6 border-t border-white/5">
        <h2 className="text-2xl font-bold text-white mb-3">Ready to stop missing calls?</h2>
        <p className="text-gray-400 mb-6">Start your 14-day free trial today — no credit card required.</p>
        <Link
          href="/signup"
          className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white transition-colors"
        >
          <Zap size={18} /> Get started free →
        </Link>
        <p className="text-xs text-gray-600 mt-4">
          Questions?{' '}
          <a href="mailto:hello@aireceptionist.ai" className="text-brand-400 hover:underline">
            hello@aireceptionist.ai
          </a>
        </p>
      </section>
    </div>
  );
}
