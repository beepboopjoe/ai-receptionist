'use client';
import useSWR, { mutate } from 'swr';
import { campaignsApi } from '@/lib/api';
import { Plus, Play, Pause, XCircle, ChevronRight, Megaphone, Phone, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { useVertical } from '@/lib/useVertical';
import { useFeatureFlags } from '@/lib/featureFlags';
import { usePlan } from '@/lib/usePlan';
import { useToast } from '@/components/ui/toast';
import { DownloadCsvButton } from '@/components/ui/download-csv-button';
import { CampaignGoalGallery } from '@/components/campaigns/campaign-goal-gallery';
import { SectionAgent } from '@/components/dashboard/section-agent';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray',
  running: 'badge-green',
  paused: 'badge-blue',
  completed: 'badge-gray',
  cancelled: 'badge-red',
};

export default function CampaignsPage() {
  const vertical = useVertical();
  const toast = useToast();
  const { data, isLoading } = useSWR('campaigns', () => campaignsApi.list());
  const campaigns = ((data as any)?.data ?? []) as any[];
  const [actionId, setActionId] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  // Feature flags resolve from plan tier — Growth+ unlocks outbound campaigns.
  const { has, loading: flagsLoading } = useFeatureFlags();
  const outboundEnabled = flagsLoading ? true : has('outbound_campaigns');
  // Promo-trial tenants see a separate caller-ID notice because their
  // outbound calls go out from a freshly-provisioned trial number, not
  // their established business line.
  const { promoTrial } = usePlan();

  async function handleAction(id: string, action: 'start' | 'pause' | 'cancel') {
    setActionId(id);
    try {
      if (action === 'start') await campaignsApi.start(id);
      else if (action === 'pause') await campaignsApi.pause(id);
      else await campaignsApi.cancel(id);
      await mutate('campaigns');
      toast.success(`Campaign ${action === 'start' ? 'started' : action === 'pause' ? 'paused' : 'cancelled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not ${action} campaign`);
    } finally {
      setActionId(null);
    }
  }

  function pct(n: number, d: number) {
    if (!d) return '—';
    return ((n / d) * 100).toFixed(0) + '%';
  }

  return (
    <div className="space-y-6">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="outbound_locked" />

      <SectionAgent section="campaigns" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Outbound calling campaigns to qualify and book new {vertical.contactNounPlural}</p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadCsvButton
            rows={campaigns}
            columns={[
              { label: 'Name', value: (c: any) => c.name },
              { label: 'Status', value: (c: any) => c.status },
              { label: 'Total leads', value: (c: any) => c.totalLeads },
              { label: 'Dialed', value: (c: any) => c.dialedCount },
              { label: 'Connected', value: (c: any) => c.connectedCount },
              { label: 'Qualified', value: (c: any) => c.qualifiedCount },
              { label: 'Booked', value: (c: any) => c.bookedCount },
              { label: 'Started', value: (c: any) => c.startedAt && new Date(c.startedAt) },
              { label: 'Completed', value: (c: any) => c.completedAt && new Date(c.completedAt) },
            ]}
            filename="campaigns.csv"
          />
          {outboundEnabled ? (
            <Link href="/campaigns/new" className="btn-primary">
              <Plus size={16} /> New Campaign
            </Link>
          ) : (
            <button onClick={() => setShowUpgrade(true)} className="btn-primary">
              <Plus size={16} /> New Campaign
            </button>
          )}
        </div>
      </div>

      {!outboundEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <Megaphone size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Outbound campaigns require Growth plan</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Upgrade to Growth ($299/mo) to unlock AI calling campaigns.{' '}
              <button onClick={() => setShowUpgrade(true)} className="underline font-medium">See what&apos;s included →</button>
            </p>
          </div>
        </div>
      )}

      {/* Caller-ID notice for promo-trial tenants */}
      {promoTrial && outboundEnabled && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Phone size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-900">
              Caller ID during your promo trial
            </p>
            <p className="text-sm text-indigo-800 mt-1 leading-relaxed">
              Your outbound calls go out from the trial number you provisioned in
              Settings → Phone Numbers — not your existing business line. The
              prospect&apos;s screen will show <strong>just the number</strong>, with no
              business name. Some carriers may label brand-new numbers as
              &ldquo;Spam Likely&rdquo; until they build call history.
            </p>
            <p className="text-sm text-indigo-800 mt-2 leading-relaxed">
              The AI introduces itself with your business name within 2 seconds of
              pickup, so the conversation lands correctly.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 border border-indigo-200 px-3 py-2.5">
              <Info size={13} className="text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-900">
                <strong>After you upgrade,</strong> we can register your business name
                with the carriers (CNAM) so it appears on the recipient&apos;s lockscreen
                — typically $1–3/mo extra, 5–15 business days to propagate.
                Alternatively, port your existing business line to us so caller ID
                matches your brand directly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Goal-driven suggestions — Phase 12.4. Renders only goals with
          live candidates so the gallery is always actionable. When no goals
          have candidates the component returns null and the existing empty
          state below takes over. */}
      <CampaignGoalGallery
        outboundEnabled={outboundEnabled}
        onLocked={() => setShowUpgrade(true)}
      />

      <div className="card">
        {isLoading ? (
          <ListRowSkeleton rows={4} />
        ) : campaigns.length === 0 ? (
          <div className="p-6 space-y-4">
            <EmptyState
              icon={Megaphone}
              label="No campaigns yet"
              hint={`Create one to start dialing ${vertical.contactNounPlural} automatically — or pick a suggested campaign above.`}
              cta={{ label: 'Create campaign', href: '/campaigns/new' }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Campaign', 'Status', 'Leads', 'Dialed', 'Connected', 'Qualified', 'Booked', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-gray'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.totalLeads}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.dialedCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {c.connectedCount} <span className="text-gray-400 text-xs">({pct(c.connectedCount, c.dialedCount)})</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {c.qualifiedCount} <span className="text-gray-400 text-xs">({pct(c.qualifiedCount, c.connectedCount)})</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {c.bookedCount} <span className="text-gray-400 text-xs">({pct(c.bookedCount, c.qualifiedCount)})</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {c.status === 'draft' || c.status === 'paused' ? (
                          <button
                            onClick={() => handleAction(c.id, 'start')}
                            disabled={actionId === c.id}
                            className="btn-secondary text-xs py-1 px-2"
                            title="Start"
                          >
                            <Play size={13} />
                          </button>
                        ) : null}
                        {c.status === 'running' ? (
                          <button
                            onClick={() => handleAction(c.id, 'pause')}
                            disabled={actionId === c.id}
                            className="btn-secondary text-xs py-1 px-2"
                            title="Pause"
                          >
                            <Pause size={13} />
                          </button>
                        ) : null}
                        {c.status !== 'cancelled' && c.status !== 'completed' ? (
                          <button
                            onClick={() => handleAction(c.id, 'cancel')}
                            disabled={actionId === c.id}
                            className="btn-secondary text-xs py-1 px-2 text-red-600 hover:text-red-700"
                            title="Cancel"
                          >
                            <XCircle size={13} />
                          </button>
                        ) : null}
                        <Link href={`/campaigns/${c.id}`} className="btn-secondary text-xs py-1 px-2">
                          <ChevronRight size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

