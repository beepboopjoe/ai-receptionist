// Public pricing page — no auth required, no sidebar
// Uses root layout (apps/dashboard/src/app/layout.tsx)
import Link from 'next/link';
import { CheckCircle, Moon, Phone, Zap } from 'lucide-react';
import { RoiSection } from '@/components/ui/roi-section';

// ── Plan data (source of truth aligned with billing page PLANS constant) ──
const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    emoji: '🟢',
    price: 199,
    tagline: 'Never miss a call again',
    description: 'Perfect for single-location businesses that want 24/7 AI call handling.',
    minutes: '1,000',
    phones: '1 phone number',
    outbound: false,
    multiLocation: false,
    overage: '$0.14/min',
    popular: false,
    features: [
      '1,000 AI minutes/month',
      '1 phone number',
      'Inbound calls only',
      'Appointment booking & cancellation',
      'SMS confirmations',
      'Email + chat support',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    emoji: '🔵',
    price: 399,
    tagline: 'Turn calls into customers',
    description: 'Inbound reception plus AI outbound campaigns that dial and book automatically.',
    minutes: '3,000',
    phones: '2 phone numbers',
    outbound: true,
    multiLocation: false,
    overage: '$0.13/min',
    popular: true,
    features: [
      '3,000 AI minutes/month',
      '2 phone numbers',
      'Inbound + Outbound calling',
      'Lead qualification & CRM sync',
      'Outbound campaign manager',
      'Full analytics dashboard',
      'Priority support',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    emoji: '🔥',
    price: 799,
    tagline: 'Full automation system',
    description: 'Complete AI phone operations across up to 5 locations with advanced analytics.',
    minutes: '8,000',
    phones: '5 phone numbers',
    outbound: true,
    multiLocation: true,
    overage: '$0.12/min',
    popular: false,
    features: [
      '8,000 AI minutes/month',
      '5 phone numbers',
      'Multi-location (up to 5)',
      'Custom workflows & AI tuning',
      'Advanced analytics & reporting',
      'Dedicated account manager',
      'SLA uptime guarantee',
    ],
  },
] as const;

const FAQS = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every new account starts with a 14-day trial that includes 200 AI minutes. No credit card required.',
  },
  {
    q: 'What happens if I exceed my minutes?',
    a: 'Calls continue uninterrupted. Overage minutes are billed at your plan rate ($0.14/min on Starter, $0.13 on Growth, $0.12 on Pro) and added to your next invoice.',
  },
  {
    q: 'Can I change plans at any time?',
    a: 'Yes. Upgrades take effect immediately and are prorated. Downgrades apply at the next billing cycle.',
  },
  {
    q: 'Do I need to sign a long-term contract?',
    a: 'No contracts — all plans are month-to-month. Cancel any time from your billing page.',
  },
  {
    q: 'What CRM and calendar systems do you integrate with?',
    a: 'We support Google Calendar, Outlook, HubSpot, Salesforce, Clio (legal), Follow Up Boss (real estate), ServiceTitan (home services), and more. New integrations are added regularly.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All call recordings and contact data are encrypted at rest and in transit. For healthcare customers, we sign a BAA and maintain full HIPAA compliance. All customers receive SOC 2-aligned data handling.',
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
              href="/onboarding/plan"
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
            No setup fees. No annual lock-in. Every plan includes a 14-day free trial with 200 AI minutes.
          </p>
        </div>
      </section>

      {/* ── Pricing cards ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`glass-card rounded-2xl p-8 flex flex-col relative ${
                plan.popular ? 'ring-2 ring-brand-500' : ''
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                  MOST POPULAR
                </span>
              )}

              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{plan.emoji}</span>
                  <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-gray-400 text-sm">/mo</span>
                </div>
                <p className="text-xs text-gray-500 italic">{plan.tagline}</p>
                <p className="text-sm text-gray-400 mt-3">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-3 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <CheckCircle size={15} className="text-brand-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Overage */}
              <p className="text-xs text-gray-500 mb-4">
                Overage: <span className="font-semibold text-gray-400">{plan.overage}</span>
              </p>

              {/* CTA */}
              <Link
                href="/onboarding/plan"
                className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                  plan.popular
                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
              >
                Start free trial →
              </Link>
            </div>
          ))}
        </div>

        {/* Enterprise row */}
        <div className="mt-6 glass-card rounded-2xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Enterprise</h3>
            <p className="text-sm text-gray-400 mt-1">
              Custom pricing for large groups, DSOs, or networks with 5+ locations and dedicated support needs.
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
              <Link href="/onboarding/plan" className="glow-btn mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors">
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
          href="/onboarding/plan"
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
