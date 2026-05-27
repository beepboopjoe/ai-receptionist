// ============================================================
// TestimonialGrid — Phase 17. 3-column grid of customer quote
// cards. Same dashed-amber placeholder treatment as Phase 15's
// single testimonial card when no real quotes are wired in.
// ============================================================
export interface Testimonial {
  quote: string;
  name: string;
  /** Firm / practice / business name. */
  org: string;
  /** Optional role within the org (e.g. "Founding Attorney"). */
  role?: string;
  /** When true, drops the dashed placeholder treatment for this card. */
  real?: boolean;
  /** Optional photo URL. Falls back to a colored circle when absent. */
  photoSrc?: string;
}

export interface TestimonialGridProps {
  eyebrow?: string;
  heading?: string;
  /** Defaults to vertical-agnostic placeholder testimonials.
   *  Pass per-vertical overrides for /legal, /dental, etc. */
  testimonials?: Testimonial[];
  background?: 'cream' | 'white';
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    real: false,
    quote: 'Replace this with a real customer quote. Edit the `testimonials` prop on this page.',
    name: 'Your customer',
    org: 'Their business',
    role: 'Owner',
  },
  {
    real: false,
    quote: 'Three placeholders ship by default; swap in real quotes as you collect them.',
    name: 'Your customer',
    org: 'Their business',
    role: 'Owner',
  },
  {
    real: false,
    quote: 'Mix real and placeholder — only the placeholder cards get the dashed amber treatment.',
    name: 'Your customer',
    org: 'Their business',
    role: 'Owner',
  },
];

export function TestimonialGrid({
  eyebrow = 'What customers say',
  heading = 'Real businesses. Real outcomes.',
  testimonials = DEFAULT_TESTIMONIALS,
  background = 'white',
}: TestimonialGridProps) {
  const bgClass = background === 'cream' ? 'bg-cream-50' : 'bg-white border-y border-cream-200';

  return (
    <section className={`py-20 px-6 ${bgClass}`}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          {eyebrow && (
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              {heading}
            </h2>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={`rounded-2xl p-6 flex flex-col ${
                t.real
                  ? 'bg-cream-50 border border-cream-200'
                  : 'bg-amber-50/60 border-2 border-dashed border-amber-300'
              }`}
            >
              {!t.real && (
                <p className="text-[9px] uppercase tracking-wider font-bold text-amber-700 mb-3">
                  Placeholder — swap me
                </p>
              )}
              <p className="text-cream-800 leading-relaxed italic flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                {t.photoSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={t.photoSrc}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-cream-300" aria-hidden />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-cream-900 text-sm truncate">{t.name}</div>
                  <div className="text-xs text-cream-600 truncate">
                    {t.role ? `${t.role}, ${t.org}` : t.org}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
