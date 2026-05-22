'use client';
// ============================================================
// /support — tenant-facing help & support page.
//
// Left:  Submit form (category + subject + message)
// Right: My previous tickets (with status + category pills)
//
// Submission fires an email to ADMIN_EMAILS with Reply-To set to the
// tenant's own email — replies from the founder land directly in their
// inbox. Tenants never see a back-and-forth thread inside the dashboard.
// ============================================================
import { useState } from 'react';
import useSWR from 'swr';
import {
  LifeBuoy,
  Bug,
  MessageSquare,
  CreditCard,
  Sparkles,
  Send,
  Loader2,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { supportApi, type SupportCategory, type SupportStatus, type SupportTicket } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';

const CATEGORIES: { value: SupportCategory; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'bug',             label: 'Bug',             icon: Bug,            description: 'Something is broken or behaving incorrectly' },
  { value: 'question',        label: 'Question',        icon: MessageSquare,  description: 'How does X work, or where do I find Y?' },
  { value: 'billing',         label: 'Billing',         icon: CreditCard,     description: 'Invoices, plans, charges, refunds' },
  { value: 'feature_request', label: 'Feature Request', icon: Sparkles,       description: 'An idea or feature you\'d love to have' },
];

const CATEGORY_META: Record<SupportCategory, { label: string; color: string; icon: React.ElementType }> = {
  bug:             { label: 'Bug',             color: 'bg-red-50 text-red-700 border-red-200',         icon: Bug },
  question:        { label: 'Question',        color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: MessageSquare },
  billing:         { label: 'Billing',         color: 'bg-amber-50 text-amber-800 border-amber-200',  icon: CreditCard },
  feature_request: { label: 'Feature Request', color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Sparkles },
};

const STATUS_META: Record<SupportStatus, { label: string; color: string; icon: React.ElementType }> = {
  open:     { label: 'Open',     color: 'bg-indigo-50 text-indigo-700',  icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
};

export default function SupportPage() {
  const toast = useToast();
  const [category, setCategory] = useState<SupportCategory>('question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, mutate: refetch } = useSWR('support-tickets', () => supportApi.list());
  const tickets = data?.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in both subject and message');
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.submit({ category, subject: subject.trim(), message: message.trim() });
      toast.success('Thanks — we\'ll get back to you within 1 business day. Watch your inbox.');
      setSubject('');
      setMessage('');
      setCategory('question');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-amber-500 flex items-center justify-center">
          <LifeBuoy size={22} className="text-white" />
        </div>
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Help &amp; Support</h1>
          <p className="text-cream-600 mt-1 max-w-2xl">
            Tell us what&apos;s going on — bugs, billing questions, feature ideas, anything. We read every message
            and reply directly to your account email, usually within 1 business day.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Submit form ──────────────────────────────────── */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="card p-6 space-y-5">
            <h2 className="font-semibold text-gray-900 text-base">Send us a message</h2>

            {/* Category picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      category === value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <Icon size={15} className={category === value ? 'text-brand-600 mt-0.5' : 'text-gray-500 mt-0.5'} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${category === value ? 'text-brand-900' : 'text-gray-900'}`}>{label}</p>
                      <p className={`text-[11px] leading-snug mt-0.5 ${category === value ? 'text-brand-700' : 'text-gray-500'}`}>
                        {description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                placeholder="Short summary — e.g. 'Can&apos;t connect Google Calendar'"
                className="input"
                maxLength={200}
                required
              />
              <p className="text-xs text-gray-400 mt-1 text-right tabular-nums">{subject.length} / 200</p>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 5000))}
                placeholder="Describe what's happening in as much detail as you can. Screenshots? Steps to reproduce? Anything that helps us help you faster."
                rows={8}
                className="input font-normal"
                maxLength={5000}
                required
              />
              <p className="text-xs text-gray-400 mt-1 text-right tabular-nums">{message.length} / 5000</p>
            </div>

            <button
              type="submit"
              disabled={submitting || !subject.trim() || !message.trim()}
              className="btn-primary"
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> Sending…</>
              ) : (
                <><Send size={15} /> Send message</>
              )}
            </button>

            <p className="text-xs text-gray-500 leading-relaxed">
              We&apos;ll reply by email to your account address. Sensitive info? Don&apos;t paste passwords or
              card numbers — we&apos;ll never ask for those.
            </p>
          </form>
        </div>

        {/* ── My tickets ───────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Your messages</h2>
              <p className="text-xs text-gray-500 mt-0.5">Tickets you&apos;ve sent — newest first</p>
            </div>

            {tickets.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <LifeBuoy size={26} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">Nothing yet</p>
                <p className="text-xs text-gray-400 mt-1">Submit your first message on the left.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                {tickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const cat = CATEGORY_META[ticket.category];
  const status = STATUS_META[ticket.status];
  const CatIcon = cat.icon;
  const StatusIcon = status.icon;
  return (
    <div className="px-5 py-3.5 hover:bg-gray-50">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-full ${cat.color}`}>
          <CatIcon size={9} /> {cat.label}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
          <StatusIcon size={9} /> {status.label}
        </span>
        <span className="text-[10px] text-gray-400 ml-auto tabular-nums">
          {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{ticket.message}</p>
    </div>
  );
}
