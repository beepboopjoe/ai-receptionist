// ============================================================
// /legal — Phase 15. Public marketing landing for law firms.
// Composes the vertical-landing kit with content from
// vertical-landing-content.ts (the `legal` block).
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Shield,
  ArrowRight,
  // Proactive-Outbound campaigns
  PhoneCall,
  RefreshCw,
  Calendar,
  ClipboardList,
  Banknote,
  Star,
  // Practice areas
  HeartPulse,
  HeartHandshake,
  ShieldAlert,
  Globe2,
  ScrollText,
  Wallet,
  HardHat,
  Briefcase,
  Building2,
  // Compliance & Ethics
  ShieldCheck,
  Mic,
  Gavel,
} from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { VerticalHero } from '@/components/marketing/vertical-landing/vertical-hero';
import { VerticalCrmStrip } from '@/components/marketing/vertical-landing/vertical-crm-strip';
import { VerticalFeaturesGrid } from '@/components/marketing/vertical-landing/vertical-features-grid';
import { VerticalRoiBlock } from '@/components/marketing/vertical-landing/vertical-roi-block';
import { VerticalFaq } from '@/components/marketing/vertical-landing/vertical-faq';
import { RoiCalculator } from '@/components/marketing/roi-calculator';
import { content } from '@/lib/vertical-landing-content';

// SampleCallPlayer is client-side only — defer to keep the page server-rendered.
const SampleCallPlayer = dynamic(
  () => import('@/components/ui/sample-call-player').then((m) => m.SampleCallPlayer),
  { ssr: false }
);

const c = content.legal;

export const metadata = {
  title: c.seo.title,
  description: c.seo.description,
};

export default function LegalLandingPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <MarketingHeader />

      <VerticalHero
        eyebrow={c.hero.eyebrow}
        headline={c.hero.headline}
        headlineGradientSuffix={c.hero.headlineGradientSuffix}
        subhead={c.hero.subhead}
        accentChipClass={c.hero.accentChipClass}
      />

      <VerticalFeaturesGrid
        eyebrow={c.features.eyebrow}
        heading={c.features.heading}
        features={c.features.items}
        iconGradient={c.features.iconGradient}
      />

      {/* ═══ PROACTIVE OUTBOUND CAMPAIGNS — Phase 24 ═══
          The thing that sets us apart from Smith.ai / Ruby:
          we don't just answer the phone, we make outbound calls
          on the firm's behalf. Six legal-tuned campaigns. */}
      <section className="py-20 px-6 bg-white border-y border-cream-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-[0.2em] mb-3">
              Proactive outbound
            </p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">
              Six campaigns your AI runs <span className="gradient-text">while you sleep.</span>
            </h2>
            <p className="text-cream-600 max-w-2xl mx-auto">
              Most AI receptionists only answer inbound. Yours calls clients back on its own — the work
              your associates know they should do and never have time to actually pick up the phone for.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                Icon: PhoneCall,
                title: 'Consult no-show recovery',
                body: 'AI dials scheduled consults at 24 hours and 2 hours before the appointment. Cancellations reschedule on the same call instead of ghosting your calendar.',
              },
              {
                Icon: ClipboardList,
                title: 'Engagement-letter follow-up',
                body: 'Reaches out to clients whose retainer is signed but who haven\'t returned scheduling forms, medical authorizations, or document requests. Polite, persistent, on a cadence you set.',
              },
              {
                Icon: Calendar,
                title: 'Court-date reminders',
                body: 'Pulls upcoming hearing dates from Clio or Filevine and confirms the client knows the time, courtroom, and what to bring. Catches misunderstandings before they become missed appearances.',
              },
              {
                Icon: RefreshCw,
                title: 'Stale-lead reactivation',
                body: 'Every prospect who inquired but never booked gets a follow-up call on a configurable cadence. Dormant pipeline you already paid to acquire becomes signed retainers — typical 8-12× reactivation lift.',
              },
              {
                Icon: Banknote,
                title: 'Settlement-check pickup',
                body: 'When PI or workers-comp funds clear, the AI calls the client to coordinate signing, disbursement, and final-fee paperwork. No more chasing clients for the last 10% of the matter.',
              },
              {
                Icon: Star,
                title: 'Past-client referral asks',
                body: 'Polite quarterly outreach to closed-matter clients asking for referrals. The single highest-ROI outbound program for any law firm — and the one that never gets done because everyone is busy.',
              },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl bg-cream-50 border border-cream-200 p-6 hover:shadow-sm hover:border-indigo-200 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-white" />
                </div>
                <h3 className="font-semibold text-cream-900 text-base mb-2">{title}</h3>
                <p className="text-sm text-cream-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-cream-500 mt-8">
            All six campaigns are configurable in <span className="font-mono text-cream-700">/campaigns</span> and run as recurring jobs.
            Outbound dialing is included on every paid plan; minute usage counts toward your monthly cap.
          </p>
        </div>
      </section>

      {/* ═══ SAMPLE CALL ═══ */}
      <section className="py-20 px-6 bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
              Hear it in action
            </p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">
              A real intake call.
            </h2>
            <p className="text-cream-600 max-w-xl mx-auto">
              Below is a scripted demo using our actual AI voice. English and Spanish samples available.
            </p>
          </div>
          <SampleCallPlayer vertical="legal" callType="inbound" />
        </div>
      </section>

      <VerticalCrmStrip
        heading={c.crmStrip.heading}
        {...(c.crmStrip.subhead ? { subhead: c.crmStrip.subhead } : {})}
        crms={c.crmStrip.crms}
        background="white"
      />

      {/* ═══ PRACTICE AREAS — Phase 24 ═══
          "Where we fit" tag cloud. Lighter visual weight than a feature grid
          on purpose — most visitors skim this, signal that they recognize
          themselves, and keep scrolling. */}
      <section className="py-20 px-6 bg-cream-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-[0.2em] mb-3">
              Practice areas
            </p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">
              Tuned for the practice areas <span className="gradient-text">you actually run.</span>
            </h2>
            <p className="text-cream-600 max-w-2xl mx-auto">
              The intake vocabulary, escalation triggers, and outbound cadence are configurable per
              practice area. Out of the box we ship tuned defaults for these nine.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                Icon: HeartPulse,
                area: 'Personal Injury',
                tune: 'Statute-of-limitations vocabulary, medical-treatment follow-up campaigns, settlement-check pickup outreach.',
              },
              {
                Icon: HeartHandshake,
                area: 'Family Law',
                tune: 'Sensitive-intake tone, custody/divorce escalation triggers, court-date reminders for hearings and mediations.',
              },
              {
                Icon: ShieldAlert,
                area: 'Criminal Defense',
                tune: '"Arrested", "served papers", "warrant" route to your on-call cell immediately. Jail-call intake supported.',
              },
              {
                Icon: Globe2,
                area: 'Immigration',
                tune: 'Multilingual intake in Spanish, Arabic, Farsi, Armenian, Russian. USCIS appointment reminders + interview-prep nudges.',
              },
              {
                Icon: ScrollText,
                area: 'Estate Planning',
                tune: 'Appointment-based, low-urgency cadence. Annual-review outreach campaigns to existing clients.',
              },
              {
                Icon: Wallet,
                area: 'Bankruptcy',
                tune: '341-meeting reminders, document-collection follow-ups, automatic-stay-question escalation to a human.',
              },
              {
                Icon: HardHat,
                area: "Workers' Comp",
                tune: 'First-notice-of-injury intake fields, IME appointment reminders, medical-records pickup coordination.',
              },
              {
                Icon: Briefcase,
                area: 'Business Law',
                tune: 'Consultative tone, contract-review intake, scheduled quarterly check-ins with retained corporate clients.',
              },
              {
                Icon: Building2,
                area: 'Real Estate Law',
                tune: 'Closing-day coordination, title-issue escalation, document-signing reminders.',
              },
            ].map(({ Icon, area, tune }) => (
              <div
                key={area}
                className="rounded-2xl bg-white border border-cream-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-cream-900 text-sm mb-1">{area}</h3>
                    <p className="text-xs text-cream-600 leading-relaxed">{tune}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-cream-500 mt-8">
            Don't see your practice area? The AI ships with a generic-legal mode that handles any
            matter type — and you can tune the vocabulary in <span className="font-mono text-cream-700">/settings/voice-agent</span>.
          </p>
        </div>
      </section>

      <VerticalRoiBlock heading={c.roi.heading} stats={c.roi.stats} />

      <RoiCalculator vertical="legal" />

      {/* TrustStrip removed (Phase 19.2) + TestimonialGrid removed (Phase 19.1)
          until real customer logos + quotes. */}

      {/* ═══ TESTIMONIAL (placeholder until real customer quote available) ═══ */}
      <section className="py-20 px-6 bg-white border-y border-cream-200">
        <div className="max-w-3xl mx-auto">
          <div
            className={`rounded-2xl p-8 ${
              c.testimonial.real
                ? 'bg-cream-50 border border-cream-200'
                : 'bg-amber-50 border-2 border-dashed border-amber-300'
            }`}
          >
            {!c.testimonial.real && (
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-4">
                Placeholder — swap me when you have a real quote
              </p>
            )}
            <p className="text-xl text-cream-800 leading-relaxed italic">
              &ldquo;{c.testimonial.quote}&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cream-300" aria-hidden />
              <div>
                <div className="font-semibold text-cream-900">{c.testimonial.name}</div>
                <div className="text-sm text-cream-600">{c.testimonial.firmOrPractice}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VerticalFaq {...(c.faq.heading ? { heading: c.faq.heading } : {})} items={c.faq.items} />

      {/* ═══ COMPLIANCE & ETHICS — Phase 24 ═══
          The three questions every careful attorney asks. Candid + concrete —
          no "consult your local bar" hedging. */}
      <section className="py-20 px-6 bg-white border-y border-cream-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-[0.2em] mb-3">
              Compliance &amp; ethics
            </p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">
              The questions every careful attorney <span className="gradient-text">asks first.</span>
            </h2>
            <p className="text-cream-600 max-w-2xl mx-auto">
              We&apos;ve built the product to give the answers your state bar wants to hear.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                Icon: Gavel,
                title: 'The AI never gives legal advice',
                body: 'Every system prompt forbids it. The AI collects facts, books consults, and escalates anything substantive to a human attorney. It will not predict case outcomes, interpret statutes, or imply the existence of an attorney-client relationship.',
              },
              {
                Icon: Mic,
                title: 'Recording disclosure handled per state',
                body: 'In two-party-consent states (CA, FL, IL, MA, MD, MT, NH, PA, WA) every call opens with an explicit recording-and-AI announcement. One-party states use the standard intake disclosure. Configurable per tenant.',
              },
              {
                Icon: ShieldCheck,
                title: 'ABA Model Rule 5.5 supervision posture',
                body: 'The AI never represents itself as an attorney. Every transcript routes back to your firm for review; you retain the supervising-attorney relationship. The product is intake software — your engagement letter is what establishes representation downstream.',
              },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl bg-cream-50 border border-cream-200 p-6"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-indigo-600" />
                </div>
                <h3 className="font-semibold text-cream-900 text-base mb-2">{title}</h3>
                <p className="text-sm text-cream-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-cream-500 mt-8">
            Privileged data is encrypted at rest, access-controlled to your firm only, and
            <strong className="text-cream-700"> never used for AI training</strong> or shared across tenants.
          </p>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="bg-cream-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight mb-5">
            {c.finalCta.heading}
            <br />
            <span className="gradient-text">{c.finalCta.headingGradientSuffix}</span>
          </h2>
          <p className="text-cream-400 text-lg mb-10 max-w-xl mx-auto">{c.finalCta.subhead}</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
          >
            {c.finalCta.primaryCtaLabel} <ArrowRight size={16} />
          </Link>
          {c.finalCta.secondaryNote && (
            <div className="flex items-center justify-center gap-2 mt-8 text-xs text-cream-500">
              <Shield size={12} />
              <span>{c.finalCta.secondaryNote}</span>
            </div>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
