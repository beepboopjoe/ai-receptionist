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
import { Plus, Trash2, RotateCcw, Send, Webhook, Copy, CheckCircle2 } from 'lucide-react';
import { webhooksApi, type WebhookEndpoint } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useFeatureFlags } from '@/lib/featureFlags';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';
import { LockedFeature } from '@/components/ui/locked-feature';

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
  const { data, isLoading } = useSWR('webhooks', () => webhooksApi.list());
  const { data: deliveriesData } = useSWR('webhook-deliveries', () => webhooksApi.deliveries(20));
  const endpoints = data?.data ?? [];
  const deliveries = deliveriesData?.data ?? [];
  const toast = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);

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
        <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0">
          <Plus size={16} /> New endpoint
        </button>
      </div>

      {newSecret && (
        <NewSecretBanner
          secret={newSecret.secret}
          onDismiss={() => setNewSecret(null)}
          toast={toast}
        />
      )}

      {showCreate && (
        <CreateEndpointForm
          onCreated={(secret, id) => {
            setShowCreate(false);
            setNewSecret({ id, secret });
            void mutate('webhooks');
          }}
          onCancel={() => setShowCreate(false)}
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
  onCreated,
  onCancel,
}: {
  onCreated: (secret: string, id: string) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(['*']));
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
      const res = await webhooksApi.create({ url, events, description: description || undefined });
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
