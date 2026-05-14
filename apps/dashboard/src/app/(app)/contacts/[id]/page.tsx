'use client';
import useSWR, { mutate } from 'swr';
import { contactsApi, callsApi } from '@/lib/api';
import { ArrowLeft, Save, Phone } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useVertical } from '@/lib/useVertical';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const vertical = useVertical();
  const isHealthcare = vertical.id === 'dental';
  const insuranceLabel = isHealthcare ? 'Insurance Provider'
    : vertical.id === 'insurance' ? 'Carrier / Policy'
    : vertical.id === 'legal' ? 'Matter Type'
    : vertical.id === 'real_estate' ? 'Buyer / Seller'
    : vertical.id === 'home_services' ? 'Service Plan'
    : 'Account / Reference';
  const { data: contact } = useSWR(`contact-${params.id}`, () => contactsApi.get(params.id));
  const { data: calls } = useSWR(`contact-calls-${params.id}`, () =>
    callsApi.list({ limit: 20 })
  );
  const c = contact as any;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (c) {
      setForm({
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        email: c.email ?? '',
        insuranceProvider: c.insuranceProvider ?? '',
        notes: c.notes ?? '',
      });
    }
  }, [c]);

  const toast = useToast();
  async function handleSave() {
    setSaving(true);
    try {
      await contactsApi.update(params.id, form);
      await mutate(`contact-${params.id}`);
      setEditing(false);
      toast.success(`${vertical.contactNoun.charAt(0).toUpperCase() + vertical.contactNoun.slice(1)} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  if (!c) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton width="w-48" height="h-8" />
        <Skeleton width="w-full" height="h-48" rounded="lg" />
        <Skeleton width="w-full" height="h-32" rounded="lg" />
      </div>
    );
  }

  const contactCalls = ((calls as any)?.data ?? []) as any[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/contacts" className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">
          {c.firstName} {c.lastName}
        </h1>
        <span className={`badge ${c.contactType === 'new' ? 'badge-blue' : 'badge-gray'}`}>
          {c.contactType === 'new' ? `New ${vertical.contactNoun}` : `Returning ${vertical.contactNoun}`}
        </span>
      </div>

      {/* Info card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Contact Info</h2>
          <button
            onClick={() => setEditing(!editing)}
            className="btn-secondary text-sm"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'firstName', label: 'First Name' },
              { key: 'lastName', label: 'Last Name' },
              { key: 'email', label: 'Email' },
              { key: 'insuranceProvider', label: insuranceLabel },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="input text-sm"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="input text-sm"
                rows={3}
              />
            </div>
            <div className="col-span-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Phone', value: c.phoneE164 },
              { label: 'Email', value: c.email ?? '—' },
              ...(isHealthcare ? [{ label: 'Date of Birth', value: c.dateOfBirth ?? '—' }] : []),
              { label: insuranceLabel, value: c.insuranceProvider ?? '—' },
              { label: 'Source', value: c.source ?? '—' },
              ...(isHealthcare ? [{ label: 'Recall Due', value: c.recallDueDate ?? '—' }] : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 uppercase">{label}</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
            {c.notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase">Notes</p>
                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-line">{c.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call history */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Call History</h2>
        </div>
        {contactCalls.length === 0 ? (
          <EmptyState
            icon={Phone}
            label="No calls on record"
            hint={`No prior calls with this ${vertical.contactNoun}.`}
            compact
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {contactCalls.slice(0, 5).map((call: any) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}`}
                className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    call.status === 'completed' ? 'bg-green-500' :
                    call.status === 'missed' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">{call.summary ?? call.workflowTriggered ?? 'No summary'}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`badge ${call.outcome === 'booked' ? 'badge-green' : 'badge-gray'}`}>
                    {call.outcome ?? call.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {call.startedAt ? new Date(call.startedAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
