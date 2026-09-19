// ============================================================
// /how-it-works — Short walkthrough for the site-nav link.
// Five tight steps. No answering-service comparison.
// Free signup stays the primary CTA.
// ============================================================
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: `How it works — ${BRAND_NAME}`,
  description:
    'Sign up Free, connect a number, and Telfin answers, books, and texts. Five steps.',
};

const STEPS = [
  {
    n: '1',
    title: 'Sign up Free',
    desc: 'No credit card. Explore the dashboard and sample the AI in the browser.',
  },
  {
    n: '2',
    title: 'Connect a number',
    desc: 'Forward your existing line or we provision a local number. Upgrade to go live.',
  },
  {
    n: '3',
    title: 'Telfin answers every call',
    desc: 'Greets callers, books the calendar, answers questions, and escalates urgent ones — 24/7.',
  },
  {
    n: '4',
    title: 'Texts and follow-ups',
    desc: 'Paid plans add missed-call text-back, reminder SMS, and outbound campaigns from the same number.',
  },
  {
    n: '5',
    title: 'Review in the dashboard',
    desc: 'Transcripts, recordings, bookings, and campaigns in one place.',
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      <section className="mesh-gradient-light pt-16 sm:pt-20 pb-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <Sparkles size={13} />
            How it works
          </div>
          <h1 className="font-serif text-[2.15rem] leading-[1.1] sm:text-5xl text-cream-900 tracking-tight">
            Five steps.{' '}
            <span className="gradient-text">Then your phone is covered.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-5 max-w-xl mx-auto leading-relaxed">
            Start Free. Go live on Starter $20 when you want a number.
            Growth $199 · Scale $399 · Business $599.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-7 py-3.5 text-sm font-semibold text-white"
            >
              Try Free →
            </Link>
            <Link
              href="/pricing#plans"
              className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-7 py-3.5 text-sm font-semibold text-cream-800 hover:bg-cream-50"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <ol className="space-y-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="flex gap-4 rounded-2xl bg-white border border-cream-200 p-5 sm:p-6"
            >
              <div
                className="w-10 h-10 rounded-full bg-brand-600 text-white font-serif flex items-center justify-center text-lg shrink-0"
                aria-hidden
              >
                {step.n}
              </div>
              <div>
                <h2 className="font-semibold text-cream-900">{step.title}</h2>
                <p className="text-sm text-cream-600 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-cream-900 text-white py-16 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-serif text-3xl text-white mb-3">Try it Free first.</h2>
          <p className="text-cream-300 mb-8">
            Explore the dashboard with no card. Upgrade when you&apos;re ready to go live.
          </p>
          <Link
            href="/signup?plan=trial"
            className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white"
          >
            Try Free →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
