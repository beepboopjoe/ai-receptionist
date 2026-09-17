'use client';
// ============================================================
// DashboardChatWidget — in-app shortcut to place one outbound call.
//
// "Call +1… and tell them I’m following up about X." Parse → confirm
// → POST /calls/ai-task (pool CLI, contact upsert, Calls list).
// Dictation via Web Speech API; type if the mic isn't supported.
// Free / demo accounts confirm then see DemoUpgradeCard (no live dial).
// ============================================================
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Mic, MicOff, PhoneOutgoing, Loader2 } from 'lucide-react';
import { mutate } from 'swr';
import {
  formatNanpDisplay,
  parseCallIntent,
  type CallIntentParse,
} from '@ai-receptionist/shared';
import { ApiError, callsApi } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import { usePlan } from '@/lib/usePlan';
import { useToast } from '@/components/ui/toast';
import { DemoUpgradeCard } from '@/components/dashboard/demo-upgrade-card';
import { DASHBOARD_CHAT_OPEN_EVENT } from '@/lib/dashboard-chat';
import { useSpeechDictation } from '@/lib/use-speech-dictation';

type ParsedOk = Extract<CallIntentParse, { ok: true }>;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: ParsedOk;
  placed?: { callId: string; toNumber: string; contactId?: string };
  upgrade?: boolean;
};

const WELCOME = `Hi — I can place a call for you. Try: “Call +1 555-123-4567 and tell them I’m following up about the quote.” I’ll confirm before we dial.`;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DashboardChatWidget() {
  const toast = useToast();
  const { isDemoAccount, loading: planLoading } = usePlan();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  const appendDictation = useCallback((transcript: string) => {
    setInput((prev) => {
      const next = `${prev.trim()} ${transcript}`.trim();
      return next.slice(0, 500);
    });
  }, []);
  const dictation = useSpeechDictation(appendDictation);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(DASHBOARD_CHAT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(DASHBOARD_CHAT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      dictation.stop();
      return;
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    inputRef.current?.focus();
  }, [open, messages, sending, placing, dictation.stop]);

  async function place(intent: ParsedOk) {
    if (placing) return;
    setMessages((prev) => prev.map(stripIntent));
    if (isDemoAccount) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: 'Live outbound calls unlock after you upgrade. Explore the dashboard now — we’ll dial from here once you’re on a paid plan.',
          upgrade: true,
        },
      ]);
      return;
    }
    setPlacing(true);
    try {
      const res = await callsApi.aiTask({
        to: intent.to,
        task: intent.task,
        ...(intent.firstName ? { firstName: intent.firstName } : {}),
      });
      const callId = res.callId;
      if (!res.ok || !callId) {
        throw new Error(res.message ?? 'Could not place the call.');
      }
      const toNumber = res.toNumber ?? intent.to;
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: `Calling ${formatNanpDisplay(toNumber)} now. The live call shows up in Calls, and we’ll keep the contact in sync.`,
          placed: {
            callId,
            toNumber,
            ...(res.contactId ? { contactId: res.contactId } : {}),
          },
        },
      ]);
      toast.success(`Calling ${formatNanpDisplay(toNumber)}`, {
        href: `/calls/${callId}`,
        hrefLabel: 'Open call',
      });
      void mutate((key) => Array.isArray(key) && (key[0] === 'calls' || key[0] === 'contacts'));
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 402) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: 'Live outbound calls unlock after you upgrade.',
            upgrade: true,
          },
        ]);
        return;
      }
      const message = err instanceof Error ? err.message : 'Could not place the call.';
      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', content: message }]);
      toast.error(message);
    } finally {
      setPlacing(false);
    }
  }

  function submitText(raw: string) {
    const content = raw.replace(/\s+/g, ' ').trim();
    if (!content || sending || placing) return;
    setSending(true);
    setInput('');
    const userMsg: ChatMessage = { id: newId(), role: 'user', content };
    const parsed = parseCallIntent(content);
    const assistant: ChatMessage = parsed.ok
      ? {
          id: newId(),
          role: 'assistant',
          content: intentConfirmCopy(parsed),
          intent: parsed,
        }
      : { id: newId(), role: 'assistant', content: parsed.message };
    setMessages((prev) => [...prev, userMsg, assistant]);
    setSending(false);
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          className="pointer-events-auto flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-2xl shadow-cream-900/15"
          role="dialog"
          aria-labelledby={titleId}
        >
          <div className="flex items-center gap-2 border-b border-cream-100 bg-cream-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <MessageCircle size={15} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-serif text-base text-cream-900">
                Ask {BRAND_NAME}
              </h2>
              <p className="text-[11px] text-cream-600">Place a call in your own words</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-cream-500 hover:bg-cream-100 hover:text-cream-800"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={listRef} className="max-h-[min(60vh,22rem)] space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <Bubble
                key={m.id}
                message={m}
                placing={placing}
                onConfirm={(intent) => void place(intent)}
                onCancel={() =>
                  setMessages((prev) => prev.map((row) => (row.id === m.id ? stripIntent(row) : row)))
                }
              />
            ))}
          </div>

          <form
            className="border-t border-cream-100 bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitText(input);
            }}
          >
            {dictation.interim && (
              <p className="mb-1.5 text-[11px] italic text-cream-500">“{dictation.interim}”</p>
            )}
            {dictation.error && <p className="mb-1.5 text-[11px] text-amber-700">{dictation.error}</p>}
            <div className="flex items-end gap-2">
              {dictation.supported ? (
                <button
                  type="button"
                  onClick={dictation.toggle}
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    dictation.listening
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-cream-200 bg-cream-50 text-cream-700 hover:bg-cream-100'
                  }`}
                  aria-pressed={dictation.listening}
                  aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
                  title={dictation.listening ? 'Stop dictation' : 'Dictate'}
                >
                  {dictation.listening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              ) : (
                <span className="sr-only">Voice input isn’t available in this browser. Type instead.</span>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 500))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitText(input);
                  }
                }}
                placeholder="Call +1… and tell them…"
                maxLength={500}
                rows={2}
                disabled={sending || placing || planLoading}
                className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-cream-200 bg-cream-50 px-3 py-2 text-sm text-cream-900 placeholder:text-cream-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || placing || input.trim().length === 0}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                {sending || placing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </form>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/20 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-expanded={false}
          aria-label={`Ask ${BRAND_NAME}`}
        >
          <MessageCircle size={18} aria-hidden />
          <span className="hidden pr-0.5 sm:inline">Ask {BRAND_NAME}</span>
        </button>
      )}
    </div>
  );
}

function stripIntent(row: ChatMessage): ChatMessage {
  if (!row.intent) return row;
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.placed ? { placed: row.placed } : {}),
    ...(row.upgrade ? { upgrade: row.upgrade } : {}),
  };
}

function intentConfirmCopy(intent: ParsedOk): string {
  const who = intent.firstName
    ? `${intent.firstName} at ${formatNanpDisplay(intent.to)}`
    : formatNanpDisplay(intent.to);
  return `I’ll call ${who} and say: “${intent.task}”. Place this call?`;
}

function Bubble({
  message,
  placing,
  onConfirm,
  onCancel,
}: {
  message: ChatMessage;
  placing: boolean;
  onConfirm: (intent: ParsedOk) => void;
  onCancel: () => void;
}) {
  const mine = message.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] space-y-2 rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          mine ? 'bg-brand-600 text-white' : 'bg-cream-50 text-cream-900 border border-cream-100'
        }`}
      >
        <p>{message.content}</p>
        {message.intent && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onConfirm(message.intent!)}
              disabled={placing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {placing ? <Loader2 size={12} className="animate-spin" /> : <PhoneOutgoing size={12} />}
              Place call
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={placing}
              className="rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-xs font-semibold text-cream-700 hover:bg-cream-100"
            >
              Cancel
            </button>
          </div>
        )}
        {message.placed && (
          <p className="text-xs">
            <Link href={`/calls/${message.placed.callId}`} className="font-semibold text-brand-700 hover:underline">
              Open call
            </Link>
            {message.placed.contactId ? (
              <>
                {' · '}
                <Link
                  href={`/contacts/${message.placed.contactId}`}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  Open contact
                </Link>
              </>
            ) : null}
          </p>
        )}
        {message.upgrade && (
          <div className="pt-1">
            <DemoUpgradeCard
              title="Live calls after upgrade"
              body="Browse the dashboard now. After you upgrade, this chat places a real outbound call and updates Calls and Contacts."
            />
          </div>
        )}
      </div>
    </div>
  );
}
