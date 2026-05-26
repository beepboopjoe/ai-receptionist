'use client';
// ============================================================
// Agent suggestions card — dashboard summary view.
//
// Phase 12.5 re-homed the inline approve/skip flow into each
// section's SectionAgent header. This card now serves as a
// summary + router:
//   - shows pending count broken down by type
//   - each row links to the section where the suggestion lives
//
// Customers click into the natural section to act on it.
// ============================================================
import useSWR from 'swr';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { agentApi, type AgentSuggestion, type AgentSuggestionType } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { SUGGESTION_TYPE_META } from './agent-suggestion-row';

// Which section page each suggestion type belongs on. Drives the
// "View in X" link on each summary row.
const TYPE_DESTINATION: Record<AgentSuggestionType, { label: string; href: string }> = {
  missed_call_callback: { label: 'Missed Calls', href: '/missed-calls' },
  appointment_confirmation: { label: 'Appointments', href: '/appointments' },
  no_show_recapture: { label: 'Appointments', href: '/appointments' },
  // stale_lead_followup has no V1 section page yet — points at Contacts.
  stale_lead_followup: { label: 'Contacts', href: '/contacts' },
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

  // Group pending suggestions by type so the summary rolls them up.
  const byType = suggestions.reduce<Record<string, AgentSuggestion[]>>((acc, s) => {
    (acc[s.type] = acc[s.type] ?? []).push(s);
    return acc;
  }, {});
  const typeKeys = Object.keys(byType) as AgentSuggestionType[];

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
              Recommended actions — open a section to approve or skip
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

      {isLoading ? (
        <div className="px-6 py-12 text-center text-sm text-gray-400">Loading suggestions…</div>
      ) : typeKeys.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="inline-flex w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mb-3">
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">All caught up</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            The AI agent will surface callback opportunities, appointment confirmations,
            and follow-ups inside each section as they appear.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {typeKeys.map((type) => {
            const meta = SUGGESTION_TYPE_META[type];
            const dest = TYPE_DESTINATION[type];
            const count = byType[type]!.length;
            const Icon = meta.icon;
            return (
              <Link
                key={type}
                href={dest.href}
                className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${meta.accent}`}>
                  <Icon size={16} className={meta.accentText} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {count} {meta.label.toLowerCase()}
                    {count > 1 ? 's' : ''}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Open <span className="font-medium text-cream-800">{dest.label}</span> to review and approve
                  </p>
                </div>
                <ArrowRight
                  size={15}
                  className="text-gray-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
