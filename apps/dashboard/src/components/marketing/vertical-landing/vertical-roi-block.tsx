// ============================================================
// Vertical landing — ROI / stats block.
// 3 big-number cells with supporting copy.
// ============================================================
export interface RoiStat {
  /** Big-display value — e.g. "63%", "$2,400", "0". */
  value: string;
  /** Supporting paragraph below the number. */
  body: string;
}

export interface VerticalRoiBlockProps {
  heading: string;
  stats: RoiStat[];
}

export function VerticalRoiBlock({ heading, stats }: VerticalRoiBlockProps) {
  return (
    <section className="py-20 px-6 bg-cream-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            {heading}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="text-center px-4">
              <div className="text-5xl font-serif text-brand-600 mb-3">{stat.value}</div>
              <p className="text-cream-700 leading-relaxed text-sm">{stat.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
