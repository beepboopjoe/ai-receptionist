'use client';
// ============================================================
// /messages — SMS conversation list (inbox).
// Lists all threads grouped by external phone number, sorted by
// most-recent message. Clicking a thread opens the chat view.
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Phone, RefreshCw } from 'lucide-react';
import { smsApi, type SmsConversation } from '@/lib/api';
import { Skeleton as UiSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { useFeatureFlags } from '@/lib/featureFlags';
import { LockedFeature } from '@/components/ui/locked-feature';

// ── Relative time formatter ───────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Loading row ───────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
      <UiSkeleton width="w-10" height="h-10" />
      <div className="flex-1 space-y-2">
        <UiSkeleton width="w-32" height="h-4" />
        <UiSkeleton width="w-56" height="h-3" />
      </div>
      <UiSkeleton width="w-12" height="h-3" />
    </div>
  );
}

// ── Conversation row ──────────────────────────────────────────────────────────
function ConversationRow({ conv }: { conv: SmsConversation }) {
  const displayName = conv.contactName ?? conv.externalPhone;
  const initials = conv.contactName
    ? conv.contactName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : conv.externalPhone.slice(-2);

  return (
    <Link
      href={`/messages/${encodeURIComponent(conv.externalPhone)}`}
      className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-brand-700">{initials}</span>
      </div>

      {/* Name + preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          {conv.inboundCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold shrink-0">
              {conv.inboundCount > 9 ? '9+' : conv.inboundCount}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {conv.lastDirection === 'outbound' ? 'You: ' : ''}{conv.lastMessage}
        </p>
      </div>

      {/* Timestamp */}
      <span className="text-xs text-gray-400 shrink-0">{relativeTime(conv.lastAt)}</span>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const { has, loading: flagsLoading } = useFeatureFlags();
  const entitled = has('two_way_sms');
  const [conversations, setConversations] = useState<SmsConversation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await smsApi.listConversations();
      setConversations(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { if (entitled) void load(); }, [entitled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!flagsLoading && !entitled) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Messages</h1>
          <p className="text-gray-500 mt-1">Two-way SMS conversations with your contacts</p>
        </div>
        <LockedFeature requiredPlan="growth" reason="sms_locked" label="Requires a paid plan">
          <div className="card p-12 min-h-[260px] flex items-center justify-center">
            <EmptyState icon={MessageSquare} label="Two-way SMS preview" hint="Upgrade to Growth to send and receive messages." />
          </div>
        </LockedFeature>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Messages</h1>
          <p className="text-gray-500 mt-1">Two-way SMS conversations with your contacts</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* List */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <>{[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}</>
        ) : !conversations || conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            label="No messages yet"
            hint="When contacts text your number or you send a missed-call follow-up, conversations will appear here."
          />
        ) : (
          conversations.map((c) => (
            <ConversationRow key={c.externalPhone} conv={c} />
          ))
        )}
      </div>

      {/* Info footer */}
      {!loading && conversations && conversations.length > 0 && (
        <p className="text-center text-xs text-gray-400 pb-2">
          <Phone size={11} className="inline mr-1" />
          SMS sent from your provisioned Telnyx number · Configure in{' '}
          <Link href="/settings/phone-numbers" className="underline hover:text-gray-600">
            Phone Numbers
          </Link>
        </p>
      )}
    </div>
  );
}
