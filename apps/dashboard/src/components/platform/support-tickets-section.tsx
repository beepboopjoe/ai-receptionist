'use client';
// Cross-tenant support ticket queue for platform admin.
import { useState } from 'react';
import useSWR from 'swr';
import {
  LifeBuoy,
  Bug,
  MessageSquare,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Mail,
  Clock,
  RotateCcw,
  CheckCircle,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  platformApi,
  type AdminSupportTicket,
  type SupportCategory,
  type SupportStatus,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';

const CAT_META: Record<SupportCategory, { label: string; color: string; icon: React.ElementType }> = {
  bug:             { label: 'Bug',             color: 'bg-red-50 text-red-700 border-red-200',     icon: Bug },
  question:        { label: 'Question',        color: 'bg-blue-50 text-blue-700 border-blue-200',  icon: MessageSquare },
  billing:         { label: 'Billing',         color: 'bg-amber-50 text-amber-800 border-amber-200', icon: CreditCard },
  feature_request: { label: 'Feature Request', color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Sparkles },
};

export function SupportTicketsSection() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<SupportStatus | 'all'>('open');
  const [categoryFilter, setCategoryFilter] = useState<SupportCategory | 'all'>('all');

  const { data, mutate: refetch, isLoading, error } = useSWR(
    ['platform-tickets', statusFilter, categoryFilter],
    () =>
      platformApi.listTickets({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      })
  );
  const tickets = data?.data ?? [];

  async function handleResolve(id: string, subject: string) {
    try {
      await platformApi.resolveTicket(id);
      toast.success(`Marked resolved: ${subject}`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resolve');
    }
  }

  async function handleReopen(id: string, subject: string) {
    try {
      await platformApi.reopenTicket(id);
      toast.info(`Reopened: ${subject}`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reopen');
    }
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LifeBuoy size={16} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900">Support tickets</h2>
          <span className="text-xs text-gray-400">· last {tickets.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-200 p-0.5">
            {(['open', 'all', 'resolved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                  statusFilter === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as SupportCategory | 'all')}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All categories</option>
            <option value="bug">Bug</option>
            <option value="question">Question</option>
            <option value="billing">Billing</option>
            <option value="feature_request">Feature Request</option>
          </select>
        </div>
      </div>

      {error ? (
        <EmptyState
          icon={AlertTriangle}
          label="Couldn't load support tickets"
          hint={error instanceof Error ? error.message : 'The tickets API failed.'}
          cta={{ label: 'Retry', onClick: () => void refetch() }}
        />
      ) : isLoading ? (
        <ListRowSkeleton rows={3} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          label={statusFilter === 'open' ? "No open tickets — you're all caught up" : 'No tickets match these filters'}
          compact
        />
      ) : (
        <div className="divide-y divide-gray-50">
          {tickets.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              onResolve={() => handleResolve(t.id, t.subject)}
              onReopen={() => handleReopen(t.id, t.subject)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  onResolve,
  onReopen,
}: {
  ticket: AdminSupportTicket;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CAT_META[ticket.category] ?? CAT_META.question;
  const CatIcon = cat.icon;
  const created = new Date(ticket.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const mailto = `mailto:${ticket.submitterEmail}?subject=Re:%20${encodeURIComponent(ticket.subject)}`;

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-gray-400 hover:text-gray-700"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-full ${cat.color}`}>
              <CatIcon size={9} /> {cat.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              ticket.status === 'resolved'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-indigo-50 text-indigo-700'
            }`}>
              {ticket.status === 'resolved' ? <CheckCircle size={9} /> : <Clock size={9} />}
              {ticket.status}
            </span>
            <span className="text-[10px] text-gray-400">{created}</span>
          </div>
          <p
            className="text-sm font-semibold text-gray-900 truncate cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
          >
            {ticket.subject}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-medium text-gray-700">{ticket.tenantName}</span>
            {' · '}
            {ticket.submitterName ? `${ticket.submitterName} ` : ''}
            <span className="text-gray-400">&lt;{ticket.submitterEmail}&gt;</span>
          </p>
          {!expanded && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">{ticket.message}</p>
          )}
          {expanded && (
            <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ticket.message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={mailto}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors"
            title="Reply via email"
          >
            <Mail size={12} /> Reply
          </a>
          {ticket.status === 'open' ? (
            <button
              onClick={onResolve}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              <CheckCircle size={12} /> Resolve
            </button>
          ) : (
            <button
              onClick={onReopen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 text-xs font-semibold transition-colors"
              title="Reopen"
            >
              <RotateCcw size={12} /> Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
