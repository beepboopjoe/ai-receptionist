'use client';
import useSWR, { mutate } from 'swr';
import { escalationsApi } from '@/lib/api';
import { AlertCircle, CheckCircle, PartyPopper } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { DownloadCsvButton } from '@/components/ui/download-csv-button';
import { SectionAgent } from '@/components/dashboard/section-agent';

export default function EscalationsPage() {
  const { data } = useSWR('escalations', () => escalationsApi.list());
  const escalations = (data as any)?.data ?? [];
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const toast = useToast();

  async function handleResolve(id: string) {
    if (!note.trim()) return;
    setResolvingId(id);
    try {
      await escalationsApi.update(id, { status: 'resolved', resolutionNote: note });
      await mutate('escalations');
      setNote('');
      toast.success('Escalation resolved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resolve escalation');
    } finally {
      setResolvingId(null);
    }
  }

  const open = escalations.filter((e: any) => e.status === 'open');
  const resolved = escalations.filter((e: any) => e.status === 'resolved');

  return (
    <div className="space-y-6">
      <SectionAgent section="escalations" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Escalations</h1>
          <p className="text-gray-500 mt-1">Calls that require staff follow-up</p>
        </div>
        <DownloadCsvButton
          rows={escalations}
          columns={[
            { label: 'Reason', value: (e: any) => e.reason },
            { label: 'Priority', value: (e: any) => e.priority },
            { label: 'Status', value: (e: any) => e.status },
            { label: 'Created', value: (e: any) => e.createdAt && new Date(e.createdAt) },
            { label: 'Resolved', value: (e: any) => e.resolvedAt && new Date(e.resolvedAt) },
            { label: 'Resolution note', value: (e: any) => e.resolutionNote ?? '' },
          ]}
          filename="escalations.csv"
        />
      </div>

      {/* Open */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-500" />
          <h2 className="font-semibold text-gray-900">Open ({open.length})</h2>
        </div>
        {open.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            label="No open escalations"
            hint="Calls that need staff follow-up will land here."
            compact
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {open.map((esc: any) => (
              <div key={esc.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${esc.priority === 'urgent' ? 'badge-red' : 'badge-yellow'}`}>
                        {esc.priority}
                      </span>
                      <span className="text-sm text-gray-600">{esc.reason.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {esc.createdAt ? new Date(esc.createdAt).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
                {resolvingId === esc.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Resolution note…"
                      className="input flex-1 text-sm"
                    />
                    <button
                      onClick={() => handleResolve(esc.id)}
                      className="btn-primary text-sm"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setResolvingId(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setResolvingId(esc.id)}
                    className="btn-secondary text-sm mt-3"
                  >
                    <CheckCircle size={14} /> Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-500">Resolved ({resolved.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {resolved.slice(0, 10).map((esc: any) => (
              <div key={esc.id} className="px-6 py-4 opacity-60">
                <span className="badge badge-green mr-2">resolved</span>
                <span className="text-sm text-gray-600">{esc.reason.replace(/_/g, ' ')}</span>
                {esc.resolutionNote && (
                  <p className="text-xs text-gray-400 mt-1">Note: {esc.resolutionNote}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
