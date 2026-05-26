// ============================================================
// LiveCallDrawer — slide-over panel that streams the live AI
// call transcript and offers a Take-Over button.
//
// State source: useLiveCalls() (derived from useActivityFeed).
// Transcript bubbles auto-scroll. Take-over calls the new
// POST /calls/:id/takeover endpoint and toasts the result.
// ============================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Phone, PhoneCall, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { callsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { LiveCall } from '@/lib/useLiveCalls';

interface LiveCallDrawerProps {
  open: boolean;
  onClose: () => void;
  call: LiveCall | null;
  /** Multiple live calls — render a tab strip when > 1. */
  allCalls: LiveCall[];
  onSelectCall: (callId: string) => void;
}

export function LiveCallDrawer({
  open,
  onClose,
  call,
  allCalls,
  onSelectCall,
}: LiveCallDrawerProps) {
  const toast = useToast();
  const [takingOver, setTakingOver] = useState(false);
  const [confirmingTakeover, setConfirmingTakeover] = useState(false);
  const [needsTransferNumber, setNeedsTransferNumber] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to newest bubble. Compares scroll height to detect new content
  // so we don't fight the user if they've scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !call) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [call?.transcript.length, call]);

  // Live duration timer
  const [duration, setDuration] = useState('');
  useEffect(() => {
    if (!call) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)
      );
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      setDuration(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call?.startedAt]);

  async function handleTakeover() {
    if (!call) return;
    setTakingOver(true);
    try {
      const result = await callsApi.takeover(call.callId);
      if (result.ok) {
        toast.success(`Ringing ${result.toNumber}…`);
        setConfirmingTakeover(false);
        // Drawer will auto-close when call_taken_over arrives over the feed
        // (useLiveCalls deletes the active-call entry on that event).
      } else if (result.error === 'no_transfer_number_configured') {
        setNeedsTransferNumber(true);
      } else {
        toast.error(result.message ?? 'Could not take over the call');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Take-over failed';
      // The API returns a 400 with a structured body when transferNumber is unset.
      // The thrown error message wraps that — sniff for it.
      if (message.toLowerCase().includes('transfer number')) {
        setNeedsTransferNumber(true);
      } else {
        toast.error(message);
      }
    } finally {
      setTakingOver(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col"
        role="dialog"
        aria-label="Live call monitor"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-brand-50 to-amber-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                <PhoneCall size={18} className="text-white" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {call?.contactName ?? call?.fromNumber ?? 'Incoming call'}
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  {call?.contactName && (
                    <span className="text-gray-400">{call.fromNumber}</span>
                  )}
                  <span className="text-red-600 font-medium tabular-nums">● LIVE {duration}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/60 transition-colors text-gray-500"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs if multiple concurrent calls */}
        {allCalls.length > 1 && (
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex gap-1 overflow-x-auto">
            {allCalls.map((c) => (
              <button
                key={c.callId}
                type="button"
                onClick={() => onSelectCall(c.callId)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  c.callId === call?.callId
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {c.contactName ?? c.fromNumber}
              </button>
            ))}
          </div>
        )}

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-cream-50"
        >
          {!call || call.transcript.length === 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-400 text-center py-2">
                Waiting for the first exchange…
              </div>
              <Skeleton width="w-3/4" height="h-12" rounded="lg" />
              <Skeleton width="w-2/3" height="h-12" rounded="lg" className="ml-auto" />
              <Skeleton width="w-4/5" height="h-12" rounded="lg" />
            </div>
          ) : (
            call.transcript.map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                className={`flex ${entry.role === 'agent' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    entry.role === 'agent'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                  }`}
                >
                  <p className="leading-relaxed">{entry.text}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      entry.role === 'agent' ? 'text-brand-200' : 'text-gray-400'
                    }`}
                  >
                    {entry.role === 'agent' ? 'AI' : 'Caller'} ·{' '}
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer — take-over */}
        <div className="px-5 py-4 border-t border-gray-200 bg-white">
          {needsTransferNumber ? (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-1">
                  Set a Take-over phone first
                </p>
                <p className="leading-snug">
                  Add a Staff Transfer Number in{' '}
                  <Link
                    href="/settings/voice-agent"
                    className="underline font-medium hover:text-amber-900"
                    onClick={onClose}
                  >
                    Voice Agent settings
                  </Link>{' '}
                  so the AI knows where to bridge the call.
                </p>
              </div>
            </div>
          ) : confirmingTakeover ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Your phone will ring and you&apos;ll be bridged to the caller. The AI will
                step aside.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingTakeover(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={takingOver}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTakeover}
                  disabled={takingOver}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {takingOver ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Ringing…
                    </>
                  ) : (
                    <>
                      <Phone size={14} />
                      Yes, take over
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingTakeover(true)}
              disabled={!call}
              className="w-full px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Phone size={15} />
              Take over this call
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
