'use client';
// ============================================================
// Agent suggestions card — shown on the main dashboard.
//
// Renders the operator-facing AI agent queue. Each row:
//   • shows the source (missed call, appt confirm, stale lead, no-show)
//   • shows the EXACT script the AI will use (so the operator knows
//     what they're approving before clicking)
//   • Approve → fires the action through existing infra
//   • Skip   → dismisses the suggestion
//
// Refreshes every 30s; a "Refresh" button manually triggers the scanner.
// ============================================================
import useSWR from 'swr';
import { useState } from 'react';
import {
  Sparkles,
  PhoneCall,
  MessageSquare,
  UserPlus,
  CalendarX,
  CheckCircle,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { agentApi, type AgentSuggestion, type AgentSuggestionType } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface TypeMeta {
  icon: React.ElementType;
  label: string;
  color: string;       // pill text + bg
  accent: string;      // small icon circle bg
  accentText: string;  // small icon circle text
}

const TYPE_META: Record<AgentSuggestionType, TypeMeta> = {
  missed_call_callback: {
    icon: PhoneCall,
    label: 'Missed call · callback',
    color: 'text-red-700 bg-red-50',
    accent: 'bg-red-100',
    accentText: 'text-red-700',
  },
  appointment_confirmation: {
    icon: MessageSquare,
    label: 'Appointment · confirmation',
    color: 'text-emerald-700 bg-emerald-50',
    accent: 'bg-emerald-100',
    accentText: 'text-emerald-700',
  },
  stale_lead_followup: {
    icon: UserPlus,
    label: 'Stale lead · follow-up',
    color: 'text-amber-700 bg-amber-50',
    accent: 'bg-amber-100',
    accentText: 'text-amber-700',
  },
  no_show_recapture: {
    icon: CalendarX,
    label: 'No-show · recapture',
    color: 'text-purple-700 bg-purple-50',
    accent: 'bg-purple-100',
    accentText: 'text-purple-700',
  },
};

export function AgentSuggestionsCard() {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    'agent-suggestions',
    () => agentApi.listSuggestions('pending'),
    { refreshInterval: 30_000 }
  );

  const suggestions = data?.data ?? [];

  async function handleRefresh() {
    setScanning(true);
    try {
      const result = await agentApi.scan();
      const inserted = result.data.inserted;
      if (inserted > 0) {
        toast.success(`Found ${inserted} new ${inserted === 1 ? 'suggestion' : 'suggestions'}`);
      } else {
        toast.info('No new suggestions right now');
      }
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">AI Agent Suggestions</h2>
            <p className="text-[11px] text-gray-500">
              Recommended actions · approve to fire through outbound channel
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {scanning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {scanning ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {/* Empty / loading / list */}
      {isLoading ? (
        <div className="px-6 py-12 text-center text-sm text-gray-400">Loading suggestions…</div>
      ) : suggestions.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="inline-flex w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mb-3">
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">All caught up</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            The AI agent will surface callback opportunities, appointment confirmations,
            and follow-ups here as they appear.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {suggestions.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} onChange={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single row ──────────────────────────────────────────────────────────────

function SuggestionRow({
  suggestion,
  onChange,
}: {
  suggestion: AgentSuggestion;
  onChange: () => void;
}) {
  const toast = useToast();
  const [scriptOpen, setScriptOpen] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'skip' | null>(null);

  const meta = TYPE_META[suggestion.type];
  const Icon = meta.icon;
  const p = suggestion.payload;

  const name = (p.contactName as string) || 'Unknown contact';
  const phone = (p.phoneDisplay as string) || (p.phone as string) || (p.fromNumber as string) || '—';
  const script = (p.script as string) || '';
  const time = p.startsAtDisplay
    ? (p.startsAtDisplay as string)
    : p.missedAt
      ? new Date(p.missedAt as string).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

  async function handleApprove() {
    setBusy('approve');
    try {
      const r = await agentApi.approve(suggestion.id);
      const ok = r.data.executionResult?.ok ?? false;
      const detail = r.data.executionResult?.detail ?? '';
      if (ok) {
        toast.success('Action queued');
      } else {
        toast.error(`Approval failed: ${detail}`);
      }
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleSkip() {
    setBusy('skip');
    try {
      await agentApi.skip(suggestion.id);
      toast.info('Skipped');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Skip failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${meta.accent}`}>
          <Icon size={15} className={meta.accentText} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
              {meta.label}
            </span>
            {time && <span className="text-[11px] text-gray-400">{time}</span>}
          </div>

          <p className="text-sm font-medium text-gray-900 truncate">
            {name} <span className="text-gray-400 font-normal">· {phone}</span>
          </p>

          {/* Script preview (collapsed by default) */}
          {script && (
            <div className="mt-2">
              <button
                onClick={() => setScriptOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900"
              >
                {scriptOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {scriptOpen ? 'Hide script' : 'See script'}
              </button>
              {scriptOpen && (
                <p className="mt-1.5 text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  &ldquo;{script}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSkip}
            disabled={busy !== null}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            aria-label="Skip"
            title="Skip"
          >
            {busy === 'skip' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
          </button>
          <button
            onClick={handleApprove}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {busy === 'approve' ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Running…
              </>
            ) : (
              <>
                <CheckCircle size={12} /> Approve
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
