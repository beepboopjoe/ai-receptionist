'use client';
import useSWR from 'swr';
import { callsApi } from '@/lib/api';
import { PhoneMissed, Phone } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { SectionAgent } from '@/components/dashboard/section-agent';

export default function MissedCallsPage() {
  const { data, isLoading } = useSWR('missed-calls', () => callsApi.getMissed());
  const missed = (data as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <SectionAgent section="missed-calls" />

      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Missed Calls</h1>
        <p className="text-gray-500 mt-1">Calls that need a follow-up callback</p>
      </div>

      <div className="card">
        {isLoading ? (
          <ListRowSkeleton rows={4} />
        ) : missed.length === 0 ? (
          <EmptyState
            icon={PhoneMissed}
            label="No missed calls"
            hint="Calls that ended without a resolution will appear here for callback."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {missed.map((call: any) => (
              <div key={call.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <PhoneMissed size={18} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{call.fromNumber}</p>
                  <p className="text-xs text-gray-500">
                    {call.startedAt ? new Date(call.startedAt).toLocaleString() : '—'}
                  </p>
                </div>
                <a
                  href={`tel:${call.fromNumber}`}
                  className="btn-secondary text-sm"
                >
                  <Phone size={14} /> Call back
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
