'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { settingsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { MessageSquare, PhoneCall } from 'lucide-react';

export type InboundRoutingMode = 'ai_always' | 'after_hours_ai' | 'overflow_ai' | 'staff_first';

const HEADLINE: Array<{ id: InboundRoutingMode; title: string; body: string }> = [
  {
    id: 'staff_first',
    title: 'Your team first, then Telfin',
    body: 'During your hours we ring your team. If nobody picks up, or it is after hours, Telfin answers.',
  },
  {
    id: 'ai_always',
    title: 'Telfin answers everything',
    body: 'Every call on your public number goes to Telfin. Your team can still join or take over a live call.',
  },
];

const MORE: Array<{ id: InboundRoutingMode; title: string; body: string }> = [
  {
    id: 'after_hours_ai',
    title: 'Team during hours only',
    body: 'While you are open we send the call to your team line. After hours Telfin answers. No overflow if they miss it.',
  },
  {
    id: 'overflow_ai',
    title: 'Try the team first, any time',
    body: 'We ring your team even after hours. Telfin steps in if nobody picks up.',
  },
];

export function InboundRoutingCard({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const { data } = useSWR('settings', () => settingsApi.get());
  const settings = (data as { settings?: Record<string, unknown> } | undefined)?.settings;
  const current = (settings?.inboundRoutingMode as InboundRoutingMode | undefined) ?? 'ai_always';
  const transferNumber = String(settings?.transferNumber ?? '').trim();
  const prefs = (settings?.notificationPreferences as Record<string, boolean> | undefined) ?? {};
  const textBackOn = prefs.missedCallTextBack !== false;
  const [saving, setSaving] = useState<InboundRoutingMode | null>(null);
  const [savingTextBack, setSavingTextBack] = useState(false);
  const [showMore, setShowMore] = useState(
    current === 'after_hours_ai' || current === 'overflow_ai',
  );

  async function select(mode: InboundRoutingMode) {
    if (mode === current) return;
    setSaving(mode);
    try {
      await settingsApi.update({ inboundRoutingMode: mode });
      await mutate('settings');
      await mutate('setup-status');
      toast.success('Call answering saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save who answers');
    } finally {
      setSaving(null);
    }
  }

  const needsStaff = current !== 'ai_always';
  const options = showMore ? [...HEADLINE, ...MORE] : HEADLINE;

  return (
    <div className={compact ? 'space-y-3' : 'card p-5 space-y-4'}>
      {!compact && (
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
            <PhoneCall size={16} className="text-brand-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Who answers first?</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Uses your office hours and team phone number. You can change this any time.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {options.map((m) => {
          const selected = current === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => select(m.id)}
              disabled={saving !== null}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors disabled:opacity-60 ${
                selected
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-gray-200 bg-white hover:border-brand-200'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">
                {m.title}
                {saving === m.id ? ' · Saving…' : ''}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.body}</p>
            </button>
          );
        })}
      </div>

      {!showMore && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          More ways to answer
        </button>
      )}

      {needsStaff && !transferNumber && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Add your team phone number below — without it Telfin answers so callers are never dropped.
        </p>
      )}

      <div className="flex items-start justify-between gap-4 pt-3 border-t border-gray-100">
        <div className="flex items-start gap-2.5 min-w-0">
          <MessageSquare size={15} className="text-brand-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">Text callers back when you miss a call</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Sends a short text from your public number if nobody answers, they hang up, or they
              reach Telfin after hours and don&apos;t get through. Callers can reply STOP to opt out.
              Paid plans only — some carriers may still reject a message.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={textBackOn}
          aria-label={`Text callers back when you miss a call — ${textBackOn ? 'enabled' : 'disabled'}`}
          disabled={savingTextBack}
          onClick={async () => {
            setSavingTextBack(true);
            try {
              await settingsApi.update({
                notificationPreferences: { missedCallTextBack: !textBackOn },
              });
              await mutate('settings');
              toast.success(!textBackOn ? 'Missed-call texts on' : 'Missed-call texts off');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Could not save text-back');
            } finally {
              setSavingTextBack(false);
            }
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            textBackOn ? 'bg-brand-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
              textBackOn ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
