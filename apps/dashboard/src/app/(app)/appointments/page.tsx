'use client';
import useSWR, { mutate } from 'swr';
import { appointmentsApi } from '@/lib/api';
import { CheckCircle, XCircle, Calendar } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { DownloadCsvButton } from '@/components/ui/download-csv-button';
import { SectionAgent } from '@/components/dashboard/section-agent';

export default function AppointmentsPage() {
  const vertical = useVertical();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const heading = cap(vertical.appointmentNounPlural);
  const toast = useToast();
  const { data, isLoading } = useSWR('appointments', () =>
    appointmentsApi.list({ limit: 100 })
  );
  const appointments = (data as any)?.data ?? [];

  async function handleStatusChange(id: string, status: string) {
    try {
      await appointmentsApi.update(id, { status });
      await mutate('appointments');
      toast.success(status === 'completed' ? 'Marked completed' : status === 'no_show' ? 'Marked no-show' : 'Updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update');
    }
  }

  const upcoming = appointments.filter((a: any) =>
    a.status === 'confirmed' && new Date(a.startTime) >= new Date()
  );
  const past = appointments.filter((a: any) =>
    a.status === 'completed' || new Date(a.startTime) < new Date()
  );

  return (
    <div className="space-y-6">
      <SectionAgent section="appointments" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">{heading}</h1>
          <p className="text-gray-500 mt-1">Upcoming and past {vertical.appointmentNounPlural}</p>
        </div>
        <DownloadCsvButton
          rows={appointments}
          columns={[
            { label: 'Type', value: (a: any) => a.appointmentType },
            { label: 'Provider', value: (a: any) => a.providerName ?? '' },
            { label: 'Starts at', value: (a: any) => a.startsAt && new Date(a.startsAt) },
            { label: 'Duration (min)', value: (a: any) => a.durationMinutes },
            { label: 'Status', value: (a: any) => a.status },
            { label: 'Notes', value: (a: any) => a.notes ?? '' },
          ]}
          filename={`${vertical.appointmentNounPlural}.csv`}
        />
      </div>

      {/* Upcoming */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Upcoming ({upcoming.length})</h2>
        </div>
        {isLoading ? (
          <ListRowSkeleton rows={4} />
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            label={`No upcoming ${vertical.appointmentNounPlural}`}
            hint="Once your AI receptionist books one, it will appear here."
            compact
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {upcoming.map((appt: any) => (
              <div key={appt.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-12 text-center shrink-0">
                  <p className="text-lg font-bold text-gray-900">
                    {new Date(appt.startTime).getDate()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(appt.startTime).toLocaleString('en', { month: 'short' })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{appt.appointmentType}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(appt.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {' · '}{appt.durationMinutes}min
                    {appt.providerName ? ` · ${appt.providerName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleStatusChange(appt.id, 'completed')}
                    className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                    title="Mark completed"
                  >
                    <CheckCircle size={18} />
                  </button>
                  <button
                    onClick={() => handleStatusChange(appt.id, 'no_show')}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Mark no-show"
                  >
                    <XCircle size={18} />
                  </button>
                  <span className="badge badge-green">confirmed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
