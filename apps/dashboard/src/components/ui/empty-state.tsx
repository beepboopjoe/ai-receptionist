// ============================================================
// EmptyState — single visual treatment for "no data yet" cells.
// Replaces the per-page "No patients found" / "No calls yet" /
// "Waiting for activity…" lines so empty states look consistent.
// ============================================================
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Icon shown above the label. Pass any lucide-react icon. */
  icon?: LucideIcon;
  /** Short headline (1 line) */
  label: string;
  /** Optional supporting line under the headline */
  hint?: string;
  /** Optional CTA — pass an href (Link) or onClick (button). */
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Compact = smaller padding + icon, used in sidebars and small cards */
  compact?: boolean;
}

export function EmptyState({ icon: Icon, label, hint, cta, compact = false }: EmptyStateProps) {
  const padY = compact ? 'py-6' : 'py-12';
  const iconSize = compact ? 28 : 40;

  return (
    <div className={`text-center ${padY} px-6`}>
      {Icon && (
        <Icon
          size={iconSize}
          className="mx-auto mb-3 text-gray-300"
          aria-hidden="true"
        />
      )}
      <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-gray-600`}>{label}</p>
      {hint && <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-400 mt-1`}>{hint}</p>}
      {cta && (
        <div className="mt-4">
          {cta.href ? (
            <Link href={cta.href} className="btn-primary inline-flex text-sm">
              {cta.label}
            </Link>
          ) : (
            <button onClick={cta.onClick} className="btn-primary text-sm">
              {cta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
