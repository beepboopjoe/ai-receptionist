'use client';
// ============================================================
// LockedFeature — blur/badge overlay for tier-gated modules
//
// Usage:
//   <LockedFeature requiredPlan="growth" reason="outbound_locked">
//     <SomeComponent />
//   </LockedFeature>
//
// The children are always rendered (blurred) so the layout
// stays intact — we never hide gated features.
// ============================================================
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { UpgradeModal } from './upgrade-modal';
import type { UpgradeReason } from './upgrade-modal';

interface LockedFeatureProps {
  requiredPlan: 'growth' | 'pro';
  reason: UpgradeReason;
  /** Optional override for the lock overlay label */
  label?: string;
  children: React.ReactNode;
}

export function LockedFeature({
  requiredPlan,
  reason,
  label,
  children,
}: LockedFeatureProps) {
  const [open, setOpen] = useState(false);
  const planLabel = requiredPlan === 'pro' ? 'Pro' : 'Growth';

  return (
    <>
      <UpgradeModal open={open} onClose={() => setOpen(false)} reason={reason} />
      <div className="relative rounded-xl overflow-hidden">
        {/* Blurred content — pointer-events disabled so clicks don't leak */}
        <div className="blur-sm pointer-events-none select-none opacity-50">
          {children}
        </div>
        {/* Lock overlay */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute inset-0 flex items-center justify-center w-full h-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 rounded-xl"
          aria-label={`Unlock ${label ?? planLabel + ' feature'}`}
        >
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-5 py-4 shadow-lg border border-cream-200 text-center max-w-xs">
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-2">
              <Lock size={15} className="text-brand-600" />
            </div>
            <p className="text-sm font-semibold text-cream-900">
              {label ?? `Requires ${planLabel} plan`}
            </p>
            <p className="text-xs text-brand-600 font-medium mt-1.5 group-hover:underline">
              Upgrade to unlock →
            </p>
          </div>
        </button>
      </div>
    </>
  );
}
