// ============================================================
// LeadDiscoveryCard — promotes the Lead Discovery feature on
// surfaces where the customer has just hit a "no list" wall:
//   - /dashboard home (general awareness)
//   - /contacts empty state ("you have no contacts yet")
//   - /campaigns empty state ("no leads to call")
//
// Same visual language as TopCampaignSuggestion so the dashboard
// keeps a coherent "AI Agent recommends…" feel.
// ============================================================
'use client';
import Link from 'next/link';
import { Crosshair, ArrowRight } from 'lucide-react';

interface LeadDiscoveryCardProps {
  /** Header chip text — defaults to a general tagline; can be overridden by surface. */
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Optional CTA label override. */
  cta?: string;
  /** Compact variant for sidebars / empty-state slots. */
  compact?: boolean;
}

export function LeadDiscoveryCard({
  eyebrow = 'Lead Discovery',
  title = 'Need leads to call?',
  description = "Describe who you want — 'dentists in Chicago, 4.0+ stars, phone required' — and we pull real Google Maps results. Pay only for leads you keep ($0.99/lead).",
  cta = 'Find new leads',
  compact = false,
}: LeadDiscoveryCardProps) {
  return (
    <Link
      href="/leads/discover"
      className={`block rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-brand-50/40 hover:shadow-md transition-shadow ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 ${
            compact ? 'w-9 h-9' : 'w-11 h-11'
          }`}
        >
          <Crosshair size={compact ? 16 : 18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            {eyebrow}
          </p>
          <p className={`font-semibold text-cream-900 mt-0.5 ${compact ? 'text-sm' : ''}`}>
            {title}
          </p>
          <p
            className={`text-cream-700 mt-1 leading-relaxed ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            {description}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-700 transition-colors whitespace-nowrap">
          {cta} <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}
