'use client';
import useSWR, { mutate } from 'swr';
import { campaignsApi } from '@/lib/api';
import {
  ArrowLeft, Play, Pause, XCircle, Upload, X,
  CheckCircle2, Phone, Calendar, Mail, ChevronRight, Users
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

const STATUSES = ['all', 'pending', 'dialing', 'connected', 'qualified', 'not_qualified', 'booked', 'voicemail', 'no_answer', 'failed', 'do_not_call'];

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-gray',
  queued: 'badge-blue',
  dialing: 'badge-blue',
  connected: 'badge-blue',
  voicemail: 'badge-gray',
  no_answer: 'badge-gray',
  qualified: 'badge-green',
  not_qualified: 'badge-gray',
  booked: 'badge-green',
  failed: 'badge-red',
  do_not_call: 'badge-red',
};

const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray',
  running: 'badge-green',
  paused: 'badge-blue',
  completed: 'badge-gray',
  cancelled: 'badge-red',
};

// ---- Lead detail slide-over ----
function LeadPanel({
  lead,
  campaignId,
  onClose,
  onUpdated,
}: {
  lead: any;
  campaignId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [overriding, setOverriding] = useState(false);
  const [newStatus, setNewStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);

  async function handleOverride() {
    setSaving(true);
    try {
      await campaignsApi.updateContact(campaignId, lead.id, { status: newStatus });
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDNC() {
    if (!confirm(`Mark ${lead.firstName} ${lead.lastName} as Do Not Call? This will prevent future dialling across all campaigns.`)) return;
    setSaving(true);
    try {
      await campaignsApi.updateContact(campaignId, lead.id, { status: 'do_not_call', outcome: 'manual_dnc' });
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{lead.firstName} {lead.lastName}</h2>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{lead.phoneE164}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status + outcome */}
          <div className="flex items-center gap-3">
            <span className={`badge ${STATUS_BADGE[lead.status] ?? 'badge-gray'}`}>
              {lead.status.replace(/_/g, ' ')}
            </span>
            {lead.outcome && lead.outcome !== lead.status && (
              <span className="text-xs text-gray-400">({lead.outcome})</span>
            )}
            {lead.retryCount > 0 && (
              <span className="text-xs text-gray-400">{lead.retryCount} retries</span>
            )}
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Info</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-gray-400" />
                <span className="font-mono text-gray-700">{lead.phoneE164}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-gray-400" />
                  <span className="text-gray-700">{lead.email}</span>
                </div>
              )}
              {lead.appointmentId && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-gray-400" />
                  <Link
                    href={`/appointments?highlight=${lead.appointmentId}`}
                    className="text-brand-600 hover:underline"
                  >
                    View booked appointment →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Qualification notes */}
          {lead.qualificationNotes && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">AI Qualification Notes</h3>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 leading-relaxed">
                {lead.qualificationNotes}
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Timeline</h3>
            <div className="space-y-1 text-xs text-gray-500">
              <p>Added: {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '—'}</p>
              <p>Last dialled: {lead.lastDialedAt ? new Date(lead.lastDialedAt).toLocaleString() : 'Not yet'}</p>
              {lead.nextRetryAt && lead.status === 'pending' && (
                <p>Next retry: {new Date(lead.nextRetryAt).toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Related call link */}
          {lead.callId && (
            <div>
              <Link
                href={`/calls/${lead.callId}`}
                className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
              >
                <Phone size={14} /> View call transcript →
              </Link>
            </div>
          )}

          {/* Status override */}
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Manual Override</h3>
            {overriding ? (
              <div className="space-y-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input text-sm w-full"
                >
                  {['pending', 'qualified', 'not_qualified', 'booked', 'failed'].map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleOverride}
                    disabled={saving}
                    className="btn-primary text-xs flex-1"
                  >
                    {saving ? 'Saving…' : 'Apply Status'}
                  </button>
                  <button onClick={() => setOverriding(false)} className="btn-secondary text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setOverriding(true)} className="btn-secondary text-xs">
                  Change Status
                </button>
                {lead.status !== 'do_not_call' && (
                  <button
                    onClick={handleDNC}
                    disabled={saving}
                    className="btn-secondary text-xs text-red-600 hover:text-red-700"
                  >
                    Mark Do Not Call
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---- Main page ----
export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: campaign, isLoading } = useSWR(`campaign-${id}`, () => campaignsApi.get(id));
  const { data: stats } = useSWR(`campaign-stats-${id}`, () => campaignsApi.getStats(id));
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const contactsKey = `campaign-contacts-${id}-${statusFilter}-${page}`;
  const { data: contactsData } = useSWR(
    contactsKey,
    () => campaignsApi.getContacts(id, {
      limit: 50,
      offset: page * 50,
      ...(statusFilter !== 'all' && { status: statusFilter }),
    })
  );

  const [actionLoading, setActionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const c = campaign as any;
  const s = stats as any;
  const contacts = ((contactsData as any)?.data ?? []) as any[];
  const totalContacts = (contactsData as any)?.total ?? 0;

  async function handleAction(action: 'start' | 'pause' | 'cancel') {
    setActionLoading(true);
    try {
      if (action === 'start') await campaignsApi.start(id);
      else if (action === 'pause') await campaignsApi.pause(id);
      else await campaignsApi.cancel(id);
      await mutate(`campaign-${id}`);
      await mutate(`campaign-stats-${id}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await campaignsApi.uploadLeads(id, file);
      setUploadResult(result);
      await mutate(`campaign-${id}`);
      await mutate(`campaign-stats-${id}`);
      await mutate(contactsKey);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton width="w-64" height="h-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="w-full" height="h-24" rounded="lg" />
          ))}
        </div>
        <Skeleton width="w-full" height="h-64" rounded="lg" />
      </div>
    );
  }
  if (!c) {
    return (
      <EmptyState
        icon={XCircle}
        label="Campaign not found"
        hint="It may have been deleted or you don't have access."
        cta={{ label: 'Back to campaigns', href: '/campaigns' }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Lead detail slide-over */}
      {selectedLead && (
        <LeadPanel
          lead={selectedLead}
          campaignId={id}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => mutate(contactsKey)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/campaigns" className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{c.name}</h1>
        <span className={`badge ${CAMPAIGN_STATUS_BADGE[c.status] ?? 'badge-gray'}`}>{c.status}</span>

        {(c.status === 'draft' || c.status === 'paused') && (
          <button
            onClick={() => handleAction('start')}
            disabled={actionLoading || c.totalLeads === 0}
            className="btn-primary text-sm"
            title={c.totalLeads === 0 ? 'Upload leads first' : undefined}
          >
            <Play size={15} /> {c.status === 'paused' ? 'Resume' : 'Start Campaign'}
          </button>
        )}
        {c.status === 'running' && (
          <button onClick={() => handleAction('pause')} disabled={actionLoading} className="btn-secondary text-sm">
            <Pause size={15} /> Pause
          </button>
        )}
        {c.status !== 'cancelled' && c.status !== 'completed' && (
          <button
            onClick={() => handleAction('cancel')}
            disabled={actionLoading}
            className="btn-secondary text-sm text-red-600 hover:text-red-700"
          >
            <XCircle size={15} /> Cancel
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Leads', value: s?.totalLeads ?? c.totalLeads, sub: null, color: '' },
          { label: 'Dialed', value: s?.dialedCount ?? c.dialedCount, sub: null, color: '' },
          { label: 'Connected', value: s?.connectedCount ?? c.connectedCount, sub: s?.connectRate, color: '' },
          { label: 'Qualified', value: s?.qualifiedCount ?? c.qualifiedCount, sub: s?.qualifyRate, color: 'text-green-600' },
          { label: 'Booked', value: s?.bookedCount ?? c.bookedCount, sub: s?.bookRate, color: 'text-green-700' },
          { label: 'Voicemail', value: s?.voicemailCount ?? c.voicemailCount, sub: null, color: '' },
          { label: 'Failed', value: s?.failedCount ?? c.failedCount, sub: null, color: 'text-red-500' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value ?? 0}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* CSV Upload */}
      {c.status !== 'completed' && c.status !== 'cancelled' && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Upload Leads</h2>
          <p className="text-sm text-gray-500 mb-4">
            CSV must include:{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">first_name</code>,{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">phone</code>.
            Optional:{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">last_name</code>,{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">email</code>.
          </p>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-brand-300 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto mb-2 text-gray-400" size={28} />
            <p className="text-sm font-medium text-gray-700">
              {uploading ? 'Uploading…' : 'Click or drop CSV file here'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Up to 10,000 rows</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {uploadResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-1">
              <p className="text-sm font-semibold text-gray-900">Upload complete</p>
              <p className="text-sm text-green-600">✓ {uploadResult.inserted} leads added</p>
              {uploadResult.skipped > 0 && (
                <p className="text-sm text-gray-500">⊘ {uploadResult.skipped} duplicate phones skipped</p>
              )}
              {uploadResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-red-600">Row errors ({uploadResult.errors.length}):</p>
                  <ul className="text-xs text-red-500 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                    {uploadResult.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {uploadResult.errors.length > 10 && (
                      <li>…and {uploadResult.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lead table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-gray-900">
            Leads{' '}
            <span className="text-gray-400 font-normal text-sm">({totalContacts})</span>
          </h2>

          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            label="No leads in this campaign"
            hint="Upload a CSV to start dialing."
            compact
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Name', 'Phone', 'Status', 'Retries', 'Qualification Notes', 'Last Dialed', ''].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((lead: any) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        {lead.firstName} {lead.lastName}
                        {lead.appointmentId && (
                          <span className="ml-2 text-xs text-green-600">
                            <CheckCircle2 size={12} className="inline" /> booked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 font-mono">{lead.phoneE164}</td>
                      <td className="px-6 py-3">
                        <span className={`badge ${STATUS_BADGE[lead.status] ?? 'badge-gray'}`}>
                          {lead.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{lead.retryCount}</td>
                      <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate">
                        {lead.qualificationNotes ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {lead.lastDialedAt ? new Date(lead.lastDialedAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <ChevronRight size={15} className="text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {totalContacts === 0
                  ? 'No leads'
                  : `Showing ${page * 50 + 1}–${Math.min((page + 1) * 50, totalContacts)} of ${totalContacts}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * 50 >= totalContacts}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
