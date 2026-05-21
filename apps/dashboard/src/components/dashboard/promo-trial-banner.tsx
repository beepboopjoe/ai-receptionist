'use client';
// ============================================================
// PromoTrialBanner — top-of-app strip shown ONLY when this tenant
// was granted a hands-on promo trial via the owner-only
// /admin/tenants/:id/grant-promo-trial endpoint.
//
// Two states:
//   • Under cap → indigo strip showing "X of N minutes used"
//   • At/over cap → red strip with "Trial cap reached — upgrade" CTA
//
// Renders nothing for regular tenants (promoTrial === false).
// ============================================================
import Link from 'next/link';
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { usePlan } from '@/lib/usePlan';

export function PromoTrialBanner() {
  const { promoTrial, capReached, minutesUsed, minutesIncluded, loading } = usePlan();

  if (loading || !promoTrial) return null;

  if (capReached) {
    return (
      <div className="bg-red-600 text-white border-b border-red-700">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle size={16} className="shrink-0" />
            <p className="text-sm font-medium truncate">
              Trial cap reached — your AI is paused.{' '}
              <span className="hidden sm:inline text-red-100">
                You used all {minutesIncluded} promo minutes. Upgrade to keep your line live.
              </span>
            </p>
          </div>
          <Link
            href="/billing"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-red-700 text-xs font-bold hover:bg-red-50 transition-colors shrink-0"
          >
            Upgrade <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  const pct = minutesIncluded > 0
    ? Math.min(100, Math.round((minutesUsed / minutesIncluded) * 100))
    : 0;
  const minutesLeft = Math.max(0, minutesIncluded - minutesUsed);

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-b border-indigo-700">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles size={15} className="shrink-0 text-indigo-100" />
          <p className="text-sm font-medium truncate">
            <span className="font-bold">Promo trial active</span>
            <span className="text-indigo-100 hidden sm:inline">
              {' · '}{minutesUsed} of {minutesIncluded} minutes used
              {' · '}{minutesLeft} left
            </span>
            <span className="text-indigo-100 sm:hidden">{' · '}{minutesLeft} min left</span>
          </p>
        </div>

        {/* Tiny progress bar */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="w-32 h-1.5 bg-indigo-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <Link
            href="/billing"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold transition-colors"
          >
            Upgrade <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
