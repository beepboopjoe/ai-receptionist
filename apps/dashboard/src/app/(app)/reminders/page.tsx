'use client';
import useSWR from 'swr';
import { notificationsApi } from '@/lib/api';
import { Bell, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { useVertical } from '@/lib/useVertical';
import { SectionAgent } from '@/components/dashboard/section-agent';

export default function RemindersPage() {
  const vertical = useVertical();
  const { data, isLoading, mutate } = useSWR('notifications', () => notificationsApi.list());
  const notifications = (data as any)?.data ?? [];

  async function handleResend(id: string) {
    await notificationsApi.resend(id);
    await mutate();
  }

  return (
    <div className="space-y-6">
      <SectionAgent section="reminders" />

      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Reminders</h1>
        <p className="text-gray-500 mt-1">SMS and email notifications sent to {vertical.contactNounPlural}</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Notification History</h2>
        </div>
        {isLoading ? (
          <ListRowSkeleton rows={5} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            label="No notifications sent yet"
            hint={`Confirmations and reminders sent to your ${vertical.contactNounPlural} will appear here.`}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n: any) => (
              <div key={n.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`badge ${
                      n.status === 'sent' ? 'badge-green' :
                      n.status === 'failed' ? 'badge-red' :
                      'badge-yellow'
                    }`}>{n.status}</span>
                    <span className="badge badge-gray">{n.channel}</span>
                    <span className="text-sm text-gray-600">{n.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {n.toAddress} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                  </p>
                  {n.failedReason && (
                    <p className="text-xs text-red-500 mt-0.5">Error: {n.failedReason}</p>
                  )}
                </div>
                {n.status === 'failed' && (
                  <button
                    onClick={() => handleResend(n.id)}
                    className="btn-secondary text-sm"
                  >
                    <RefreshCw size={14} /> Resend
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
