// ============================================================
// CampaignGoalGallery — fetches goal suggestions and renders
// CampaignGoalCard grid. Hides goals with zero candidates so
// the gallery only shows actionable opportunities.
//
// Used on:
//   /campaigns         (replaces empty state when no campaigns, or
//                       renders above the table when campaigns exist)
//   (optionally) other surfaces that want a goal-driven proactive UI.
// ============================================================
'use client';
import useSWR from 'swr';
import { campaignGoalsApi } from '@/lib/api';
import { CampaignGoalCard } from './campaign-goal-card';
import { Sparkles } from 'lucide-react';

interface CampaignGoalGalleryProps {
  outboundEnabled: boolean;
  onLocked: () => void;
  /** Optional title — defaults to a generic one. */
  title?: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** When true, render in a more compact 2-col-max layout. */
  compact?: boolean;
}

export function CampaignGoalGallery({
  outboundEnabled,
  onLocked,
  title = 'Suggested campaigns based on your data',
  subtitle = 'One-click launches a draft campaign with the right contact list, dial window, and script. Review before you start dialing.',
  compact = false,
}: CampaignGoalGalleryProps) {
  const { data, isLoading } = useSWR('campaign-goal-suggestions', () =>
    campaignGoalsApi.suggestions()
  );

  // Only show goals that actually have candidates today. Empty goals just
  // clutter the gallery and mislead the customer.
  const goals = (data?.suggestions ?? []).filter((g) => g.candidateCount > 0);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-cream-200 bg-cream-50 p-6 text-center text-sm text-cream-500">
        Looking for opportunities in your data…
      </div>
    );
  }

  if (goals.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-amber-500 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-xl text-cream-900">{title}</h2>
          <p className="text-sm text-cream-600 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          compact
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {goals.map((g) => (
          <CampaignGoalCard
            key={g.slug}
            goal={g}
            outboundEnabled={outboundEnabled}
            onLocked={onLocked}
          />
        ))}
      </div>
    </section>
  );
}
