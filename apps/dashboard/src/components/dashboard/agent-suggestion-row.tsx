// ============================================================
// AgentSuggestionRow — single row of the AI Agent queue.
//
// Extracted from agent-suggestions-card.tsx (Phase 12.5) so the
// per-section SectionAgent header can render the same UI inline
// within its natural section (callbacks on /missed-calls,
// confirmations on /appointments, etc.) — keeping the look and
// approve/skip flow identical wherever it appears.
// ============================================================
'use client';
import { useState } from 'react';
import {
  PhoneCall,
  MessageSquare,
  UserPlus,
  CalendarX,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { agentApi, type AgentSuggestion, type AgentSuggestionType } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface TypeMeta {
  icon: React.ElementType;
  label: string;
  color: string;
  accent: string;
  accentText: string;
}

export const SUGGESTION_TYPE_META: Record<AgentSuggestionType, TypeMeta> = {
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

export function AgentSuggestionRow({
  suggestion,
  onChange,
}: {
  suggestion: AgentSuggestion;
  onChange: () => void;
}) {
  const toast = useToast();
  const [scriptOpen, setScriptOpen] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'skip' | null>(null);

  const meta = SUGGESTION_TYPE_META[suggestion.type];
  const Icon = meta.icon;
  const p = suggestion.payload;

  const name = (p['contactName'] as string) || 'Unknown contact';
  const phone =
    (p['phoneDisplay'] as string) ||
    (p['phone'] as string) ||
    (p['fromNumber'] as string) ||
    '—';
  const script = (p['script'] as string) || '';
  const time = p['startsAtDisplay']
    ? (p['startsAtDisplay'] as string)
    : p['missedAt']
      ? new Date(p['missedAt'] as string).toLocaleString('en-US', {
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
      if (ok) toast.success('Action queued');
      else toast.error(`Approval failed: ${detail}`);
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
    <div className="px-4 py-3">
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
