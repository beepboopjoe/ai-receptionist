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
const DashboardTeaser = dynamic(
  () => import('@/components/ui/dashboard-teaser').then((m) => m.DashboardTeaser),
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

      {/* ═══ DASHBOARD PREVIEW — Phase 26b polish ═══
          Mirrors the position-3 pattern used on /inbound, /outbound,
          /demo, and the homepage. Breaks up the run of card grids
          and gives lawyers a concrete picture of what they'll see
          when they log in. */}
      <section className="bg-cream-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <DashboardTeaser />
        </div>
      </section>

      {/* ═══ PROACTIVE OUTBOUND CAMPAIGNS — restyled Phase 26b ═══
          Was a 6-card grid (visually identical to the Features grid
          immediately above). Now a numbered timeline so it reads as
          a sequence the firm can actually adopt one-at-a-time.
          Alternating-side layout breaks the monotony entirely. */}
      <section className="py-20 px-6 bg-white border-y border-cream-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
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

          {/* Vertical timeline with an indigo rail down the middle on desktop,
              left-aligned on mobile. Each row alternates which side the card
              sits on; the number sits on the rail. */}
          <ol className="relative space-y-10 md:space-y-14">
            {/* Rail — desktop only */}
            <div
              aria-hidden
              className="hidden md:block absolute left-1/2 top-2 bottom-2 -translate-x-1/2 w-px bg-gradient-to-b from-indigo-200 via-indigo-300 to-violet-200"
            />
            {[
              {
                Icon: PhoneCall,
                title: 'Consult no-show recovery',
                body: 'AI dials scheduled consults at 24 hours and 2 hours before the appointment. Cancellations reschedule on the same call instead of ghosting your calendar.',
              },
              {
                Icon: ClipboardList,
                title: 'Engagement-letter follow-up',
                body: "Reaches out to clients whose retainer is signed but who haven't returned scheduling forms, medical authorizations, or document requests. Polite, persistent, on a cadence you set.",
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
            ].map(({ Icon, title, body }, i) => {
              const isLeft = i % 2 === 0;
              const cardClasses = `rounded-xl bg-cream-50 border border-cream-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all ${
                isLeft ? 'md:text-right' : 'md:text-left'
              }`;
              const iconWrapClasses = `w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mb-3 ${
                isLeft ? 'md:ml-auto' : ''
              }`;
              return (
                <li
                  key={title}
                  className="relative md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6 md:items-start"
                >
                  {/* Desktop: card on left if even, on right if odd. Mobile: always full width below the number row. */}
                  <div
                    className={`hidden md:block ${isLeft ? 'md:col-start-1 md:pr-2' : 'md:col-start-3 md:pl-2'}`}
                  >
                    <div className={cardClasses}>
                      <div className={iconWrapClasses}>
                        <Icon size={18} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-cream-900 text-base mb-2">{title}</h3>
                      <p className="text-sm text-cream-600 leading-relaxed">{body}</p>
                    </div>
                  </div>

                  {/* Number badge — sits on the rail (desktop) or leads the mobile row */}
                  <div className="md:col-start-2 flex md:block items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-serif text-lg md:text-xl flex items-center justify-center shadow-md shadow-indigo-200 shrink-0 z-10 ring-4 ring-white">
                      {i + 1}
                    </div>
                    {/* Mobile-only inline title so the number isn't orphaned */}
                    <p className="md:hidden font-semibold text-cream-900 text-base">{title}</p>
                  </div>

                  {/* Mobile-only card body */}
                  <div className="md:hidden mt-3 ml-13">
                    <p className="text-sm text-cream-600 leading-relaxed">{body}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="text-center text-xs text-cream-500 mt-12">
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
          {/* Restyled Phase 26b: compact pill grid instead of large 3-col cards.
              Each pill expands inline on hover/focus to reveal its tuning note —
              keeps the section visually quiet vs. the timeline above. */}
          <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
            {[
              {
                Icon: HeartPulse,
                area: 'Personal Injury',
                tune: 'Statute-of-limitations vocabulary · medical-treatment follow-up · settlement-check pickup.',
              },
              {
                Icon: HeartHandshake,
                area: 'Family Law',
                tune: 'Sensitive-intake tone · custody/divorce escalation triggers · hearing & mediation reminders.',
              },
              {
                Icon: ShieldAlert,
                area: 'Criminal Defense',
                tune: '"Arrested", "served papers", "warrant" route to on-call cell immediately. Jail-call intake supported.',
              },
              {
                Icon: Globe2,
                area: 'Immigration',
                tune: 'Multilingual: Spanish, Arabic, Farsi, Armenian, Russian. USCIS appointment + interview-prep nudges.',
              },
              {
                Icon: ScrollText,
                area: 'Estate Planning',
                tune: 'Appointment-based, low-urgency cadence. Annual-review outreach to existing clients.',
              },
              {
                Icon: Wallet,
                area: 'Bankruptcy',
                tune: '341-meeting reminders · document-collection follow-ups · automatic-stay escalation.',
              },
              {
                Icon: HardHat,
                area: "Workers' Comp",
                tune: 'First-notice-of-injury fields · IME appointment reminders · medical-records pickup.',
              },
              {
                Icon: Briefcase,
                area: 'Business Law',
                tune: 'Consultative tone · contract-review intake · quarterly check-ins with retained corporate clients.',
              },
              {
                Icon: Building2,
                area: 'Real Estate Law',
                tune: 'Closing-day coordination · title-issue escalation · document-signing reminders.',
              },
            ].map(({ Icon, area, tune }) => (
              <details
                key={area}
                className="group rounded-full bg-white border border-cream-200 hover:border-indigo-300 open:rounded-2xl open:bg-cream-50 open:border-indigo-300 transition-all open:max-w-xl"
              >
                <summary className="flex items-center gap-2 px-4 py-2 cursor-pointer list-none select-none">
                  <Icon size={15} className="text-indigo-600 shrink-0" />
                  <span className="text-sm font-semibold text-cream-900">{area}</span>
                  <span className="text-cream-400 text-xs group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="px-4 pb-3 -mt-1 text-xs text-cream-600 leading-relaxed">{tune}</p>
              </details>
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
