'use client';
import useSWR from 'swr';
import { callsApi } from '@/lib/api';
import { ArrowLeft, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export default function CallDetailPage({ params }: { params: { id: string } }) {
  const { data: call, isLoading } = useSWR(`call-${params.id}`, () => callsApi.get(params.id));
  const c = call as any;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton width="w-48" height="h-8" />
        <Skeleton width="w-full" height="h-32" rounded="lg" />
        <Skeleton width="w-full" height="h-64" rounded="lg" />
      </div>
    );
  }
  if (!c) {
    return (
      <EmptyState
        icon={XCircle}
        label="Call not found"
        hint="This call record may have been deleted."
        cta={{ label: 'Back to call log', href: '/calls' }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/calls" className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Call Detail</h1>
      </div>

      {/* Meta */}
      <div className="card p-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase">From</p>
          <p className="font-medium">{c.fromNumber}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Status</p>
          <span className={`badge ${c.status === 'completed' ? 'badge-green' : c.status === 'missed' ? 'badge-red' : 'badge-yellow'}`}>
            {c.status}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Outcome</p>
          <p className="font-medium">{c.outcome ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Workflow</p>
          <p className="font-medium">{c.workflowTriggered ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Started</p>
          <p className="font-medium">{c.startedAt ? new Date(c.startedAt).toLocaleString() : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Duration</p>
          <p className="font-medium">{c.durationSeconds ? `${Math.round(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : '—'}</p>
        </div>
      </div>

      {/* Summary */}
      {c.summary && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-2">AI Summary</h2>
          <p className="text-gray-700 text-sm leading-relaxed">{c.summary}</p>
        </div>
      )}

      {/* Transcript */}
      {c.transcript && Array.isArray(c.transcript) && c.transcript.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Transcript</h2>
          <div className="space-y-3">
            {c.transcript.map((entry: any, i: number) => (
              <div
                key={i}
                className={`flex gap-3 ${entry.role === 'agent' ? '' : 'flex-row-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    entry.role === 'agent' ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {entry.role === 'agent' ? 'AI' : 'C'}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    entry.role === 'agent'
                      ? 'bg-brand-50 text-brand-900'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
