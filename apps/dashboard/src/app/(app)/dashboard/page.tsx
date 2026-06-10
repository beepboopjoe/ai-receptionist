'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { callsApi, appointmentsApi, escalationsApi, campaignsApi, smsApi } from '@/lib/api';
import { Phone, Calendar, AlertCircle, PhoneMissed, Wifi, WifiOff, Megaphone, MessageSquare, Zap, ArrowRight } from 'lucide-react';
import { useActivityFeed, type ActivityEvent } from '@/lib/useActivityFeed';
import { usePlan } from '@/lib/usePlan';
import { useFeatureFlags } from '@/lib/featureFlags';
import { useVertical } from '@/lib/useVertical';
import { LockedFeature } from '@/components/ui/locked-feature';
import { EmptyState } from '@/components/ui/empty-state';
import { AgentSuggestionsCard } from '@/components/dashboard/agent-suggestions-card';
import { TopCampaignSuggestion } from '@/components/dashboard/top-campaign-suggestion';
import { LeadDiscoveryCard } from '@/components/dashboard/lead-discovery-card';
import { KnowledgeBaseCard } from '@/components/dashboard/knowledge-base-card';

interface EventStyle { color: string; dot: string }

const EVENT_STYLES: Record<string, EventStyle> = {
  call_started:            { color: 'text-blue-700 bg-blue-50',       dot: 'bg-blue-500' },
  call_completed:          { color: 'text-green-700 bg-green-50',     dot: 'bg-green-500' },
  appointment_booked:      { color: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
  appointment_cancelled:   { color: 'text-red-700 bg-red-50',         dot: 'bg-red-500' },
  escalation_created:      { color: 'text-amber-700 bg-amber-50',     dot: 'bg-amber-500' },
  campaign_lead_connected: { color: 'text-purple-700 bg-purple-50',   dot: 'bg-purple-500' },
};

/**
 * Build vertical-aware event labels. The capitalized appointment noun changes
 * per vertical (Appointment / Consultation / Showing) so the activity feed
 * reads naturally for each industry.
 */
function buildEventLabels(apptNoun: string): Record<string, string> {
  const Appt = apptNoun.charAt(0).toUpperCase() + apptNoun.slice(1);
  return {
    call_started:            'Call started',
    call_completed:          'Call completed',
    appointment_booked:      `${Appt} booked`,
    appointment_cancelled:   `${Appt} cancelled`,
    escalation_created:      'Escalation created',
    campaign_lead_connected: 'Lead connected',
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-cream-600">{label}</p>
          <p className="font-serif text-4xl text-cream-900 mt-1 tracking-tight">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ── First-run setup checklist (Phase 29a) ─────────────────────
// Shown on Home until the AI has handled its first call. Three plain
// steps, no completion tracking — once a call exists, it disappears.
const SETUP_STEPS = [
  {
    n: 1,
    title: 'Forward your phone',
    desc: 'Point your existing business number at your AI line — takes about 2 minutes with your carrier.',
    href: '/settings/phone-numbers',
    cta: 'Set up forwarding',
  },
  {
    n: 2,
    title: "Pick your AI's voice",
    desc: 'Choose from 5 voices and tell the AI about your business in plain words.',
    href: '/settings/voice-agent',
    cta: 'Choose a voice',
  },
  {
    n: 3,
    title: 'Hear it yourself',
    desc: 'Place a free test call — your AI rings your cell and you talk to it like a customer would.',
    href: '/settings/voice-agent',
    cta: 'Make a test call',
  },
];

function SetupChecklist() {
  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-amber-50/40 p-6">
      <h2 className="font-serif text-xl text-cream-900 mb-1">Let&apos;s get your front desk answering</h2>
      <p className="text-sm text-cream-700 mb-5">
        Three quick steps and your AI takes its first call. No tech skills needed.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SETUP_STEPS.map((step) => (
          <Link
            key={step.n}
            href={step.href}
            className="group rounded-xl bg-white border border-cream-200 hover:border-brand-300 hover:shadow-sm p-4 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-serif flex items-center justify-center mb-3 text-sm">
              {step.n}
            </div>
            <p className="font-semibold text-sm text-cream-900 mb-1">{step.title}</p>
            <p className="text-xs text-cream-600 leading-relaxed mb-3">{step.desc}</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-1.5 transition-all">
              {step.cta} <ArrowRight size={11} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Placeholder stat card shown blurred behind LockedFeature
function LockedStatCard({ label }: { label: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-cream-600">{label}</p>
          <p className="font-serif text-4xl text-cream-900 mt-1 tracking-tight">—</p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-500">
          <Megaphone size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: calls } = useSWR('calls', () => callsApi.list({ limit: 100 }), { refreshInterval: 30000 });
  const { data: appointments } = useSWR('appointments-today', () =>
    appointmentsApi.list({ limit: 50, status: 'confirmed' }), { refreshInterval: 30000 }
  );
  const { data: escalations } = useSWR('escalations', () => escalationsApi.list(), { refreshInterval: 30000 });
  const { data: missed } = useSWR('missed-calls', () => callsApi.getMissed(), { refreshInterval: 30000 });
  const { data: campaigns } = useSWR('campaigns', () => campaignsApi.list(), { refreshInterval: 30000 });
  const { events, connected } = useActivityFeed({ maxEvents: 20 });
  // Plan provides usage data (minutes, percent) — feature gating goes through useFeatureFlags.
  const { isHighUsage, usagePercent, minutesUsed, minutesIncluded } = usePlan();
  const { has } = useFeatureFlags();
  const outboundEnabled = has('outbound_campaigns');
  const smsEnabled = has('two_way_sms');
  const { data: smsConvs } = useSWR(
    smsEnabled ? 'sms-conversations' : null,
    () => smsApi.listConversations(),
    { refreshInterval: 30000 }
  );
  const vertical = useVertical();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const eventLabels = buildEventLabels(vertical.appointmentNoun);

  const totalCalls = (calls as any)?.total ?? 0;
  const openEscalations = ((escalations as any)?.data ?? []).filter(
    (e: any) => e.status === 'open'
  ).length;
  const upcomingAppts = ((appointments as any)?.data ?? []).length;
  const missedCount = ((missed as any)?.data ?? []).length;
  const activeCampaigns = ((campaigns as any)?.data ?? []).filter(
    (c: any) => c.status === 'running'
  ).length;
  const unreadMessages = ((smsConvs as any)?.data ?? []).reduce(
    (sum: number, c: any) => sum + (c.inboundCount ?? 0),
    0
  );

  const recentCalls = ((calls as any)?.data ?? []).filter(Boolean).slice(0, 8);
  const recentCampaigns = ((campaigns as any)?.data ?? []).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Home</h1>
          <p className="text-cream-600 mt-1">Your AI front desk at a glance</p>
        </div>
        {/* Live indicator */}
        <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* ── Usage warning banner ── */}
      {isHighUsage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                You&apos;ve used {usagePercent}% of your AI minutes
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                {minutesUsed.toLocaleString()} of {minutesIncluded.toLocaleString()} minutes used this month. Upgrade before calls get dropped.
              </p>
            </div>
          </div>
          <Link href="/billing" className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-lg transition-colors">
            <Zap size={14} /> Upgrade now
          </Link>
        </div>
      )}

      {/* ── First-run setup checklist (Phase 29a) — shown until the AI
          has handled its first call. Plain words, three steps. ── */}
      {(calls as any) && totalCalls === 0 && <SetupChecklist />}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <Link href="/calls" className="block">
          <StatCard label="Total Calls" value={totalCalls} icon={Phone} color="bg-brand-600" />
        </Link>
        <Link href="/appointments" className="block">
          <StatCard label={`Upcoming ${cap(vertical.appointmentNounPlural)}`} value={upcomingAppts} icon={Calendar} color="bg-emerald-500" />
        </Link>
        {/* "Needs Attention" replaces the Escalations nav item (Phase 29a) —
            this card is now the main entry point to /escalations. */}
        <Link href="/escalations" className="block">
          <StatCard label="Needs Attention" value={openEscalations} icon={AlertCircle} color="bg-amber-500" />
        </Link>
        <Link href="/missed-calls" className="block">
          <StatCard label="Missed Calls" value={missedCount} icon={PhoneMissed} color="bg-red-500" />
        </Link>

        {/* Messages stat — locked on Starter/Trial */}
        {smsEnabled ? (
          <Link href="/messages" className="block">
            <StatCard label="Unread Messages" value={unreadMessages} icon={MessageSquare} color="bg-indigo-500" />
          </Link>
        ) : (
          <LockedFeature requiredPlan="growth" reason="sms_locked" label="Two-way SMS">
            <LockedStatCard label="Unread Messages" />
          </LockedFeature>
        )}

        {/* Campaign stat or locked */}
        {outboundEnabled ? (
          <StatCard label="Active Campaigns" value={activeCampaigns} icon={Megaphone} color="bg-purple-500" />
        ) : (
          <LockedFeature requiredPlan="growth" reason="outbound_locked" label="Outbound campaigns">
            <LockedStatCard label="Active Campaigns" />
          </LockedFeature>
        )}
      </div>

      {/* ── Top campaign opportunity (goal-driven, Phase 12.4) ── */}
      <TopCampaignSuggestion />

      {/* ── Lead Discovery promo (Phase 12.7) ── */}
      <LeadDiscoveryCard />

      {/* ── Knowledge Base promo (Phase 12.8 / 14) ── */}
      <KnowledgeBaseCard />

      {/* ── AI Agent Suggestions ── */}
      <AgentSuggestionsCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Calls */}
        <div className="card lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Calls</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentCalls.length === 0 ? (
              <EmptyState
                icon={Phone}
                label="No calls yet"
                hint="When your AI receptionist answers a call, it will show up here."
                compact
              />
            ) : (
              recentCalls.map((call: any) => (
                <div key={call.id} className="px-6 py-4 flex items-center gap-4">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      call.status === 'completed'
                        ? 'bg-green-500'
                        : call.status === 'missed'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {call?.fromNumber ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{call.summary ?? 'No summary'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`badge ${
                        call.outcome === 'booked'
                          ? 'badge-green'
                          : call.outcome === 'escalated'
                            ? 'badge-red'
                            : call.outcome === 'voicemail'
                              ? 'badge-gray'
                              : 'badge-blue'
                      }`}
                    >
                      {call.outcome ?? call.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {call.startedAt ? new Date(call.startedAt).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="card flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Live Activity</h2>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 max-h-96">
            {events.length === 0 ? (
              connected ? (
                <EmptyState
                  label="Waiting for activity…"
                  hint="Events will appear here in real time."
                  compact
                />
              ) : (
                <EmptyState label="Connecting…" compact />
              )
            ) : (
              events.map((evt: ActivityEvent, i) => {
                const style = EVENT_STYLES[evt.type] ?? { color: 'text-gray-700 bg-gray-50', dot: 'bg-gray-400' };
                const label = eventLabels[evt.type] ?? evt.type;
                const meta = { ...style, label };
                const d = evt.data ?? {};
                const phone = (d['fromNumber'] ?? d['toNumber'] ?? d['phone'] ?? '') as string;
                const name = (d['contactName'] ?? '') as string;
                return (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                        {meta.label}
                      </span>
                      {(name || phone) && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{name || phone}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Campaign Pipeline section ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Campaign Pipeline</h2>
          {outboundEnabled && (
            <Link href="/campaigns" className="text-sm text-brand-600 font-medium hover:underline">
              View all →
            </Link>
          )}
        </div>

        {outboundEnabled ? (
          <div className="card">
            {recentCampaigns.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                label="No campaigns yet"
                cta={{ label: 'Create your first campaign', href: '/campaigns/new' }}
                compact
              />
            ) : (
              <div className="divide-y divide-gray-50">
                {recentCampaigns.map((c: any) => (
                  <div key={c.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.totalLeads} leads · {c.bookedCount ?? 0} booked
                      </p>
                    </div>
                    <span className={`badge ${
                      c.status === 'running' ? 'badge-green' :
                      c.status === 'paused'  ? 'badge-blue'  :
                      c.status === 'completed' ? 'badge-gray' : 'badge-gray'
                    }`}>
                      {c.status}
                    </span>
                    <Link href={`/campaigns/${c.id}`} className="text-xs text-gray-400 hover:text-gray-700">
                      View →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <LockedFeature requiredPlan="growth" reason="outbound_locked" label="Outbound campaign pipeline">
            {/* Placeholder skeleton visible blurred behind the overlay */}
            <div className="card divide-y divide-gray-50">
              {[
                { name: 'Inactive Contact Reactivation', leads: 240, booked: 18, status: 'running' },
                { name: 'Lead Follow-Up Campaign', leads: 120, booked: 9, status: 'paused' },
                { name: 'New Client Outreach', leads: 80, booked: 6, status: 'completed' },
              ].map((c) => (
                <div key={c.name} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.leads} leads · {c.booked} booked</p>
                  </div>
                  <span className="badge badge-green">{c.status}</span>
                </div>
              ))}
            </div>
          </LockedFeature>
        )}
      </div>
    </div>
  );
}
