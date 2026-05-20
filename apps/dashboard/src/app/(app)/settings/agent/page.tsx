'use client';
// ============================================================
// /settings/agent — AI Agent settings + recent activity.
//
// Two-section layout:
//   1. Toggles: enable agent, enable auto-execute
//      (auto-execute is hard-disabled when HIPAA mode is on)
//   2. Recent suggestions (last 50 of any status)
//
// Owner-only edits; everyone can view.
// ============================================================
import useSWR from 'swr';
import { useState } from 'react';
import {
  Sparkles,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  PhoneCall,
  MessageSquare,
  UserPlus,
  CalendarX,
  ArrowRight,
} from 'lucide-react';
import { agentApi, type AgentSuggestionType, type AgentSuggestionStatus } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

const TYPE_ICONS: Record<AgentSuggestionType, { icon: React.ElementType; label: string }> = {
  missed_call_callback:     { icon: PhoneCall,     label: 'Missed call callback' },
  appointment_confirmation: { icon: MessageSquare, label: 'Appointment confirmation' },
  stale_lead_followup:      { icon: UserPlus,      label: 'Stale lead follow-up' },
  no_show_recapture:        { icon: CalendarX,     label: 'No-show recapture' },
};

const STATUS_META: Record<AgentSuggestionStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending:  { icon: Clock,       color: 'text-gray-500 bg-gray-50',         label: 'Pending'  },
  approved: { icon: Clock,       color: 'text-blue-700 bg-blue-50',         label: 'Running'  },
  executed: { icon: CheckCircle, color: 'text-emerald-700 bg-emerald-50',   label: 'Executed' },
  skipped:  { icon: XCircle,     color: 'text-gray-500 bg-gray-50',         label: 'Skipped'  },
  expired:  { icon: Clock,       color: 'text-amber-700 bg-amber-50',       label: 'Expired'  },
  failed:   { icon: XCircle,     color: 'text-red-700 bg-red-50',           label: 'Failed'   },
};

export default function AgentSettingsPage() {
  const toast = useToast();
  const { data: settings, mutate: mutateSettings } = useSWR('agent-settings', () => agentApi.getSettings());
  const [savingKey, setSavingKey] = useState<'agentEnabled' | 'agentAutoExecute' | null>(null);

  // Combined history: pull recent executed, skipped, and failed.
  const { data: executed } = useSWR('agent-history-executed', () => agentApi.listSuggestions('executed'));
  const { data: skipped }  = useSWR('agent-history-skipped',  () => agentApi.listSuggestions('skipped'));
  const { data: failed }   = useSWR('agent-history-failed',   () => agentApi.listSuggestions('failed'));

  async function updateToggle(key: 'agentEnabled' | 'agentAutoExecute', value: boolean) {
    setSavingKey(key);
    try {
      await agentApi.updateSettings({ [key]: value });
      await mutateSettings();
      toast.success('Settings updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingKey(null);
    }
  }

  const history = [
    ...(executed?.data ?? []),
    ...(skipped?.data ?? []),
    ...(failed?.data ?? []),
  ]
    .sort((a, b) => new Date(b.suggestedAt).getTime() - new Date(a.suggestedAt).getTime())
    .slice(0, 30);

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Sparkles size={22} className="text-white" />
        </div>
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">AI Agent</h1>
          <p className="text-cream-600 mt-1">
            The AI Agent watches your activity and proposes follow-up actions —
            callbacks, appointment confirmations, lead recovery.
          </p>
        </div>
      </div>

      {/* What it does */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">What the Agent does</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {Object.entries(TYPE_ICONS).map(([type, { icon: Icon, label }]) => (
            <div key={type} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-gray-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {DESCRIPTIONS[type as AgentSuggestionType]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings toggles */}
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Settings</h2>

        <Toggle
          label="Agent enabled"
          description="When off, no new suggestions are generated. Existing pending suggestions stay until you act on them."
          checked={settings?.agentEnabled ?? true}
          onChange={(v) => updateToggle('agentEnabled', v)}
          busy={savingKey === 'agentEnabled'}
        />

        <div className="border-t border-gray-100 -mx-6" />

        <div className="relative">
          <Toggle
            label="Auto-execute safe actions"
            description="Skips the approval step for low-risk actions (SMS confirmations, follow-up scheduling). Calls still require approval."
            checked={settings?.agentAutoExecute ?? false}
            onChange={(v) => updateToggle('agentAutoExecute', v)}
            busy={savingKey === 'agentAutoExecute'}
            disabled={settings?.hipaaMode ?? false}
          />
          {settings?.hipaaMode && (
            <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Shield size={13} className="shrink-0 mt-0.5" />
              <span>
                Auto-execute is disabled for HIPAA-mode tenants. Every agent action must be
                manually approved by a member of your team.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Link to dashboard */}
      <div className="card p-5 flex items-center justify-between bg-gradient-to-r from-violet-50 to-fuchsia-50 border-violet-200">
        <div>
          <p className="text-sm font-semibold text-gray-900">Pending suggestions live on the dashboard</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Click any to approve or skip. The AI agent card sits at the top of the home view.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900 px-4 py-2 rounded-lg bg-white border border-violet-200 hover:border-violet-300 transition-colors"
        >
          Open dashboard <ArrowRight size={13} />
        </Link>
      </div>

      {/* Recent history */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent agent activity</h2>
          <span className="text-xs text-gray-400">last {history.length}</span>
        </div>
        {history.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            No agent history yet. Actions you approve or skip will appear here.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((row) => {
              const meta = STATUS_META[row.status];
              const typeMeta = TYPE_ICONS[row.type];
              const StatusIcon = meta.icon;
              const TypeIcon = typeMeta.icon;
              const phone = (row.payload['phoneDisplay'] as string | undefined) ?? '';
              const name = (row.payload['contactName'] as string | undefined) ?? '—';
              return (
                <div key={row.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <TypeIcon size={13} className="text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {typeMeta.label} <span className="text-gray-400 font-normal">· {name}{phone && ` · ${phone}`}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(row.suggestedAt).toLocaleString()}
                      {row.executionResult?.detail && ` · ${row.executionResult.detail}`}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                    <StatusIcon size={10} /> {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const DESCRIPTIONS: Record<AgentSuggestionType, string> = {
  missed_call_callback:
    'Finds inbound calls in the last 24h that didn\'t reach a human and offers to call them back.',
  appointment_confirmation:
    'Surfaces appointments scheduled in the next 12–36 hours without a confirmation, ready to SMS.',
  stale_lead_followup:
    'Flags contacts created 5–30 days ago who never received a follow-up call.',
  no_show_recapture:
    'Spots no-show appointments in the last 72 hours and offers to text the contact a reschedule prompt.',
};

// ── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({
  label,
  description,
  checked,
  onChange,
  busy,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const effectiveChecked = disabled ? false : checked;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={effectiveChecked}
        disabled={busy || disabled}
        onClick={() => onChange(!effectiveChecked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          effectiveChecked ? 'bg-brand-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            effectiveChecked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
