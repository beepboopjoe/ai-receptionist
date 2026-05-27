// ============================================================
// / — Marketing home page.
// Cream theme matching /inbound, /outbound, /pricing.
// Uses shared MarketingHeader + MarketingFooter.
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CheckCircle, Phone, Megaphone, MessageSquare, ArrowRight, Sparkles, Crosshair } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { CallMeWidget } from '@/components/ui/call-me-widget';
import { PLANS } from '@ai-receptionist/shared';

const HomepageVoiceSamples = dynamic(
  () => import('@/components/ui/homepage-voice-samples').then((m) => m.HomepageVoiceSamples),
  { ssr: false }
);

const FAQS = [
  {
    q: 'Do I need to change my phone system?',
    a: 'No. You simply forward calls to your AI line. Works with any landline, VoIP, or cell phone. Setup takes under 10 minutes.',
  },
  {
    q: 'What if a caller has an urgent situation?',
    a: 'The AI detects urgency in real-time and transfers the call to your staff within seconds — no delay.',
  },
  {
    q: 'How accurate is the appointment booking?',
    a: 'The AI connects directly to your Google or Microsoft Calendar. It only offers genuinely available slots. Zero double-bookings reported across our entire customer base.',
  },
  {
    q: 'Can I listen to call recordings?',
    a: 'Yes. Every call is transcribed, recorded, and summarized by AI. Review the full transcript, play the audio, and see every decision the AI made — all in your dashboard.',
  },
  {
    q: 'What happens when I reach my minute limit?',
    a: "You'll get an alert at 80% usage. Calls continue — you're never cut off mid-conversation. We'll help you upgrade to the right plan seamlessly.",
  },
  {
    q: 'Is Spanish bilingual included?',
    a: 'Yes, on every plan. Your AI greets in English and switches to Spanish automatically when the caller does. No extra charge.',
  },
  {
    q: 'Does SMS come included?',
    a: 'The two-way SMS inbox and automated appointment reminders (24h + 2h) are included on Growth and Scale plans. Starter sends missed-call text-backs only. SMS is sent from your provisioned business number.',
  },
];

const INDUSTRIES = [
  {
    emoji: '🦷',
    label: 'Healthcare / Dental',
    bullets: ['Appointment booking & recall', 'Emergency triage & escalation', 'Insurance verification'],
    quote: '"We added 41 net-new patients in our first month — without hiring."',
    attribution: 'Dental practice owner · Austin, TX',
  },
  {
    emoji: '📋',
    label: 'Insurance Agency',
    bullets: ['Inbound lead qualification', 'Quote follow-up calls', 'Renewal reminders'],
    quote: '"Our quote-to-bind rate jumped from 18% to 27% once we stopped missing callbacks."',
    attribution: 'Independent agency · Denver, CO',
  },
  {
    emoji: '⚖️',
    label: 'Law Firm',
    bullets: ['24/7 new case intake', 'Consultation scheduling', 'Client follow-up'],
    quote: '"After-hours intake captures 6–8 new matters a week we used to lose to voicemail."',
    attribution: 'PI firm · Phoenix, AZ',
  },
  {
    emoji: '🏠',
    label: 'Real Estate',
    bullets: ['Instant lead qualification', 'Showing scheduling', 'Buyer & seller follow-up'],
    quote: '"Showings are now booked while the lead is still on the phone — not 3 days later."',
    attribution: 'Brokerage · Tampa, FL',
  },
  {
    emoji: '🔧',
    label: 'Home Services',
    bullets: ['24/7 job booking', 'Emergency dispatch', 'Maintenance reminders'],
    quote: '"We stopped losing emergency calls to a voicemail box. That alone paid for itself."',
    attribution: 'HVAC company · Houston, TX',
  },
  {
    emoji: '💼',
    label: 'Other Appointment-Based Businesses',
    bullets: ['24/7 call answering', 'Appointment booking', 'Outbound follow-up'],
    quote: '"It just works. Customers don\'t even realize it\'s AI."',
    attribution: 'Multi-location service business',
  },
];

// Derived from shared catalog — single source of truth.
const PLANS_PREVIEW = PLANS.filter((p) => ['starter', 'growth', 'scale'].includes(p.key)).map((p) => ({
  key: p.key,
  name: p.name,
  price: `$${p.monthlyPrice}`,
  tagline: p.tagline,
  features: p.features.slice(0, 4),
  cta: `Subscribe to ${p.name}`,
  popular: !!p.popular,
}));

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900 font-sans antialiased">

      <MarketingHeader />

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section className="mesh-gradient-light pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            Trusted by 500+ businesses across 6 industries
          </div>

          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight leading-[1.05]">
            Your phones.<br />
            <span className="gradient-text">Handled by AI.</span>
          </h1>

          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Book appointments, handle missed calls, send two-way SMS, and run outbound campaigns — all on autopilot.
            Never miss a call again.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              Try Free — 10 min →
            </Link>
            <Link
              href="/pricing#plans"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-800 bg-white border border-cream-200 rounded-xl hover:bg-cream-50 transition-colors"
            >
              See plans &amp; pricing →
            </Link>
          </div>

          {/* Call-me-now widget — visitor's phone rings in ~5s with a demo AI.
              Highest-CVR conversion lever on the page. */}
          <div className="mt-10">
            <CallMeWidget />
          </div>

          <p className="text-xs text-cream-500 mt-5">
            No contracts · Voice + SMS · Setup in 10 minutes
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          VOICE SAMPLES
      ══════════════════════════════════════════════════════ */}
      <HomepageVoiceSamples />

      {/* ══════════════════════════════════════════════════════
          PRODUCT GRID — INBOUND + OUTBOUND + MESSAGING + DISCOVERY
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-cream-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Four products. One platform.</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Handle every part of the customer journey.
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              Discover leads. Call them. Answer their callbacks. Text the ones who missed you. End-to-end.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Inbound card */}
            <Link
              href="/inbound"
              className="group block rounded-3xl bg-white border border-cream-200 p-8 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Phone size={22} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Inbound</p>
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">{BRAND_NAME}</h3>
                </div>
              </div>
              <p className="text-cream-600 text-sm mb-6 leading-relaxed">
                Your AI answers every inbound call — day, night, weekends, holidays — books appointments straight into your calendar, and switches to Spanish automatically when the caller does.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Answers every call 24/7 — no hold music',
                  'Books, reschedules & cancels appointments',
                  'Escalates emergencies to staff within seconds',
                  'Full call transcript + AI summary in dashboard',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:gap-3 transition-all">
                Learn more about Inbound <ArrowRight size={15} />
              </div>
            </Link>

            {/* Outbound card */}
            <Link
              href="/outbound"
              className="group block rounded-3xl bg-white border border-cream-200 p-8 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center">
                  <Megaphone size={22} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-600 uppercase tracking-[0.2em]">Outbound</p>
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">AI Caller</h3>
                </div>
              </div>
              <p className="text-cream-600 text-sm mb-6 leading-relaxed">
                Your AI calls inactive contacts, follows up on unbooked leads, and runs recall campaigns — booking real appointments while your team handles the people in front of them.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Dials your lead lists automatically',
                  'Qualifies prospects with natural conversation',
                  'Books appointments from cold leads',
                  'Retry logic with configurable schedules',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-brand-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:gap-3 transition-all">
                Learn more about Outbound <ArrowRight size={15} />
              </div>
            </Link>

            {/* Messaging card */}
            <Link
              href="/pricing#plans"
              className="group block rounded-3xl bg-white border border-cream-200 p-8 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <MessageSquare size={22} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">Messaging</p>
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Two-way SMS</h3>
                </div>
              </div>
              <p className="text-cream-600 text-sm mb-6 leading-relaxed">
                Your AI texts back missed callers in seconds, sends appointment reminders, and your team picks up the thread from a shared inbox — all from your business number.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Two-way SMS inbox tied to every contact',
                  'Appointment reminder SMS (24h + 2h)',
                  'Missed-call text-back under 10 seconds',
                  'Reply CONFIRM / CANCEL to manage bookings',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:gap-3 transition-all">
                Included on Growth & Scale <ArrowRight size={15} />
              </div>
            </Link>

            {/* Lead Discovery card (Phase 12.7) */}
            <Link
              href="/lead-discovery"
              className="group block rounded-3xl bg-white border border-cream-200 p-8 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Crosshair size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em]">Discovery</p>
                  <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Lead Finder</h3>
                </div>
              </div>
              <p className="text-cream-600 text-sm mb-6 leading-relaxed">
                No list to call yet? Describe who you want — &ldquo;dentists in Chicago, rated 4.0+&rdquo; — and we pull real, current leads from Google Maps straight into a campaign. Pay only per lead you keep.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Phone, address, rating, website on every lead',
                  'Filter by location, radius, category, rating',
                  'Review each lead before it counts toward billing',
                  'Imports straight into a draft AI campaign',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:gap-3 transition-all">
                $0.99 per imported lead <ArrowRight size={15} />
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              From first ring to booked appointment — in seconds.
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
                desc: 'Greets callers, books appointments, answers questions, and escalates emergencies — instantly, 24/7.',
              },
              {
                n: '3',
                title: 'Watch the results',
                desc: 'Every call logged, every booking tracked. Full transcripts, recordings, and analytics in one dashboard.',
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

      {/* ══════════════════════════════════════════════════════
          INDUSTRIES
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-cream-200 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Industries</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Built for businesses<br />that live on the phone.
            </h2>
            <p className="text-cream-600 mt-3 text-lg">Six verticals. One AI receptionist tuned for each.</p>
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
                <ul className="space-y-1.5 mb-5">
                  {v.bullets.map((b) => (
                    <li key={b} className="text-sm text-cream-700 flex items-start gap-2">
                      <span className="text-brand-500 mt-1 shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5 border-t border-cream-200">
                  <p className="text-sm text-cream-800 italic leading-relaxed mb-2">{v.quote}</p>
                  <p className="text-xs text-cream-500">— {v.attribution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PRICING PREVIEW
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Pricing</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Simple pricing.<br />No surprises.
            </h2>
            <p className="text-cream-600 mt-3 text-lg">Monthly or annual. Cancel anytime.</p>
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
                      ⭐ Most Popular
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

      {/* ══════════════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          LIVES INSIDE YOUR CRM (Phase 13)
      ══════════════════════════════════════════════════════ */}
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
          <div className="mt-10">
            <Link
              href="/legal"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-900 underline-offset-4 hover:underline"
            >
              See AI Receptionist for law firms <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          WORKS WITH STRIP
      ══════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <section className="bg-cream-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-cream-400 uppercase tracking-[0.2em] mb-6">Get started today</p>
          <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-5 leading-tight">
            Start in 10 minutes.<br />
            <span className="gradient-text">No contracts.</span>
          </h2>
          <p className="text-cream-400 text-lg mb-10 max-w-xl mx-auto">
            Join 500+ businesses that let AI handle the phones.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing#plans"
              className="glow-btn inline-flex items-center gap-2 px-9 py-4 text-base font-bold text-white bg-brand-600 rounded-2xl"
            >
              See plans &amp; pricing →
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-cream-200 border border-white/20 rounded-2xl hover:bg-white/5 transition-all"
            >
              See a live demo
            </Link>
          </div>
          <p className="mt-6 text-sm text-cream-500">Pay monthly or annual · Cancel anytime · Setup under 10 minutes</p>
        </div>
      </section>

      <MarketingFooter />

    </div>
  );
}
