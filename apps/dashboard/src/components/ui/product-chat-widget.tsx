'use client';
// ============================================================
// ProductChatWidget — floating FAQ / lead-gen chat on marketing pages.
// POST /api/v1/public/site-chat + /public/site-chat/lead.
// Not mounted in the logged-in app layout.
// ============================================================
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Phone, Sparkles, Loader2 } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

const API_URL = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1').replace(
  /\/$/,
  '',
);

const STORAGE_KEY = 'telfin-site-chat-v1';
const WELCOME =
  "Hi — I'm the Telfin assistant. Ask about the AI receptionist, plans (Growth $199 / Scale $399 / Business $599), voices, going live, or hearing it on your phone.";

type ChatRole = 'user' | 'assistant';
type ChatMessage = { role: ChatRole; content: string };
type Cta = { label: string; href: string };

type Stored = {
  conversationId: string | null;
  messages: ChatMessage[];
  captured: boolean;
};

const STARTERS = [
  'How does pricing work?',
  'Can I hear it on my phone?',
  'What voices can I pick?',
  'How do I go live?',
];

function loadStored(): Stored {
  if (typeof window === 'undefined') {
    return { conversationId: null, messages: [], captured: false };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversationId: null, messages: [], captured: false };
    const parsed = JSON.parse(raw) as Stored;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(
          (m): m is ChatMessage =>
            !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
        )
      : [];
    return {
      conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : null,
      messages,
      captured: Boolean(parsed.captured),
    };
  } catch {
    return { conversationId: null, messages: [], captured: false };
  }
}

function persistStored(next: Stored): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

export function ProductChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestCapture, setSuggestCapture] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [ctas, setCtas] = useState<Cta[]>([
    { label: 'Try Free', href: '/signup?plan=trial' },
    { label: 'Hear it on your phone', href: '/demo#call-me' },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  useEffect(() => {
    const stored = loadStored();
    setConversationId(stored.conversationId);
    setMessages(stored.messages);
    setCaptured(stored.captured);
  }, []);

  useEffect(() => {
    persistStored({ conversationId, messages, captured });
  }, [conversationId, messages, captured]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    inputRef.current?.focus();
  }, [open, messages, showLead, sending]);

  const send = useCallback(
    async (text: string) => {
      const content = text.replace(/\s+/g, ' ').trim();
      if (!content || sending) return;
      setSending(true);
      setError(null);
      setInput('');
      const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
      setMessages(nextMessages);

      try {
        const res = await fetch(`${API_URL}/public/site-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages.slice(-12),
            ...(conversationId ? { conversationId } : {}),
            pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
          }),
        });
        let body: {
          ok?: boolean;
          reply?: string;
          conversationId?: string;
          suggestCapture?: boolean;
          message?: string;
          ctas?: Cta[];
        } = {};
        try {
          body = (await res.json()) as typeof body;
        } catch {
          /* non-JSON */
        }

        if (!res.ok || !body.reply) {
          const fallback =
            body.message ||
            (res.status === 429
              ? 'Too many messages just now. Try pricing, or hear it on your phone.'
              : 'Chat is taking a break. Try pricing or the live phone demo.');
          setError(fallback);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: fallback,
            },
          ]);
          return;
        }

        if (typeof body.conversationId === 'string') setConversationId(body.conversationId);
        setMessages((prev) => [...prev, { role: 'assistant', content: body.reply as string }]);
        if (Array.isArray(body.ctas) && body.ctas.length) setCtas(body.ctas);
        if (body.suggestCapture && !captured) {
          setSuggestCapture(true);
        }
      } catch {
        setError("We couldn't reach chat. The rest of the site still works.");
      } finally {
        setSending(false);
      }
    },
    [captured, conversationId, messages, sending],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {open && (
        <button
          type="button"
          className="pointer-events-auto absolute inset-0 bg-cream-900/25 sm:pointer-events-none sm:bg-transparent"
          aria-label="Dismiss chat"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="pointer-events-none absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col items-end">
      {open && (
        <div
          className="pointer-events-auto mb-3 flex w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-xl shadow-cream-900/10"
          style={{ height: 'min(32rem, calc(100dvh - 6.5rem))' }}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="flex items-start gap-3 border-b border-cream-100 bg-gradient-to-br from-brand-50 to-amber-50/60 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 font-serif text-sm text-white">
              TF
            </div>
            <div className="min-w-0 flex-1">
              <p id={titleId} className="font-serif text-base text-cream-900">
                Ask {BRAND_NAME}
              </p>
              <p className="text-[11px] leading-snug text-cream-600">
                Product questions, pricing, and how to try it. Not a live phone call.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-cream-500 hover:bg-white/70 hover:text-cream-800"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            <p className="rounded-2xl rounded-tl-md bg-cream-50 px-3 py-2 text-sm leading-relaxed text-cream-800">
              {WELCOME}
            </p>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="rounded-full border border-cream-200 bg-white px-2.5 py-1 text-[11px] font-medium text-cream-700 hover:border-brand-200 hover:text-brand-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <p
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-tr-md bg-brand-600 text-white'
                      : 'rounded-tl-md bg-cream-50 text-cream-800'
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}

            {sending && (
              <p className="flex items-center gap-2 text-xs text-cream-500">
                <Loader2 size={12} className="animate-spin" /> Thinking…
              </p>
            )}

            {error && <p className="text-xs text-amber-800">{error}</p>}

            {captured ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-900">
                Thanks — we have your details. Try Free (no card) or hear it on your phone whenever
                you like.
              </div>
            ) : showLead ? (
              <LeadForm
                conversationId={conversationId}
                messages={messages}
                onCancel={() => setShowLead(false)}
                onSaved={() => {
                  setCaptured(true);
                  setShowLead(false);
                  setSuggestCapture(false);
                }}
              />
            ) : (
              suggestCapture && (
                <button
                  type="button"
                  onClick={() => setShowLead(true)}
                  className="w-full rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-left text-xs font-medium text-brand-800 hover:bg-brand-100/60"
                >
                  Want a follow-up? Leave your name and email or phone (consent required).
                </button>
              )
            )}
          </div>

          <div className="border-t border-cream-100 px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ctas.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="inline-flex items-center gap-1 rounded-full border border-cream-200 px-2.5 py-0.5 text-[11px] font-semibold text-cream-700 hover:border-brand-200 hover:text-brand-700"
                >
                  {c.href.includes('call-me') || c.href.includes('demo') ? (
                    <Phone size={10} />
                  ) : (
                    <Sparkles size={10} />
                  )}
                  {c.label}
                </Link>
              ))}
              {!captured && !showLead && (
                <button
                  type="button"
                  onClick={() => setShowLead(true)}
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-cream-500 hover:text-brand-700"
                >
                  Leave details
                </button>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2"
            >
              <label className="sr-only" htmlFor="site-chat-input">
                Message
              </label>
              <textarea
                id="site-chat-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask about Telfin…"
                maxLength={800}
                disabled={sending}
                className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-cream-200 bg-cream-50 px-3 py-2 text-sm text-cream-900 placeholder:text-cream-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || input.trim().length === 0}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/20 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-expanded={false}
        >
          <MessageCircle size={18} />
          <span className="pr-0.5">Ask Telfin</span>
        </button>
      )}
      </div>
    </div>
  );
}

function LeadForm({
  conversationId,
  messages,
  onCancel,
  onSaved,
}: {
  conversationId: string | null;
  messages: ChatMessage[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (saving) return;
    if (!name.trim() || name.trim().length < 2) {
      setFormError('Enter your name so we know who to follow up with.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setFormError('Leave an email and/or a US/Canada phone so we can follow up.');
      return;
    }
    if (email.trim() && !emailConsent) {
      setFormError('Check the box to agree to product emails, or clear the email field.');
      return;
    }
    if (phone.trim() && !smsConsent) {
      setFormError(
        'Check the box to agree to a call or text on that number, or clear the phone field.',
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_URL}/public/site-chat/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          emailConsent,
          smsConsent,
          ...(conversationId ? { conversationId } : {}),
          pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
          messages,
        }),
      });
      let body: { ok?: boolean; message?: string } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        /* ignore */
      }
      if (!res.ok || !body.ok) {
        setFormError(body.message || 'Could not save your details. Try emailing hello@telfin.ai.');
        return;
      }
      onSaved();
    } catch {
      setFormError('Could not save your details. Try again, or email hello@telfin.ai.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-2 rounded-xl border border-cream-200 bg-white p-3"
    >
      <p className="text-xs font-semibold text-cream-900">Leave a way to reach you</p>
      <label className="block text-[11px] font-medium text-cream-600">
        Name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-cream-200 px-2.5 py-1.5 text-sm text-cream-900"
          autoComplete="name"
        />
      </label>
      <label className="block text-[11px] font-medium text-cream-600">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-cream-200 px-2.5 py-1.5 text-sm text-cream-900"
          autoComplete="email"
        />
      </label>
      <label className="block text-[11px] font-medium text-cream-600">
        Phone (US/CA, optional)
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-cream-200 px-2.5 py-1.5 text-sm text-cream-900"
          autoComplete="tel"
          placeholder="(415) 321-1212"
        />
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-snug text-cream-700">
        <input
          type="checkbox"
          checked={emailConsent}
          onChange={(e) => setEmailConsent(e.target.checked)}
          className="mt-0.5 rounded border-cream-400 text-brand-600"
        />
        <span>
          I agree to receive product emails from Telfin. I can unsubscribe anytime. Consent is not
          required to buy.{' '}
          <Link href="/privacy" className="text-brand-700 underline underline-offset-2">
            Privacy
          </Link>
        </span>
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-snug text-cream-700">
        <input
          type="checkbox"
          checked={smsConsent}
          onChange={(e) => setSmsConsent(e.target.checked)}
          className="mt-0.5 rounded border-cream-400 text-brand-600"
        />
        <span>
          If I entered a phone number, I agree that Telfin may call and/or text me about this
          product (including autodialed or AI calls). Message/data rates may apply. Consent is not
          required to buy. Reply STOP to opt out of texts.
        </span>
      </label>
      {formError && <p className="text-[11px] text-amber-800">{formError}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Send details'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-cream-600 hover:bg-cream-50"
        >
          Not now
        </button>
      </div>
    </form>
  );
}
