'use client';
import useSWR, { mutate } from 'swr';
import { contactsApi } from '@/lib/api';
import { Search, ChevronRight, Users, Trash2, Download as DownloadIcon, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useVertical } from '@/lib/useVertical';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { DownloadCsvButton } from '@/components/ui/download-csv-button';
import { useToast } from '@/components/ui/toast';
import { downloadCsv } from '@/lib/csv';
import { SectionAgent } from '@/components/dashboard/section-agent';

export default function ContactsPage() {
  const vertical = useVertical();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useSWR(
    ['contacts', search],
    () => contactsApi.list({ q: search, limit: 50 })
  );
  const contacts = ((data as any)?.data ?? []) as Array<Record<string, any>>;
  const heading = vertical.contactNounPlural.charAt(0).toUpperCase() + vertical.contactNounPlural.slice(1);

  // ── Bulk selection state ───────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c['id']));
  const selectedRows = useMemo(
    () => contacts.filter((c) => selected.has(c['id'])),
    [contacts, selected]
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c['id']))
    );
  }
  function clearSelection() {
    setSelected(new Set());
  }

  // ── CSV column shape (used by header button + bulk toolbar) ─
  const csvColumns = [
    { label: 'First name', value: (c: Record<string, any>) => c['firstName'] ?? '' },
    { label: 'Last name',  value: (c: Record<string, any>) => c['lastName'] ?? '' },
    { label: 'Phone',      value: (c: Record<string, any>) => c['phoneE164'] ?? '' },
    { label: 'Email',      value: (c: Record<string, any>) => c['email'] ?? '' },
    { label: 'Type',       value: (c: Record<string, any>) => c['contactType'] ?? '' },
    { label: 'Source',     value: (c: Record<string, any>) => c['source'] ?? '' },
    { label: 'Created',    value: (c: Record<string, any>) => c['createdAt'] ? new Date(c['createdAt']) : '' },
  ];

  async function handleBulkDelete() {
    if (selectedRows.length === 0) return;
    if (!confirm(`Delete ${selectedRows.length} ${vertical.contactNounPlural}? This can't be undone.`)) return;
    setBulkBusy(true);
    try {
      const ids = selectedRows.map((c) => c['id'] as string);
      const res = await contactsApi.bulkDelete(ids);
      toast.success(`Deleted ${res.deleted} ${vertical.contactNounPlural}`);
      clearSelection();
      await mutate(['contacts', search]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setBulkBusy(false);
    }
  }

  function handleBulkExport() {
    downloadCsv(selectedRows, csvColumns, `${vertical.contactNounPlural}-selected.csv`);
  }

  return (
    <div className="space-y-6">
      <SectionAgent section="contacts" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">{heading}</h1>
          <p className="text-gray-500 mt-1">{(data as any)?.total ?? 0} total {vertical.contactNounPlural}</p>
        </div>
        <DownloadCsvButton
          rows={contacts}
          columns={csvColumns}
          filename={`${vertical.contactNounPlural}.csv`}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email…"
          className="input pl-9"
        />
      </div>

      {/* Bulk action toolbar — appears when ≥1 selected. Sticky-ish UX:
          we just render in the flow rather than position-fixed for simplicity. */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-brand-900">
            {selected.size} selected
          </span>
          <span className="text-brand-300">·</span>
          <button
            onClick={handleBulkExport}
            className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900 font-medium"
          >
            <DownloadIcon size={14} /> Export selected
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900"
          >
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <ListRowSkeleton rows={6} />
        ) : contacts.length === 0 ? (
          <div className="p-6 space-y-4">
            <EmptyState
              icon={Users}
              label={`No ${vertical.contactNounPlural} found`}
              hint={search ? 'Try a different search term.' : `Import a CSV from your CRM, or let us find leads for you.`}
              {...(search ? {} : { cta: { label: 'Go to Settings → Integrations', href: '/settings/integrations' } })}
            />
          </div>
        ) : (
          <>
            {/* Header row with select-all */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label={allSelected ? 'Deselect all' : 'Select all'}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                {allSelected ? 'All selected' : `${contacts.length} ${vertical.contactNounPlural}`}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {contacts.map((c) => {
                const isSelected = selected.has(c['id']);
                return (
                  <div
                    key={c['id']}
                    className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                      isSelected ? 'bg-brand-50/40' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(c['id'])}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${c['firstName']} ${c['lastName']}`}
                      className="h-4 w-4 rounded border-gray-300 shrink-0"
                    />
                    <Link
                      href={`/contacts/${c['id']}`}
                      className="flex items-center gap-4 flex-1 min-w-0 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-semibold text-brand-700 shrink-0">
                        {c['firstName']?.[0]}
                        {c['lastName']?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {c['firstName']} {c['lastName']}
                        </p>
                        <p className="text-xs text-gray-500">
                          {c['phoneE164']} {c['email'] ? `· ${c['email']}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className={`badge ${c['contactType'] === 'new' ? 'badge-blue' : 'badge-gray'}`}>
                          {c['contactType'] === 'new' ? `New ${vertical.contactNoun}` : `Returning ${vertical.contactNoun}`}
                        </span>
                        {vertical.id === 'dental' &&
                          c['recallDueDate'] &&
                          new Date(c['recallDueDate']) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                            <span className="badge badge-yellow">Recall due</span>
                          )}
                      </div>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
