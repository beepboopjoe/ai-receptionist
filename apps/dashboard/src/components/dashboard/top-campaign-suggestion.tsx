// ============================================================
// TopCampaignSuggestion — single hero card on /dashboard surfacing
// the goal-driven campaign opportunity with the highest candidate
// count. One click builds a draft and redirects to its detail page.
//
// Hides itself when there are no actionable goals so the dashboard
// doesn't show an empty section for tenants without data yet.
// ============================================================
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { campaignGoalsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useFeatureFlags } from '@/lib/featureFlags';

export function TopCampaignSuggestion() {
  const router = useRouter();
  const toast = useToast();
  const { has, loading: flagsLoading } = useFeatureFlags();
  const outboundEnabled = flagsLoading ? true : has('outbound_campaigns');

  const { data, isLoading } = useSWR('campaign-goal-suggestions', () =>
    campaignGoalsApi.suggestions()
  );

  const [launching, setLaunching] = useState(false);

  // Pick the goal with the highest candidate count. Skip goals with zero
  // candidates — same actionable filter the gallery applies.
  const top = (data?.suggestions ?? [])
    .filter((g) => g.candidateCount > 0)
    .sort((a, b) => b.candidateCount - a.candidateCount)[0];

  if (isLoading || !top) return null;

  async function handleLaunch() {
    if (!top) return;
    if (!outboundEnabled) {
      router.push('/billing');
      return;
    }
    setLaunching(true);
    try {
      const result = await campaignGoalsApi.fromGoal(top.slug);
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

  return (
    <div className="card p-5 bg-gradient-to-r from-brand-50 to-amber-50 border-brand-200">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-amber-500 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">
            Top campaign opportunity
          </p>
          <p className="font-semibold text-cream-900 mt-0.5">
            {top.title}{' '}
            <span className="text-brand-700 font-bold">· {top.candidateCount} ready</span>
          </p>
          <p className="text-xs text-cream-700 mt-1 leading-relaxed">{top.description}</p>
        </div>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={launching}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-700 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {launching ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Building…
            </>
          ) : (
            <>
              Launch as draft
              <ArrowRight size={13} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
