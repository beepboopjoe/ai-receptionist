// ============================================================
// / — Marketing home page.
// One AI phone receptionist (Grok voice + Telnyx calling).
// Cream theme. Shared MarketingHeader + MarketingFooter.
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Phone, Megaphone, MessageSquare, ArrowRight } from 'lucide-react';
import { BRAND_NAME, BRAND_STACK_LINE } from '@/lib/brand';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { RoiCalculator } from '@/components/marketing/roi-calculator';
import { PLANS } from '@ai-receptionist/shared';

const HomepageVoiceSamples = dynamic(
  () => import('@/components/ui/homepage-voice-samples').then((m) => m.HomepageVoiceSamples),
  { ssr: false }
);
const DashboardTeaser = dynamic(
  () => import('@/components/ui/dashboard-teaser').then((m) => m.DashboardTeaser),
  { ssr: false }
);
const CallMeWidget = dynamic(
  () => import('@/components/ui/call-me-widget').then((m) => m.CallMeWidget),
  { ssr: false }
);

const FAQS = [
  {
    q: 'Do I need to change my phone system?',
    a: 'No. Forward calls to your AI line, or we provision a new number. Works with any landline, VoIP, or cell. Setup takes under 10 minutes.',
  },
  {
    q: 'What if a caller has an urgent situation?',
    a: 'The AI detects urgency in the conversation and can transfer to your staff — the same way a good receptionist would hand off a call.',
  },
  {
    q: 'How does appointment booking work?',
    a: 'The AI connects to your Google or Microsoft Calendar and only offers slots that are actually open, then writes the booking back. You review every appointment in the dashboard.',
  },
  {
    q: 'Can I listen to call recordings?',
    a: 'Yes. Every call is transcribed, recorded, and summarized. Review the transcript, play the audio, and see what the AI did — all in your dashboard.',
  },
  {
    q: 'What happens when I reach my minute limit?',
    a: "You'll get an alert at 80% usage. Calls continue — you're never cut off mid-conversation. Extra minutes are billed at your plan's overage rate.",
  },
  {
    q: 'Is Spanish bilingual included?',
    a: 'Yes, on every plan. Your AI greets in English and switches to Spanish automatically when the caller does. No extra charge.',
  },
  {
    q: 'Does SMS come included?',
    a: 'Two-way SMS, appointment reminders (24h + 2h), and missed-call text-backs are included on paid plans (Growth, Scale, Business, Enterprise). The free trial is inbound voice only and does not include SMS. Texts send from your provisioned business number.',
  },
];

const INDUSTRIES = [
  {
    emoji: '🦷',
    label: 'Healthcare / Dental',
    bullets: ['Appointment booking & recall', 'Emergency triage & escalation', 'Insurance verification'],
  },
  {
    emoji: '📋',
    label: 'Insurance Agency',
    bullets: ['Inbound lead qualification', 'Quote follow-up calls', 'Renewal reminders'],
  },
  {
    emoji: '⚖️',
    label: 'Law Firm / PI',
    bullets: ['24/7 new case intake', 'Consultation scheduling', 'Client follow-up'],
  },
  {
    emoji: '🏠',
    label: 'Real Estate',
    bullets: ['Instant lead qualification', 'Showing scheduling', 'Buyer & seller follow-up'],
  },
  {
    emoji: '🔧',
    label: 'Home Services',
    bullets: ['24/7 job booking', 'Emergency dispatch', 'Maintenance reminders'],
  },
  {
    emoji: '💼',
    label: 'Other appointment-based businesses',
    bullets: ['24/7 call answering', 'Appointment booking', 'Outbound follow-up'],
  },
];

const PLANS_PREVIEW = PLANS.filter((p) => ['growth', 'scale', 'business'].includes(p.key)).map((p) => ({
  key: p.key,
  name: p.name,
  price: `$${p.monthlyPrice}`,
  tagline: p.tagline,
  features: p.features.slice(0, 4),
  cta: `Subscribe to ${p.name}`,
  popular: !!p.popular,
}));

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900 font-sans antialiased">

      <MarketingHeader />

      <section className="mesh-gradient-light pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            Built for phone-heavy businesses
          </div>

          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight leading-[1.05]">
            Your AI phone<br />
            <span className="gradient-text">receptionist.</span>
          </h1>

          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            {BRAND_NAME} answers every inbound call, books the calendar, and follows up by phone or text —
            one receptionist, not three products.
          </p>

          <p className="text-sm text-cream-600 mt-4 max-w-xl mx-auto">
            Who it&apos;s for: dental · legal / PI · insurance · real estate · home services
          </p>

          <p className="text-xs font-semibold text-cream-500 mt-3 tracking-wide">
            {BRAND_STACK_LINE}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              Try Free →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-800 bg-white border border-cream-200 rounded-xl hover:bg-cream-50 transition-colors"
            >
              See pricing
            </Link>
          </div>

          <div id="call-me" className="mt-10 scroll-mt-24">
            <CallMeWidget />
          </div>
        </div>
      </section>

      <HomepageVoiceSamples />

      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <DashboardTeaser />
        </div>
      </section>

      <section className="py-24 px-6 bg-cream-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">What it does</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              One receptionist. Inbound, follow-up, and texts.
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              Answering the phone is the core. Outbound campaigns and SMS ride along on the same number and the same AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <Link
              href="/inbound"
              className="group block rounded-3xl bg-white border border-cream-200 p-8 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Phone size={22} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Core</p>
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Answers every call</h3>
                </div>
              </div>
              <p className="text-cream-600 text-sm mb-6 leading-relaxed">
                Day, night, weekends, holidays — books appointments into your calendar and switches to Spanish when the caller does.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Picks up 24/7 — no hold music',
                  'Books, reschedules & cancels appointments',
                  'Escalates emergencies to staff',
                  'Transcript + AI summary in the dashboard',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:gap-3 transition-all">
                How inbound answering works <ArrowRight size={15} />
              </div>
            </Link>

            <Link
              href="/outbound"
              className="group block rounded-3xl bg-white border border-cream-200 p-8 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center">
                  <Megaphone size={22} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-600 uppercase tracking-[0.2em]">Included</p>
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Calls people back</h3>
                </div>
              </div>
              <p className="text-cream-600 text-sm mb-6 leading-relaxed">
                The same receptionist dials inactive contacts, unbooked leads, and recall lists — on paid plans.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Dials your contact lists automatically',
                  'Qualifies with a natural conversation',
                  'Books appointments from follow-ups',
                  'Tries again if nobody picks up',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-brand-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:gap-3 transition-all">
                How outbound follow-up works <ArrowRight size={15} />
              </div>
            </Link>

            <Link
              href="/pricing"
              className="group block rounded-3xl bg-white border border-cream-200 p-8 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <MessageSquare size={22} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">Included</p>
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Texts when needed</h3>
                </div>
              </div>
              <p className="text-cream-600 text-sm mb-6 leading-relaxed">
                Missed-call text-backs, appointment reminders, and a shared inbox — on paid plans, from your business number.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Two-way SMS inbox tied to each contact',
                  'Appointment reminders (24h + 2h)',
                  'Missed-call text-back in seconds',
                  'Reply CONFIRM / CANCEL to manage bookings',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:gap-3 transition-all">
                See which plans include SMS <ArrowRight size={15} />
              </div>
            </Link>

          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white border-y border-cream-200 py-20 px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              From first ring to booked appointment.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                n: '1',
                title: 'Connect your number',
                desc: 'Forward your existing line or we provision a new AI number. Works with any phone system in under 10 minutes.',
              },
              {
                n: '2',
                title: 'AI handles every call',
                desc: 'Greets callers, books appointments, answers questions, and escalates emergencies — 24/7.',
              },
              {
                n: '3',
                title: 'Watch the results',
                desc: 'Every call logged, every booking tracked. Transcripts, recordings, and analytics in one dashboard.',
              },
            ].map((step) => (
              <div key={step.n} className="rounded-2xl bg-cream-50 border border-cream-200 p-7">
                <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-serif flex items-center justify-center mb-4 text-lg">
                  {step.n}
                </div>
                <h3 className="font-semibold text-cream-900 mb-2">{step.title}</h3>
                <p className="text-sm text-cream-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-cream-200 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Industries</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Built for businesses<br />that live on the phone.
            </h2>
            <p className="text-cream-600 mt-3 text-lg">Six verticals. One receptionist, tuned for each.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {INDUSTRIES.map((v) => (
              <div
                key={v.label}
                className="rounded-2xl bg-cream-50 border border-cream-200 p-6 flex flex-col hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl shrink-0">{v.emoji}</span>
                  <p className="font-serif text-lg text-cream-900 leading-tight">{v.label}</p>
                </div>
                <ul className="space-y-1.5">
                  {v.bullets.map((b) => (
                    <li key={b} className="text-sm text-cream-700 flex items-start gap-2">
                      <span className="text-brand-500 mt-1 shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Pricing</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Simple pricing.<br />No surprises.
            </h2>
            <p className="text-cream-600 mt-3 text-lg">Trial, Growth, Scale, Business, or Enterprise. Cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {PLANS_PREVIEW.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-7 flex flex-col ${
                  plan.popular
                    ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300'
                    : 'border-cream-200 bg-white'
                }`}
              >
                {plan.popular && (
                  <div className="text-center mb-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-3 py-1 uppercase tracking-widest">
                      Most Popular
                    </span>
                  </div>
                )}
                <p className="font-serif text-2xl text-cream-900 mb-1">{plan.name}</p>
                <p className="text-xs text-cream-500 italic mb-4">&ldquo;{plan.tagline}&rdquo;</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-black text-cream-900">{plan.price}</span>
                  <span className="text-cream-500 mb-1.5 text-sm">/mo</span>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-cream-700">
                      <CheckCircle size={14} className="text-brand-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?plan=${plan.key}&cycle=monthly`}
                  className={`block w-full text-center py-2.5 px-5 rounded-xl text-sm font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'border border-cream-300 text-cream-800 hover:bg-cream-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
              See full pricing details → <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white border-t border-cream-200 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">FAQ</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Questions &amp; answers
            </h2>
            <p className="text-cream-600 mt-3">Everything you need to know before getting started.</p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl bg-cream-50 border border-cream-200 overflow-hidden cursor-pointer open:border-brand-300"
              >
                <summary className="flex items-center justify-between px-6 py-5 font-semibold text-cream-900 text-sm select-none hover:text-brand-700 transition-colors list-none">
                  <span>{faq.q}</span>
                  <span className="ml-4 w-6 h-6 rounded-full border border-cream-300 flex items-center justify-center shrink-0 text-cream-500 text-base group-open:border-brand-400 group-open:text-brand-600">
                    +
                  </span>
                </summary>
                <p className="px-6 pb-6 text-cream-600 text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream-50 py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
            Works inside your CRM
          </p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight mb-5">
            Every call. Every appointment. Every escalation. In your CRM.
          </h2>
          <p className="text-cream-600 text-lg mb-10 max-w-2xl mx-auto">
            When the AI handles a call, the summary + full transcript posts as a Note
            on the matching contact. Appointments book as Events. Escalations land as
            high-priority Tasks. Your team sees it all where they already work.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-3xl mx-auto">
            {[
              { name: 'HubSpot',     icon: '🔗' },
              { name: 'Salesforce',  icon: '☁️' },
              { name: 'Clio',        icon: '⚖️' },
              { name: 'Filevine',    icon: '📁' },
              { name: 'Zoho CRM',    icon: '🟧' },
            ].map((crm) => (
              <div key={crm.name} className="bg-white rounded-lg border border-cream-200 p-5 flex flex-col items-center gap-2">
                <div className="text-3xl">{crm.icon}</div>
                <div className="text-sm font-semibold text-cream-800">{crm.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-brand-600 font-bold">Two-way sync</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TrustStrip / TestimonialGrid stay unmounted until real logos + quotes exist. */}

      <RoiCalculator vertical="generic" />

      <section className="bg-white border-y border-cream-200 py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold text-cream-500 uppercase tracking-[0.2em] mb-5">
            Works with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['HubSpot', 'Salesforce', 'Clio', 'Filevine', 'Zoho CRM', 'Google Calendar', 'Outlook', 'OpenAI', 'Claude', 'Slack', 'Gmail', 'Follow Up Boss', 'ServiceTitan', 'WhatsApp', 'Zapier'].map((name) => (
              <span
                key={name}
                className="inline-flex items-center px-4 py-2 rounded-full border border-cream-200 bg-cream-50 text-xs font-semibold text-cream-600 tracking-wide"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-cream-400 uppercase tracking-[0.2em] mb-6">Get started today</p>
          <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-5 leading-tight">
            Start in 10 minutes.<br />
            <span className="gradient-text">No contracts.</span>
          </h2>
          <p className="text-cream-400 text-lg mb-10 max-w-xl mx-auto">
            Try the receptionist free, then pick Growth, Scale, Business, or Enterprise when you&apos;re ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 px-9 py-4 text-base font-bold text-white bg-brand-600 rounded-2xl"
            >
              Try Free →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-cream-200 border border-white/20 rounded-2xl hover:bg-white/5 transition-all"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-6 text-sm text-cream-500">Pay monthly or annual · Cancel anytime · Setup under 10 minutes</p>
        </div>
      </section>

      <MarketingFooter />

    </div>
  );
}
