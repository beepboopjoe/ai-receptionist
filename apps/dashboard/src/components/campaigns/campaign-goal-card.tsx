// ============================================================
// CampaignGoalCard — single goal tile in the suggestions gallery.
//
// Click "Launch as draft" → POSTs to /campaigns/from-goal → on
// success, redirects to the new campaign's detail page so the
// customer can review and click Start. No auto-dial.
// ============================================================
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Megaphone, Lock } from 'lucide-react';
import { campaignGoalsApi, type CampaignGoalSuggestion } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface CampaignGoalCardProps {
  goal: CampaignGoalSuggestion;
  /** When false, the launch button is disabled and shows the upgrade modal trigger. */
  outboundEnabled: boolean;
  onLocked: () => void;
}

export function CampaignGoalCard({ goal, outboundEnabled, onLocked }: CampaignGoalCardProps) {
  const router = useRouter();
  const toast = useToast();
  const [launching, setLaunching] = useState(false);

  async function handleLaunch() {
    if (!outboundEnabled) {
      onLocked();
      return;
    }
    setLaunching(true);
    try {
      const result = await campaignGoalsApi.fromGoal(goal.slug);
      if (result.campaignId) {
        toast.success(`Draft campaign created with ${result.candidateCount} leads.`);
        router.push(`/campaigns/${result.campaignId}`);
      } else {
        toast.error(result.message ?? 'Could not create the campaign.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the campaign.');
    } finally {
      setLaunching(false);
    }
  }

  // Card visually de-emphasizes itself when there are zero candidates —
  // the parent gallery filters these out so they shouldn't normally render,
  // but defensive styling here is cheap.
  const empty = goal.candidateCount === 0;

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 transition-shadow ${
        empty
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : 'border-cream-200 bg-white hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
          <Megaphone size={16} className="text-brand-600" />
        </div>
        <span className="text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-0.5 whitespace-nowrap">
          {goal.candidateCount} ready
        </span>
      </div>

      <div>
        <p className="font-semibold text-cream-900 text-sm">{goal.title}</p>
        <p className="text-xs text-cream-600 mt-1 leading-relaxed">{goal.description}</p>
      </div>

      <button
        type="button"
        onClick={handleLaunch}
        disabled={launching || empty}
        className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors px-4 py-2 ${
          outboundEnabled
            ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        {launching ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Building draft…
          </>
        ) : !outboundEnabled ? (
          <>
            <Lock size={13} />
            Upgrade to launch
          </>
        ) : (
          <>
            Launch as draft
            <ArrowRight size={13} />
          </>
        )}
      </button>
    </div>
  );
}
