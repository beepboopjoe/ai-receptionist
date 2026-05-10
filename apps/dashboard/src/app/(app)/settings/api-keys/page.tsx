'use client';
// ============================================================
// Settings → API Keys
//
// Owner-only. Customers mint keys here to call /api/v1/public/*.
// Raw tokens are shown exactly once at creation — after the modal
// closes the secret is unrecoverable and they must rotate.
// ============================================================
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { Plus, Key, Trash2, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { apiKeysApi, type ApiKey } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';

export default function ApiKeysPage() {
  const toast = useToast();
  const { data, isLoading } = useSWR('api-keys', () => apiKeysApi.list());
  const keys = data?.data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<{ rawToken: string; name: string } | null>(null);

  async function handleRevoke(key: ApiKey) {
    if (!confirm(`Revoke "${key.name}"? Any integration using this key will stop working immediately.`)) return;
    try {
      await apiKeysApi.revoke(key.id);
      await mutate('api-keys');
      toast.success('API key revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke key');
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">API Keys</h1>
          <p className="text-gray-500 mt-1">
            Mint keys to access the Public API at{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/api/v1/public/*</code>.
            See the <a href="/docs" className="text-brand-600 hover:underline">interactive API docs</a> for endpoint details.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0">
          <Plus size={16} /> New key
        </button>
      </div>

      {newKey && (
        <NewKeyBanner
          rawToken={newKey.rawToken}
          name={newKey.name}
          onDismiss={() => setNewKey(null)}
        />
      )}

      {showCreate && (
        <CreateKeyForm
          onCancel={() => setShowCreate(false)}
          onCreated={(rawToken, name) => {
            setShowCreate(false);
            setNewKey({ rawToken, name });
            void mutate('api-keys');
          }}
        />
      )}

      <section className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Active keys</h2>
        </div>
        {isLoading ? (
          <ListRowSkeleton rows={2} />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Key}
            label="No API keys yet"
            hint="Create one above to start integrating against the Public API."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {keys.map((k) => (
              <KeyRow key={k.id} apiKey={k} onRevoke={() => handleRevoke(k)} />
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 space-y-2">
        <p className="font-semibold text-gray-900">Quick start</p>
        <pre className="bg-white border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`curl -H "Authorization: Bearer ark_live_…" \\
  https://<your-api-host>/api/v1/public/whoami`}
        </pre>
        <a href="/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline text-xs">
          Full API reference <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

// ── One-time secret reveal banner ─────────────────────────────
function NewKeyBanner({
  rawToken,
  name,
  onDismiss,
}: {
  rawToken: string;
  name: string;
  onDismiss: () => void;
}) {
  const toast = useToast();
  function copy() {
    void navigator.clipboard.writeText(rawToken).then(() => toast.success('Copied to clipboard'));
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-amber-700" />
        <p className="text-sm font-semibold text-amber-900">
          Save this key now — &quot;{name}&quot;
        </p>
      </div>
      <p className="text-sm text-amber-800">
        We don&apos;t store the raw value. Once you dismiss this banner you&apos;ll need to mint a new key
        if you lose it.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white border border-amber-200 rounded-md px-3 py-2 font-mono break-all">
          {rawToken}
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

// ── Create form ────────────────────────────────────────────────
function CreateKeyForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (rawToken: string, name: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const days = expiresInDays ? Number(expiresInDays) : undefined;
      const res = await apiKeysApi.create({
        name: name.trim(),
        scope,
        ...(days && days > 0 ? { expiresInDays: days } : {}),
      });
      onCreated(res.rawToken, res.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create API key');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-5">
      <h2 className="font-semibold text-gray-900">Create API key</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="e.g. Zapier integration"
          required
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-1">
          A label so you can tell keys apart later. Not exposed via the API.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
        <div className="grid grid-cols-2 gap-2">
          {(['read', 'write'] as const).map((s) => (
            <label
              key={s}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                scope === s ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={s}
                checked={scope === s}
                onChange={() => setScope(s)}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">{s}-only</p>
                <p className="text-xs text-gray-500">
                  {s === 'read'
                    ? 'GET endpoints only. Safe for analytics tools.'
                    : 'Full access — create, update, delete.'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expires in (days)</label>
        <input
          type="number"
          min={1}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          className="input"
          placeholder="Leave blank for no expiry"
        />
        <p className="text-xs text-gray-400 mt-1">
          Best practice: rotate every 90 days. You can always revoke manually too.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          <Key size={14} /> {submitting ? 'Creating…' : 'Create key'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

// ── One row ────────────────────────────────────────────────────
function KeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: () => void }) {
  const expiresSoon =
    apiKey.expiresAt &&
    new Date(apiKey.expiresAt).getTime() - Date.now() < 14 * 86_400_000;
  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{apiKey.name}</p>
          <span className={`badge ${apiKey.scope === 'write' ? 'badge-blue' : 'badge-gray'}`}>
            {apiKey.scope}
          </span>
          {expiresSoon && <span className="badge badge-yellow">Expires soon</span>}
        </div>
        <p className="text-xs text-gray-500 mt-1 font-mono">
          ark_live_{apiKey.prefix}…
          {apiKey.lastUsedAt && ` · last used ${new Date(apiKey.lastUsedAt).toLocaleString()}`}
          {apiKey.expiresAt && ` · expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`}
        </p>
      </div>
      <button
        onClick={onRevoke}
        className="btn-secondary text-xs py-1.5 px-2.5 text-red-600 hover:text-red-700 shrink-0"
        title="Revoke"
      >
        <Trash2 size={13} /> Revoke
      </button>
    </div>
  );
}
