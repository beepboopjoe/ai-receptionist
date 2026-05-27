// ============================================================
// Vertical landing — CRM strip.
// "Connects to your firm's CRM" — shows hard-coded CRM list with
// optional "Coming soon" badges. Prop-driven so each vertical
// passes its own relevant CRMs.
// ============================================================
export interface CrmStripItem {
  id: string;
  label: string;
  icon: string;
  /** Visual badge: 'Native' (real adapter shipped), 'Coming soon', or omitted. */
  badge?: 'Native' | 'Coming soon';
}

export interface VerticalCrmStripProps {
  eyebrow?: string;
  heading: string;
  subhead?: string;
  crms: CrmStripItem[];
  /** Section background — defaults to cream. */
  background?: 'cream' | 'white';
}

export function VerticalCrmStrip({
  eyebrow = 'Works inside your CRM',
  heading,
  subhead,
  crms,
  background = 'cream',
}: VerticalCrmStripProps) {
  const bgClass = background === 'white' ? 'bg-white border-y border-cream-200' : 'bg-cream-50';
  return (
    <section className={`py-20 px-6 ${bgClass}`}>
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
          {eyebrow}
        </p>
        <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight mb-3">
          {heading}
        </h2>
        {subhead && (
          <p className="text-cream-600 max-w-2xl mx-auto mb-10">{subhead}</p>
        )}
        <div className={`grid gap-4 mt-10 max-w-3xl mx-auto grid-cols-2 md:grid-cols-${Math.min(crms.length, 5)}`}>
          {crms.map((crm) => (
            <div
              key={crm.id}
              className="bg-white rounded-lg border border-cream-200 p-5 flex flex-col items-center gap-2 relative"
            >
              <div className="text-3xl">{crm.icon}</div>
              <div className="text-sm font-semibold text-cream-800">{crm.label}</div>
              {crm.badge && (
                <div
                  className={`text-[10px] uppercase tracking-wide font-bold ${
                    crm.badge === 'Coming soon' ? 'text-cream-400' : 'text-brand-600'
                  }`}
                >
                  {crm.badge}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
