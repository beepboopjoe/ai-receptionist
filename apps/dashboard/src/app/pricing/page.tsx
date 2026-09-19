// ============================================================
// /pricing — Short public pricing page.
// Cards + compare + a few FAQs. No $29 framing, no AI-reveal
// script, no second ROI / partner / after-hours dump.
// ============================================================
import Link from 'next/link';
import { Mic, Sparkles } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { PLANS, PAY_AS_YOU_GO } from '@ai-receptionist/shared';
import { PricingCards } from '@/components/ui/pricing-cards';
import { PlanComparisonTable } from '@/components/ui/plan-comparison-table';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';

const PRICING_PLANS = [
  PLANS.find((p) => p.key === 'trial')!,
  ...PLANS.filter((p) => p.key !== 'trial'),
];

const FAQS = [
  {
    q: 'Can I try it free?',
    a: 'Yes — sign up Free with no credit card. Explore the dashboard and sample the AI. Upgrade to Starter ($20/mo) to go live with a dedicated number, SMS, outbound campaigns, Ask Telfin, a booking page, and 50 included minutes. Growth is $199/mo, Scale $399, Business $599 — more included minutes and numbers.',
  },
  {
    q: 'What happens when I run out of minutes?',
    a: 'Calls never drop. You get an email at 80% usage. Extra minutes bill at your plan rate (Starter $0.39/min, Growth $0.35/min, Scale $0.29/min, Business $0.25/min). Only active talk time counts — not ringing, hold, or post-call work.',
  },
  {
    q: 'Can I change plans or cancel at any time?',
    a: 'Yes. Upgrades are prorated immediately. Downgrades apply next cycle. Monthly plans cancel any time. Annual auto-renew can be turned off any time.',
  },
  {
    q: 'Is my data secure? What about HIPAA?',
    a: 'Call recordings and contact data are encrypted at rest and in transit. We are not HIPAA-certified. Healthcare practices that need a BAA can request one before processing PHI — see /legal/hipaa.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      <section className="mesh-gradient-light pt-20 sm:pt-24 pb-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            Simple, transparent pricing
          </div>
          <h1 className="font-serif text-[2.15rem] leading-[1.1] sm:text-5xl md:text-6xl text-cream-900 tracking-tight sm:leading-[1.05] break-words">
            One AI receptionist.
            <br />
            <span className="gradient-text">Clear plans. No surprises.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Free to explore. Starter $20 goes live — outbound, SMS, Ask Telfin, and a booking page.
            Growth is $199 when you need more minutes.
          </p>
          <p className="text-sm text-cream-500 mt-4">
            Free to explore · Monthly or annual · Cancel anytime · 30-day money-back on paid plans
          </p>
        </div>
      </section>

      <section id="plans" className="max-w-7xl mx-auto px-6 pb-4 pt-2">
        <PricingCards plans={PRICING_PLANS} />
        <p className="text-center text-sm text-cream-500 mt-8">
          <a href="#compare" className="text-brand-600 hover:underline font-medium">
            Compare plans ↓
          </a>
          {' · '}
          <Link href="/signup?plan=payg" className="text-cream-600 hover:underline">
            Pay as you go at ${PAY_AS_YOU_GO.perMinute.toFixed(2)}/min
          </Link>
        </p>
      </section>

      <section id="compare" className="max-w-7xl mx-auto px-6 py-14 scroll-mt-20">
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Compare plans</p>
          <h2 className="font-serif text-3xl md:text-4xl text-cream-900 tracking-tight">
            Same product. More minutes as you grow.
          </h2>
        </div>
        <PlanComparisonTable />
      </section>

      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="font-serif text-3xl text-cream-900 text-center mb-8">Questions</h2>
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

      <section className="bg-cream-900 text-white py-16 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-3">Ready to go live?</h2>
          <p className="text-cream-300 mb-8 max-w-xl mx-auto">
            Sign up Free to explore the dashboard, then upgrade when you&apos;re ready to go live.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white transition-colors"
            >
              Try Free →
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:bg-white/10 px-8 py-4 text-base font-semibold text-white transition-colors"
            >
              <Mic size={18} /> Listen to sample calls
            </Link>
            <a
              href={`mailto:${BRAND_SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:bg-white/10 px-8 py-4 text-base font-semibold text-cream-300 transition-colors"
            >
              Contact Sales
            </a>
          </div>
          <p className="text-xs text-cream-500 mt-8">
            Questions? Email{' '}
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="text-brand-300 hover:underline">
              {BRAND_SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
