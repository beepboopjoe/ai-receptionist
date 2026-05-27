// ============================================================
// Vertical landing — hero section.
// Prop-driven so /legal, /dental, etc. each pass their own copy.
// ============================================================
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface VerticalHeroProps {
  /** Short eyebrow chip text — e.g. "For Law Firms" */
  eyebrow: string;
  /** Plain headline text — last few words become gradient-text */
  headline: string;
  /** Words at the end of headline that should be wrapped in the gradient span */
  headlineGradientSuffix: string;
  /** Sub-headline paragraph */
  subhead: string;
  /** Primary CTA — defaults to /signup */
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  /** Secondary CTA — defaults to /pricing */
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  /** Tailwind accent classes for the eyebrow chip (bg + text) */
  accentChipClass?: string;
}

export function VerticalHero({
  eyebrow,
  headline,
  headlineGradientSuffix,
  subhead,
  primaryCtaLabel = 'Start free trial',
  primaryCtaHref = '/signup',
  secondaryCtaLabel = 'See pricing',
  secondaryCtaHref = '/pricing',
  accentChipClass = 'bg-indigo-100 text-indigo-700',
}: VerticalHeroProps) {
  return (
    <section className="mesh-gradient-light pt-24 pb-20 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6 ${accentChipClass}`}
        >
          {eyebrow}
        </span>
        <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight mb-6 leading-tight">
          {headline}
          {headlineGradientSuffix && (
            <>
              <br />
              <span className="gradient-text">{headlineGradientSuffix}</span>
            </>
          )}
        </h1>
        <p className="text-xl text-cream-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          {subhead}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryCtaHref}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
          >
            {primaryCtaLabel} <ArrowRight size={16} />
          </Link>
          <Link
            href={secondaryCtaHref}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg border border-cream-300 text-cream-800 font-semibold hover:bg-white transition-colors"
          >
            {secondaryCtaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
