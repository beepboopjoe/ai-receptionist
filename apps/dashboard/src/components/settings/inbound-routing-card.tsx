'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { settingsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { PhoneCall } from 'lucide-react';

export type InboundRoutingMode = 'ai_always' | 'after_hours_ai' | 'overflow_ai';

const MODES: Array<{ id: InboundRoutingMode; title: string; body: string }> = [
  {
    id: 'ai_always',
    title: 'AI always answers',
    body: 'Every inbound call on your Telfin DID goes to the AI. Default for new paid accounts — simplest day-one setup.',
  },
  {
    id: 'after_hours_ai',
    title: 'Staff during hours · AI after hours',
    body: 'While you are open, we forward to your Staff Transfer Number (your business line). Outside office hours the AI answers.',
  },
  {
    id: 'overflow_ai',
    title: 'Try staff first · AI on no-answer',
    body: 'We ring your Staff Transfer Number first. If no one picks up or the line is busy, the AI takes over. Best-effort if staff does not answer.',
  },
];

export function InboundRoutingCard() {
  const toast = useToast();
  const { data } = useSWR('settings', () => settingsApi.get());
  const settings = (data as { settings?: Record<string, unknown> } | undefined)?.settings;
  const current = (settings?.inboundRoutingMode as InboundRoutingMode | undefined) ?? 'ai_always';
  const transferNumber = String(settings?.transferNumber ?? '').trim();
  const [saving, setSaving] = useState<InboundRoutingMode | null>(null);

  async function select(mode: InboundRoutingMode) {
    if (mode === current) return;
    setSaving(mode);
    try {
      await settingsApi.update({ inboundRoutingMode: mode });
      await mutate('settings');
      toast.success('Inbound routing saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save routing');
    } finally {
      setSaving(null);
    }
  }

  const needsStaff = current === 'after_hours_ai' || current === 'overflow_ai';

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
          <PhoneCall size={16} className="text-brand-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Inbound routing</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Who answers the Telfin DID. Uses your office hours and Staff Transfer Number.
            Distinct from Voice Agent after-hours script (what the AI says once it answers).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {MODES.map((m) => {
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

      {needsStaff && !transferNumber && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Add a Staff Transfer Number on Voice Agent — without it we fall back to the AI so
          callers are never dropped.
        </p>
      )}
    </div>
  );
}
