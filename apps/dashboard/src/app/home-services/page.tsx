// ============================================================
// /home-services — Phase 16. Public marketing landing for HVAC,
// plumbing, electrical, roofing, and other field service businesses.
// Composes the vertical-landing kit with content.home_services.
// ============================================================
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Shield, ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { VerticalHero } from '@/components/marketing/vertical-landing/vertical-hero';
import { VerticalCrmStrip } from '@/components/marketing/vertical-landing/vertical-crm-strip';
import { VerticalFeaturesGrid } from '@/components/marketing/vertical-landing/vertical-features-grid';
import { VerticalRoiBlock } from '@/components/marketing/vertical-landing/vertical-roi-block';
import { VerticalFaq } from '@/components/marketing/vertical-landing/vertical-faq';
import { content } from '@/lib/vertical-landing-content';

const SampleCallPlayer = dynamic(
  () => import('@/components/ui/sample-call-player').then((m) => m.SampleCallPlayer),
  { ssr: false }
);

const c = content.home_services;

export const metadata = {
  title: c.seo.title,
  description: c.seo.description,
};

export default function HomeServicesLandingPage() {
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

      <section className="py-20 px-6 bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
              Hear it in action
            </p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">
              A real service-call intake.
            </h2>
            <p className="text-cream-600 max-w-xl mx-auto">
              Below is a scripted demo using our actual AI voice. English and Spanish samples available.
            </p>
          </div>
          <SampleCallPlayer vertical="home_services" callType="inbound" />
        </div>
      </section>

      <VerticalCrmStrip
        heading={c.crmStrip.heading}
        {...(c.crmStrip.subhead ? { subhead: c.crmStrip.subhead } : {})}
        crms={c.crmStrip.crms}
        background="white"
      />

      <VerticalRoiBlock heading={c.roi.heading} stats={c.roi.stats} />

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
