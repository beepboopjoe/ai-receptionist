'use client';
// ============================================================
// /messages/[phone] — SMS thread view.
// Inbound bubbles on the left (gray), outbound on the right (brand).
// Send box at the bottom. Polls every 10 s for new messages.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Send, Phone } from 'lucide-react';
import { smsApi, type SmsMessage, type SmsThread } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useFeatureFlags } from '@/lib/featureFlags';
import { LockedFeature } from '@/components/ui/locked-feature';
import { EmptyState } from '@/components/ui/empty-state';

// ── Relative time formatter ───────────────────────────────────────────────────
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Group messages by date for date separators
function groupByDate(msgs: SmsMessage[]): Array<{ date: string; messages: SmsMessage[] }> {
  const groups: Array<{ date: string; messages: SmsMessage[] }> = [];
  for (const msg of msgs) {
    const label = fmtDate(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === label) {
      last.messages.push(msg);
    } else {
      groups.push({ date: label, messages: [msg] });
    }
  }
  return groups;
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: SmsMessage }) {
  const isOutbound = msg.direction === 'outbound';
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-xs sm:max-w-sm lg:max-w-md`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isOutbound
              ? 'bg-brand-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          }`}
        >
          {msg.body}
        </div>
        <p className={`text-[10px] text-gray-400 mt-1 ${isOutbound ? 'text-right' : 'text-left'}`}>
          {fmtTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const phone = decodeURIComponent(params['phone'] as string);

  const { has, loading: flagsLoading } = useFeatureFlags();
  const entitled = has('two_way_sms');
  const [thread, setThread] = useState<SmsThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  async function loadThread(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await smsApi.getThread(phone);
      setThread(data);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }

  // Initial load + 10-second poll for new messages
  useEffect(() => {
    if (!entitled) return;
    void loadThread();
    const interval = setInterval(() => void loadThread(true), 10_000);
    return () => clearInterval(interval);
  }, [phone, entitled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await smsApi.send(phone, draft.trim());
      setDraft('');
      await loadThread(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const displayName = thread?.contactName ?? phone;
  const groups = thread ? groupByDate(thread.messages) : [];

  if (!flagsLoading && !entitled) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Messages</h1>
        <LockedFeature requiredPlan="growth" reason="sms_locked" label="Requires a paid plan">
          <div className="card p-12 min-h-[260px] flex items-center justify-center">
            <EmptyState icon={MessageSquare} label="Two-way SMS preview" hint="Upgrade to Growth to send and receive messages." />
          </div>
        </LockedFeature>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100 shrink-0">
        <button
          onClick={() => router.push('/messages')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Back to messages"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-brand-700">
            {displayName.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{displayName}</p>
          {thread?.contactId && (
            <Link
              href={`/contacts`}
              className="text-xs text-brand-600 hover:underline"
            >
              {phone}
            </Link>
          )}
          {!thread?.contactId && (
            <p className="text-xs text-gray-400">{phone}</p>
          )}
        </div>
        <a
          href={`tel:${phone}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
          title={`Call ${phone}`}
        >
          <Phone size={18} />
        </a>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Loading conversation…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
            <p>No messages yet.</p>
            <p className="text-xs">Send a message below to start the conversation.</p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs font-medium text-gray-400">{g.date}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {g.messages.map((msg) => (
                <Bubble key={msg.id} msg={msg} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Send box */}
      <div className="border-t border-gray-100 pt-3 shrink-0">
        <div className="flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="btn-primary h-11 px-4 disabled:opacity-50 shrink-0"
            aria-label="Send message"
          >
            {sending ? (
              <span className="text-xs">Sending…</span>
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          SMS sent from your provisioned Telnyx number
        </p>
      </div>
    </div>
  );
}
