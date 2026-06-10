'use client';
// ============================================================
// AskYourAiCard (Phase 29b) — the plain-English task box.
//
// "Call Maria and ask if she can move her Tuesday appointment to
// Thursday afternoon." The owner types who to call + what to do,
// the AI places the call, and the result lands in /calls with a
// transcript. One number per request — list-calling is Campaigns.
//
// Backend: POST /calls/ai-task (rate-limited 5/hour/tenant).
// ============================================================
import { useState } from 'react';
import Link from 'next/link';
import { PhoneOutgoing, Sparkles, Loader2 } from 'lucide-react';
import { callsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

/** Normalize common US/CA inputs ("555-123-4567", "(555) 123 4567") to E164. */
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.startsWith('+') && /^\+1[2-9]\d{9}$/.test(raw)) return raw;
  return null;
}

const EXAMPLES = [
  'Confirm tomorrow’s 2pm appointment and ask them to bring their insurance card',
  'Ask if they’re still interested in the quote we sent last week',
  'Let them know their order is ready for pickup any time before 6pm',
];

export function AskYourAiCard() {
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [task, setTask] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placedTo, setPlacedTo] = useState<string | null>(null);

  async function handleCall() {
    const e164 = toE164(phone.trim());
    if (!e164) {
      toast.error('Enter a valid US or Canadian phone number, like 555-123-4567.');
      return;
    }
    if (task.trim().length < 10) {
      toast.error('Tell your AI what to do on the call — one or two sentences is perfect.');
      return;
    }
    setPlacing(true);
    try {
      const res = await callsApi.aiTask({ to: e164, task: task.trim() });
      if (res.ok) {
        setPlacedTo(res.toNumber ?? e164);
        setTask('');
        toast.success('Your AI is calling now. The result will appear in Calls with a transcript.');
      } else {
        toast.error(res.message ?? 'Could not place the call.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not place the call.');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center shrink-0">
          <PhoneOutgoing size={18} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-indigo-500" />
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Ask your AI</p>
          </div>
          <h2 className="font-semibold text-gray-900 mt-0.5">Have your AI make a call for you</h2>
          <p className="text-sm text-gray-600 mt-1">
            Type who to call and what to say — in your own words. Your AI dials, handles the
            conversation, and the transcript shows up in{' '}
            <Link href="/calls" className="text-indigo-700 font-medium hover:underline">Calls</Link>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3 items-start">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number to call"
          className="input bg-white"
        />
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value.slice(0, 500))}
          placeholder={`What should the AI do? e.g. "${EXAMPLES[0]}"`}
          rows={2}
          className="input bg-white resize-none"
        />
        <button
          type="button"
          onClick={handleCall}
          disabled={placing}
          className="btn-primary whitespace-nowrap justify-center md:mt-0 disabled:opacity-60"
        >
          {placing ? <Loader2 size={15} className="animate-spin" /> : <PhoneOutgoing size={15} />}
          {placing ? 'Calling…' : 'Make the call'}
        </button>
      </div>

      {placedTo && (
        <p className="text-xs text-indigo-700 mt-3">
          ✓ Calling {placedTo} now — check <Link href="/calls" className="font-semibold hover:underline">Calls</Link> in a couple of minutes for the transcript.
        </p>
      )}
      <p className="text-[11px] text-gray-500 mt-3">
        One number per request · counts toward your monthly minutes · up to 5 calls per hour.
        Need to call a whole list? Use a{' '}
        <Link href="/workflows" className="text-indigo-700 font-medium hover:underline">Workflow</Link> instead.
      </p>
    </div>
  );
}
