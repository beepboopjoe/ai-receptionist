'use client';
// ============================================================
// Webhooks settings page
//
// Customers register URLs to receive signed POST events when
// business events fire. Backend is webhook.service.ts; this
// page is the management surface — list, create (with one-time
// secret reveal), test, view deliveries, rotate, delete.
// ============================================================
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { Plus, Trash2, RotateCcw, Send, Webhook, Copy, CheckCircle2, Sparkles, Scale } from 'lucide-react';
import { webhooksApi, type WebhookEndpoint } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useFeatureFlags } from '@/lib/featureFlags';
import { useVertical } from '@/lib/useVertical';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { LockedFeature } from '@/components/ui/locked-feature';
import { LEGAL_WEBHOOK_PRESETS, type LegalWebhookPreset } from '@/lib/legal-presets';

const AVAILABLE_EVENTS = [
  'call.started',
  'call.completed',
  'call.missed',
  'appointment.booked',
  'appointment.cancelled',
  'escalation.created',
  'escalation.resolved',
  'campaign.lead_qualified',
  'campaign.lead_booked',
  'campaign.completed',
];

export default function WebhooksPage() {
  const { has } = useFeatureFlags();
  const vertical = useVertical();
  const isLegal = vertical.id === 'legal';
  const { data, isLoading } = useSWR('webhooks', () => webhooksApi.list());
  const { data: deliveriesData } = useSWR('webhook-deliveries', () => webhooksApi.deliveries(20));
  const endpoints = data?.data ?? [];
  const deliveries = deliveriesData?.data ?? [];
  const toast = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [createInitial, setCreateInitial] = useState<Partial<{ url: string; events: string; description: string }>>({});
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);

  function openCreateForm(prefill?: Partial<{ url: string; events: string; description: string }>) {
    setCreateInitial(prefill ?? {});
    setShowCreate(true);
  }

  if (!has('webhooks')) {
    return (
      <LockedFeature requiredPlan="growth" reason="outbound_locked" label="Outbound webhooks">
        <div className="space-y-6 max-w-3xl opacity-50 pointer-events-none">
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Webhooks</h1>
          <p className="text-gray-500">Send signed event notifications to your URL when calls and appointments happen.</p>
        </div>
      </LockedFeature>
    );
  }

  async function handleTest(id: string) {
    try {
      await webhooksApi.test(id);
      toast.success('Test event queued — check your endpoint within a few seconds.');
      await mutate('webhook-deliveries');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test event');
    }
  }

  async function handleRotate(id: string) {
    if (!confirm('Rotate the signing secret? The current secret will stop working immediately.')) return;
    try {
      const res = await webhooksApi.rotate(id);
      setNewSecret({ id, secret: res.secret });
      toast.success('Secret rotated. Save the new value now.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rotate secret');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook endpoint? Pending deliveries will not be retried.')) return;
    try {
      await webhooksApi.remove(id);
      await mutate('webhooks');
      toast.success('Endpoint deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete endpoint');
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Webhooks</h1>
          <p className="text-gray-500 mt-1">
            Receive signed event notifications when calls, appointments, and escalations happen.
            Each delivery is HMAC-signed with your endpoint&apos;s secret.
          </p>
        </div>
        <button onClick={() => openCreateForm()} className="btn-primary shrink-0">
          <Plus size={16} /> New endpoint
        </button>
      </div>

      {/* ═══ LEGAL PRESET PANEL — Phase 26a ═══
          Renders only when tenant vertical === 'legal'. Five one-click
          presets seed the most-common legal webhook integrations. */}
      {isLegal && !showCreate && (
        <LegalWebhookPresetPanel
          presets={LEGAL_WEBHOOK_PRESETS}
          onPick={(preset) =>
            openCreateForm({
              url: '',
              events: preset.events,
              description: preset.descriptionPrefill,
            })
          }
        />
      )}

      {newSecret && (
        <NewSecretBanner
          secret={newSecret.secret}
          onDismiss={() => setNewSecret(null)}
          toast={toast}
        />
      )}

      {showCreate && (
        <CreateEndpointForm
          initial={createInitial}
          onCreated={(secret, id) => {
            setShowCreate(false);
            setCreateInitial({});
            setNewSecret({ id, secret });
            void mutate('webhooks');
          }}
          onCancel={() => {
            setShowCreate(false);
            setCreateInitial({});
          }}
        />
      )}

      {/* Endpoint list */}
      <section className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Endpoints</h2>
        </div>
        {isLoading ? (
          <ListRowSkeleton rows={2} />
        ) : endpoints.length === 0 ? (
          <EmptyState
            icon={Webhook}
            label="No webhook endpoints yet"
            hint="Add your first endpoint above to start receiving event notifications."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {endpoints.map((e) => (
              <EndpointRow
                key={e.id}
                endpoint={e}
                onTest={() => handleTest(e.id)}
                onRotate={() => handleRotate(e.id)}
                onDelete={() => handleDelete(e.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent deliveries */}
      <section className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent deliveries</h2>
        </div>
        {deliveries.length === 0 ? (
          <EmptyState label="No deliveries yet" hint="Trigger a test event above to verify your receiver." compact />
        ) : (
          <div className="divide-y divide-gray-50">
            {deliveries.map((d) => (
              <div key={d.id} className="px-6 py-3 text-sm flex items-center gap-3">
                <span className={`badge ${
                  d.status === 'delivered' ? 'badge-green' :
                  d.status === 'dead_letter' ? 'badge-red' :
                  d.status === 'failed' ? 'badge-yellow' : 'badge-gray'
                }`}>{d.status}</span>
                <span className="font-mono text-xs text-gray-700">{d.eventType}</span>
                <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
                  {d.attempts > 1 ? `${d.attempts} attempts · ` : ''}
                  {d.httpStatus ? `HTTP ${d.httpStatus} · ` : ''}
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── New secret banner — shown right after create / rotate ─────
function NewSecretBanner({
  secret,
  onDismiss,
  toast,
}: {
  secret: string;
  onDismiss: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  function copy() {
    void navigator.clipboard.writeText(secret).then(() => toast.success('Copied to clipboard'));
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-amber-700" />
        <p className="text-sm font-semibold text-amber-900">Save this signing secret</p>
      </div>
      <p className="text-sm text-amber-800">
        It will not be shown again. Use it to verify the <code className="text-xs">x-webhook-signature</code> header on incoming requests.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white border border-amber-200 rounded-md px-3 py-2 font-mono break-all">
          {secret}
        </code>
        <button onClick={copy} className="btn-secondary text-sm" type="button">
          <Copy size={14} /> Copy
        </button>
        <button onClick={onDismiss} className="btn-secondary text-sm" type="button">
          I&apos;ve saved it
        </button>
      </div>
    </div>
  );
}

// ── Create endpoint form ───────────────────────────────────────
function CreateEndpointForm({
  initial,
  onCreated,
  onCancel,
}: {
  initial?: Partial<{ url: string; events: string; description: string }>;
  onCreated: (secret: string, id: string) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  // Seed the event chips from `initial.events` ("event1,event2") or fall back to "*".
  const [selected, setSelected] = useState<Set<string>>(() => {
    const raw = initial?.events?.trim();
    if (!raw || raw === '*') return new Set(['*']);
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  });
  const [saving, setSaving] = useState(false);

  function toggleEvent(ev: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (ev === '*') return new Set(['*']);
      next.delete('*');
      if (next.has(ev)) next.delete(ev);
      else next.add(ev);
      if (next.size === 0) next.add('*');
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url) {
      toast.error('URL is required');
      return;
    }
    setSaving(true);
    try {
      const events = Array.from(selected).join(',');
      const res = await webhooksApi.create({
        url,
        events,
        ...(description && { description }),
      });
      toast.success('Endpoint created');
      onCreated(res.secret, res.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create endpoint');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-5">
      <h2 className="font-semibold text-gray-900">Add endpoint</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-site.com/webhooks/ai-receptionist"
          className="input"
          required
        />
        <p className="text-xs text-gray-400 mt-1">
          Tip: use <a href="https://requestbin.com" target="_blank" rel="noopener noreferrer" className="underline">requestbin.com</a> for a free test endpoint.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Production CRM sync"
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
        <div className="flex flex-wrap gap-2">
          <EventChip label="All events (*)" active={selected.has('*')} onClick={() => toggleEvent('*')} />
          {AVAILABLE_EVENTS.map((ev) => (
            <EventChip
              key={ev}
              label={ev}
              active={selected.has(ev)}
              onClick={() => toggleEvent(ev)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Creating…' : 'Create endpoint'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Legal preset panel — Phase 26a ────────────────────────────
function LegalWebhookPresetPanel({
  presets,
  onPick,
}: {
  presets: readonly LegalWebhookPreset[];
  onPick: (preset: LegalWebhookPreset) => void;
}) {
  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center shrink-0">
          <Scale size={18} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-indigo-500" />
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Legal preset
            </p>
          </div>
          <h2 className="font-semibold text-gray-900">Start with a law-firm webhook</h2>
          <p className="text-sm text-gray-600 mt-1">
            Five common integrations for legal practices. Each fills the new-endpoint
            form with the right event filter and a description — you supply your own
            receiving URL.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPick(preset)}
            className="text-left rounded-xl bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-sm p-4 transition-all"
          >
            <p className="font-semibold text-sm text-gray-900 mb-1">{preset.title}</p>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              {preset.description}
            </p>
            <p className="text-[10px] font-mono text-indigo-600 mb-2 truncate">
              {preset.events}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
              <Plus size={11} /> Use this preset
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-5">
        Tip: most of these are easiest to wire via a Zapier or Make.com "Catch hook"
        as the first step, then chain into Clio / Slack / Gmail / Salesforce on the back.
      </p>
    </section>
  );
}

function EventChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-mono px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-brand-50 border-brand-300 text-brand-700'
          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

// ── Endpoint row ──────────────────────────────────────────────
function EndpointRow({
  endpoint,
  onTest,
  onRotate,
  onDelete,
}: {
  endpoint: WebhookEndpoint;
  onTest: () => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{endpoint.url}</p>
          {endpoint.isActive ? (
            <span className="badge badge-green">Active</span>
          ) : (
            <span className="badge badge-gray">Disabled</span>
          )}
          {endpoint.failureCount > 0 && (
            <span className="badge badge-yellow">{endpoint.failureCount} failures</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 font-mono truncate">
          {endpoint.events === '*' ? 'All events' : endpoint.events}
        </p>
        {endpoint.description && (
          <p className="text-xs text-gray-400 mt-0.5">{endpoint.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={onTest} className="btn-secondary text-xs py-1.5 px-2.5" title="Send test event">
          <Send size={13} /> Test
        </button>
        <button onClick={onRotate} className="btn-secondary text-xs py-1.5 px-2.5" title="Rotate secret">
          <RotateCcw size={13} />
        </button>
        <button onClick={onDelete} className="btn-secondary text-xs py-1.5 px-2.5 text-red-600 hover:text-red-700" title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
