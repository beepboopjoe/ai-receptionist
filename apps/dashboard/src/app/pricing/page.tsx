// ============================================================
// /pricing — Public pricing page. Cream theme matching
// /inbound, /outbound, /demo. Pulls plans from the shared
// catalog (single source of truth) and uses the PricingCards
// client component for the monthly/annual toggle. Includes a
// DashboardTeaser so visitors can see what they get inside.
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Moon, Phone, Sparkles } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { PLANS, PAY_AS_YOU_GO } from '@ai-receptionist/shared';
import { PricingCards } from '@/components/ui/pricing-cards';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardTeaser = dynamic(
  () => import('@/components/ui/dashboard-teaser').then((m) => m.DashboardTeaser),
  {
    ssr: false,
    loading: () => <Skeleton width="w-full" height="h-[480px]" rounded="lg" />,
  }
);

const RoiSection = dynamic(
  () => import('@/components/ui/roi-section').then((m) => m.RoiSection),
  {
    ssr: false,
    loading: () => <Skeleton width="w-full" height="h-64" rounded="lg" />,
  }
);

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
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mesh-gradient-light pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            Simple, transparent pricing
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight leading-[1.05]">
            Pay for what you use.
            <br />
            <span className="gradient-text">Cancel anytime.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            14-day free trial on every paid plan. No setup fees. No long-term contract. Outbound + Spanish + API included on every tier.
          </p>
        </div>
      </section>

      {/* ── Pricing cards (client — has monthly/annual toggle) ── */}
      <section className="max-w-6xl mx-auto px-6 pb-12 pt-6">
        <PricingCards plans={PLANS.filter((p) => p.key !== 'enterprise')} />
      </section>

      {/* ── Pay-as-you-go strip ────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="rounded-2xl bg-white border border-cream-200 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-cream-900">{PAY_AS_YOU_GO.name}</h3>
            <p className="text-sm text-cream-600 mt-1">
              {PAY_AS_YOU_GO.description} <span className="font-semibold text-cream-900">${PAY_AS_YOU_GO.perMinute.toFixed(2)}/min</span> + ${PAY_AS_YOU_GO.phoneNumberMonthly}/mo per number.
            </p>
          </div>
          <Link
            href="/signup?plan=payg"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-cream-300 text-cream-800 font-semibold text-sm hover:bg-cream-50 transition-colors"
          >
            Start pay-as-you-go →
          </Link>
        </div>
      </section>

      {/* ── Enterprise row ────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="rounded-2xl bg-cream-100 border border-cream-200 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-cream-900">Enterprise</h3>
            <p className="text-sm text-cream-600 mt-1">
              Custom pricing for groups, DSOs, or networks with 5+ locations. White-label available. Dedicated success manager + SLA.
            </p>
          </div>
          <a
            href="mailto:hello@aireceptionist.ai"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-cream-300 text-cream-800 font-semibold text-sm hover:bg-cream-50 transition-colors"
          >
            Contact sales →
          </a>
        </div>
      </section>

      {/* ── Dashboard preview ─────────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">What you get inside</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              One dashboard. Every call, contact, and campaign.
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              Recordings + transcripts on every call. Live activity feed. Public API + webhooks on every plan.
            </p>
          </div>
          <DashboardTeaser />
        </div>
      </section>

      {/* ── After-hours value block ──────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-5">
              <Moon size={22} className="text-brand-600" />
            </div>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight">
              Your AI never sleeps.
            </h2>
            <p className="text-cream-600 mt-3 leading-relaxed">
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
          <p className="text-cream-300 mb-8 max-w-xl mx-auto">Start your 14-day free trial today — no credit card required.</p>
          <Link
            href="/signup"
            className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white transition-colors"
          >
            <CheckCircle size={18} /> Get started free →
          </Link>
          <p className="text-xs text-cream-400 mt-6">
            Questions?{' '}
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
