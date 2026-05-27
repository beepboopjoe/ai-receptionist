'use client';
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { integrationsApi } from '@/lib/api';

interface FilevineCredentialsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FilevineCredentialsModal({ open, onClose, onSuccess }: FilevineCredentialsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [orgId, setOrgId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await integrationsApi.connectFilevine({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), orgId: orgId.trim() });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect — verify the credentials in your Filevine account settings.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Connect Filevine</h2>
            <p className="text-sm text-gray-500 mt-1">Paste your Personal Access Token, Secret, and Org ID.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personal Access Token</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pat_xxxx..."
              className="input w-full"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="••••••••••••••"
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Org ID</label>
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="123456"
              className="input w-full"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Find these in Filevine → Settings → API → Personal Access Tokens.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Verifying…' : 'Connect Filevine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
