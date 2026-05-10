'use client';
// ============================================================
// Settings → Audit Log
//
// Owner-only view of every consequential action taken on the
// tenant. Backed by GET /audit (already gated to owner-only).
// ============================================================
import useSWR from 'swr';
import { useState } from 'react';
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import { auditApi } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';

interface AuditRow {
  id: number;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_BADGE: Record<string, string> = {
  // Best-effort coloring; everything else falls back to badge-gray.
  'tenant.activated': 'badge-green',
  'tenant.registered': 'badge-green',
  'tenant.vertical_changed': 'badge-blue',
  'team.member_invited': 'badge-blue',
  'team.invite_accepted': 'badge-green',
  'team.member_removed': 'badge-red',
  'team.role_changed': 'badge-yellow',
  'team.invite_revoked': 'badge-red',
  'webhook.endpoint_created': 'badge-green',
  'webhook.endpoint_deleted': 'badge-red',
  'webhook.secret_rotated': 'badge-yellow',
  'call.manually_escalated': 'badge-yellow',
  'escalation.updated': 'badge-blue',
};

export default function AuditLogPage() {
  const [limit] = useState(100);
  const { data, isLoading, error } = useSWR(
    ['audit', limit],
    () => auditApi.list({ limit })
  );
  const rows = (data as { data: AuditRow[] } | undefined)?.data ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Audit Log</h1>
        <p className="text-gray-500 mt-1">
          Every consequential action taken on this tenant — settings changes, integration disconnects,
          team modifications, webhook rotations, escalations.
        </p>
      </div>

      <div className="card">
        {isLoading ? (
          <ListRowSkeleton rows={6} />
        ) : error ? (
          <EmptyState
            icon={ScrollText}
            label="Couldn't load audit log"
            hint="This page is owner-only — admins and staff cannot view it."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            label="No audit entries yet"
            hint="Audit entries are created when team members make changes."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((row) => (
              <AuditRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ row }: { row: AuditRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail =
    (row.before && Object.keys(row.before as object).length > 0) ||
    (row.after && Object.keys(row.after as object).length > 0) ||
    (row.metadata && Object.keys(row.metadata).length > 0);

  return (
    <div className="px-6 py-3">
      <button
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 text-left disabled:cursor-default"
        disabled={!hasDetail}
      >
        {hasDetail ? (
          expanded ? (
            <ChevronDown size={14} className="mt-1 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={14} className="mt-1 text-gray-400 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${ACTION_BADGE[row.action] ?? 'badge-gray'}`}>
              {row.action}
            </span>
            <span className="text-xs text-gray-500 font-mono">{row.entityType}</span>
            {row.entityId && (
              <span className="text-xs text-gray-400 font-mono truncate">{row.entityId.slice(0, 8)}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {row.actorType}
            {row.actorId ? ` · ${row.actorId.slice(0, 8)}` : ''}
            {' · '}
            {new Date(row.createdAt).toLocaleString()}
          </p>
        </div>
      </button>

      {expanded && hasDetail && (
        <div className="ml-6 mt-2 space-y-2 text-xs">
          {row.metadata && Object.keys(row.metadata).length > 0 && (
            <DiffBlock label="Metadata" value={row.metadata} />
          )}
          {row.before != null && (
            <DiffBlock label="Before" value={row.before} />
          )}
          {row.after != null && (
            <DiffBlock label="After" value={row.after} />
          )}
        </div>
      )}
    </div>
  );
}

function DiffBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <pre className="text-xs bg-gray-50 border border-gray-100 rounded-md p-3 overflow-auto max-h-48 text-gray-700 font-mono">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
