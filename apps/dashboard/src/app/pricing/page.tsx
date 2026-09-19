// ============================================================
// /pricing — Short public pricing page.
// One plan-card grid + a short FAQ. No answering-service
// comparison. No reveal-script hero. Free signup stays first.
// ============================================================
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { PLANS } from '@ai-receptionist/shared';
import { PricingCards } from '@/components/ui/pricing-cards';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

export const metadata = {
  title: `Pricing — ${BRAND_NAME}`,
  description:
    'Free to explore. Starter $20, Growth $199, Scale $399, Business $599. Cancel anytime.',
};

const PRICING_PLANS = [
  PLANS.find((p) => p.key === 'trial')!,
  ...PLANS.filter((p) => p.key !== 'trial'),
];

const FAQS = [
  {
    q: 'Can I try it free?',
    a: 'Yes — sign up Free with no credit card. Explore the dashboard and sample the AI. Upgrade when you are ready to go live. Starter ($20/mo) includes a dedicated number, SMS, outbound campaigns, Ask Telfin, a booking page, and 50 minutes. Growth is $199/mo, Scale $399, Business $599.',
  },
  {
    q: 'What happens when I run out of minutes?',
    a: 'Calls never drop mid-conversation. Extra minutes bill at your plan rate (Starter $0.39, Growth $0.35, Scale $0.29, Business $0.25) on the next invoice. We email you at 80% usage. Only active talk time counts.',
  },
  {
    q: 'Does it handle inbound, outbound, and SMS?',
    a: 'Yes on every paid plan, including Starter. Free explores the dashboard. Paid plans answer 24/7, run outbound follow-ups, and include two-way SMS plus missed-call text-back.',
  },
  {
    q: 'What phone number do I get?',
    a: 'Starter includes 1 local number, Growth 2, Scale 5, and Business 10. Port your existing line for free, or add local numbers at $5/mo. Free has no live number until you upgrade.',
  },
  {
    q: 'Can I change plans or cancel anytime?',
    a: 'Yes. Upgrades are prorated immediately. Downgrades apply next cycle. Monthly plans cancel any time. Annual plans are paid up front; you can stop auto-renew anytime.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      <section className="mesh-gradient-light pt-16 sm:pt-20 pb-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <Sparkles size={13} />
            Simple pricing
          </div>
          <h1 className="font-serif text-[2.15rem] leading-[1.1] sm:text-5xl text-cream-900 tracking-tight">
            Clear plans.{' '}
            <span className="gradient-text">No surprises.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-5 max-w-xl mx-auto leading-relaxed">
            Free to explore. Starter $20 goes live.{' '}
            Growth $199 · Scale $399 · Business $599.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-7 py-3.5 text-sm font-semibold text-white"
            >
              Try Free →
            </Link>
            <a
              href="#plans"
              className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-7 py-3.5 text-sm font-semibold text-cream-800 hover:bg-cream-50"
            >
              See plans
            </a>
          </div>
          <p className="text-sm text-cream-500 mt-4">
            No credit card · Monthly or annual · Cancel anytime
          </p>
        </div>
      </section>

      <section id="plans" className="max-w-7xl mx-auto px-6 pb-8 pt-2 scroll-mt-20">
        <PricingCards plans={PRICING_PLANS} />
      </section>

      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="font-serif text-3xl text-cream-900 text-center mb-8">
          Questions
        </h2>
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="rounded-xl bg-white border border-cream-200">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none font-medium text-cream-900 text-sm">
                {q}
                <span className="faq-icon text-cream-400 text-xl leading-none">+</span>
              </summary>
              <p className="px-6 pb-5 text-sm text-cream-600 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-cream-900 text-white py-16 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-serif text-3xl text-white mb-3">Ready when you are.</h2>
          <p className="text-cream-300 mb-8">
            Sign up Free to explore the dashboard, then upgrade when you&apos;re ready to go live.
          </p>
          <Link
            href="/signup?plan=trial"
            className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white"
          >
            Try Free →
          </Link>
          <p className="text-xs text-cream-500 mt-6">
            Questions?{' '}
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
