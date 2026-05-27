// ============================================================
// Vertical landing — 3-column features grid.
// "What the AI handles" — vertical-specific value props.
// ============================================================
import type { LucideIcon } from 'lucide-react';

export interface FeatureGridItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface VerticalFeaturesGridProps {
  eyebrow?: string;
  heading: string;
  features: FeatureGridItem[];
  /** Gradient color for the icon tiles — Tailwind from-/to- classes. */
  iconGradient?: string;
}

export function VerticalFeaturesGrid({
  eyebrow,
  heading,
  features,
  iconGradient = 'from-indigo-500 to-violet-500',
}: VerticalFeaturesGridProps) {
  return (
    <section className="py-20 px-6 bg-white border-y border-cream-200">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          {eyebrow && (
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
              {eyebrow}
            </p>
          )}
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            {heading}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="bg-cream-50 rounded-2xl p-6 border border-cream-200">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center mb-4`}
              >
                <feature.icon size={20} className="text-white" />
              </div>
              <h3 className="font-semibold text-lg text-cream-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-cream-600 leading-relaxed">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
