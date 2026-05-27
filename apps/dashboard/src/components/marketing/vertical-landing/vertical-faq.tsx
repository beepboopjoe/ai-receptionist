// ============================================================
// Vertical landing — FAQ accordion.
// Uses native <details>/<summary> so it works without JS.
// ============================================================
export interface FaqItem {
  q: string;
  a: string;
}

export interface VerticalFaqProps {
  heading?: string;
  items: FaqItem[];
}

export function VerticalFaq({ heading = 'Frequently asked', items }: VerticalFaqProps) {
  return (
    <section className="py-20 px-6 bg-white border-y border-cream-200">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-serif text-4xl text-cream-900 tracking-tight text-center mb-10">
          {heading}
        </h2>
        <div className="space-y-4">
          {items.map((item, i) => (
            <details
              key={i}
              className="group bg-cream-50 rounded-xl border border-cream-200 p-5"
            >
              <summary className="font-semibold text-cream-900 cursor-pointer flex items-center justify-between">
                {item.q}
                <span className="text-cream-400 group-open:rotate-45 transition-transform text-xl leading-none">
                  +
                </span>
              </summary>
              <p className="text-sm text-cream-700 mt-3 leading-relaxed whitespace-pre-line">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
