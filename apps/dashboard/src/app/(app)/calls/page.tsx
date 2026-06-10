'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { callsApi } from '@/lib/api';
import { Phone, ChevronRight, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { DownloadCsvButton } from '@/components/ui/download-csv-button';
import { useLiveCalls } from '@/lib/useLiveCalls';
import { LiveCallDrawer } from '@/components/dashboard/live-call-drawer';
import { SectionAgent } from '@/components/dashboard/section-agent';

export default function CallsPage() {
  const { data, isLoading, mutate } = useSWR('calls', () => callsApi.list({ limit: 50 }));
  const allCalls = (data as any)?.data ?? [];

  // Phase 29a — Missed Calls folded into this page as a filter tab.
  // The dedicated /missed-calls page (with text-back tooling) still
  // exists; the Missed tab links to it for the full workflow.
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const calls = filter === 'missed'
    ? allCalls.filter((c: any) => c.status === 'missed')
    : allCalls;

  const { activeCalls } = useLiveCalls();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  // Default to the first/most-recent live call. If the selected call ends,
  // fall back to the next available one — and close the drawer if none remain.
  useEffect(() => {
    if (activeCalls.length === 0) {
      setSelectedCallId(null);
      setDrawerOpen(false);
      // Refresh the call list — a just-ended call's completed row should appear.
      mutate();
      return;
    }
    if (!selectedCallId || !activeCalls.find((c) => c.callId === selectedCallId)) {
      setSelectedCallId(activeCalls[activeCalls.length - 1]!.callId);
    }
  }, [activeCalls, selectedCallId, mutate]);

  const selectedCall = activeCalls.find((c) => c.callId === selectedCallId) ?? null;

  return (
    <div className="space-y-6">
      <SectionAgent section="calls" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Call Log</h1>
          <p className="text-gray-500 mt-1">All inbound calls handled by your AI receptionist</p>
        </div>
        <DownloadCsvButton
          rows={calls}
          columns={[
            { label: 'From', value: (c: any) => c.fromNumber },
            { label: 'Started', value: (c: any) => c.startedAt && new Date(c.startedAt) },
            { label: 'Duration (s)', value: (c: any) => c.durationSeconds ?? '' },
            { label: 'Status', value: (c: any) => c.status },
            { label: 'Outcome', value: (c: any) => c.outcome ?? '' },
            { label: 'Workflow', value: (c: any) => c.workflowTriggered ?? '' },
            { label: 'Summary', value: (c: any) => c.summary ?? '' },
          ]}
          filename="calls.csv"
        />
      </div>

      {/* Live-call banner — only when one or more AI calls are in progress. */}
      {activeCalls.length > 0 && (
        <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-amber-50 px-5 py-3 flex items-center gap-4">
          <div className="relative w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
            <PhoneCall size={16} className="text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-900">
              {activeCalls.length === 1
                ? `Call in progress from ${activeCalls[0]!.contactName ?? activeCalls[0]!.fromNumber}`
                : `${activeCalls.length} calls in progress`}
            </p>
            <p className="text-xs text-brand-700/80">
              Watch the transcript stream in real time or take over the conversation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors whitespace-nowrap"
          >
            Watch live →
          </button>
        </div>
      )}

      <LiveCallDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        call={selectedCall}
        allCalls={activeCalls}
        onSelectCall={setSelectedCallId}
      />

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900">Recent Calls</h2>
            {/* All / Missed filter tabs (Phase 29a) */}
            <div className="flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-200 p-0.5">
              {(['all', 'missed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                    filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {f === 'all' ? 'All' : 'Missed'}
                </button>
              ))}
            </div>
            {filter === 'missed' && (
              <Link href="/missed-calls" className="text-xs font-medium text-brand-600 hover:underline whitespace-nowrap">
                Open text-back tools →
              </Link>
            )}
          </div>
          <span className="text-sm text-gray-500">{(data as any)?.total ?? 0} total</span>
        </div>
        {isLoading ? (
          <ListRowSkeleton rows={6} />
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            label={filter === 'missed' ? 'No missed calls' : 'No calls yet'}
            hint={
              filter === 'missed'
                ? 'Great news — your AI has been picking up. Missed calls would appear here.'
                : 'Once your AI receptionist answers a call, it will show up here with a transcript and outcome.'
            }
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {calls.map((call: any) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{call.fromNumber}</p>
                    <span
                      className={`badge ${
                        call.status === 'completed' ? 'badge-green' :
                        call.status === 'missed' ? 'badge-red' :
                        'badge-yellow'
                      }`}
                    >
                      {call.status}
                    </span>
                    {call.outcome && (
                      <span className="badge badge-blue">{call.outcome}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {call.summary ?? call.workflowTriggered ?? 'No summary'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">
                    {call.startedAt ? new Date(call.startedAt).toLocaleString() : '—'}
                  </p>
                  {call.durationSeconds && (
                    <p className="text-xs text-gray-400">{Math.round(call.durationSeconds / 60)}m</p>
                  )}
                  {call.satisfactionScore != null && (
                    <p className="text-xs text-amber-500 mt-0.5" title={`Caller rated ${call.satisfactionScore}/5`}>
                      {'★'.repeat(call.satisfactionScore)}{'☆'.repeat(5 - call.satisfactionScore)}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
