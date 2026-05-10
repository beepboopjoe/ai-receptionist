'use client';
import useSWR from 'swr';
import { callsApi } from '@/lib/api';
import { Phone, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { DownloadCsvButton } from '@/components/ui/download-csv-button';

export default function CallsPage() {
  const { data, isLoading } = useSWR('calls', () => callsApi.list({ limit: 50 }));
  const calls = (data as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
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

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Calls</h2>
          <span className="text-sm text-gray-500">{(data as any)?.total ?? 0} total</span>
        </div>
        {isLoading ? (
          <ListRowSkeleton rows={6} />
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            label="No calls yet"
            hint="Once your AI receptionist answers a call, it will show up here with a transcript and outcome."
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
