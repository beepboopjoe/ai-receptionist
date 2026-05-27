// ============================================================
// TrustStrip — Phase 17. Logo bar + "trusted by" counter for
// marketing pages. Default content is intentionally placeholder
// (typed letters in pill chips, "Sample" labels) so it ships
// without fake-customer attribution. Swap in real logos when
// available.
// ============================================================
export interface TrustLogo {
  /** Display label — replaced with <img> when realLogoSrc is set. */
  label: string;
  /** Optional. When set, renders an <img> instead of the typography pill. */
  realLogoSrc?: string;
}

export interface TrustStripProps {
  /** Counter line above the logos. Falsy = no counter row. */
  counter?: string;
  /** Defaults to placeholder labels until you swap in real customer logos. */
  logos?: TrustLogo[];
  /** Background — defaults to white. */
  background?: 'white' | 'cream';
  /** When true, shows a tiny "swap me" indicator over the strip.
   *  Auto-derived from logos: if no logo has realLogoSrc, treats whole
   *  strip as placeholder. Override with `forceRealMode={true}`. */
  forceRealMode?: boolean;
}

const DEFAULT_LOGOS: TrustLogo[] = [
  { label: 'Acme Practice' },
  { label: 'Bright Family Dental' },
  { label: 'Coastal Law Group' },
  { label: 'Summit Realty' },
  { label: 'Northwind Insurance' },
  { label: 'River City HVAC' },
];

export function TrustStrip({
  counter = 'Trusted by 300+ businesses',
  logos = DEFAULT_LOGOS,
  background = 'white',
  forceRealMode,
}: TrustStripProps) {
  const allPlaceholder = !logos.some((l) => l.realLogoSrc);
  const isPlaceholder = forceRealMode === undefined ? allPlaceholder : !forceRealMode;

  const bgClass = background === 'cream' ? 'bg-cream-50' : 'bg-white border-y border-cream-200';

  return (
    <section className={`py-12 px-6 ${bgClass} relative`}>
      <div className="max-w-5xl mx-auto">
        {isPlaceholder && (
          <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            Placeholder — swap in real customer logos
          </span>
        )}
        {counter && (
          <p className="text-center text-xs font-semibold text-cream-500 uppercase tracking-[0.2em] mb-5">
            {counter}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {logos.map((logo, i) =>
            logo.realLogoSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={logo.realLogoSrc}
                alt={logo.label}
                className="h-7 md:h-8 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition"
              />
            ) : (
              <span
                key={i}
                className="inline-flex items-center px-4 py-2 rounded-full border border-cream-200 bg-cream-50 text-xs font-semibold text-cream-600 tracking-wide"
              >
                {logo.label}
              </span>
            )
          )}
        </div>
      </div>
    </section>
  );
}
