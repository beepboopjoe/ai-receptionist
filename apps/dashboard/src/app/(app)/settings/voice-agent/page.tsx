'use client';
import useSWR, { mutate } from 'swr';
import { settingsApi, tenantsApi } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { Save, Mic, Upload, Trash2, CheckCircle, AlertCircle, Loader2, CreditCard } from 'lucide-react';
import { VERTICALS } from '@/lib/verticals';
import { useToast } from '@/components/ui/toast';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

// xAI Voice Agent voices (current spec: lowercase, eve is the recommended default)
const GROK_VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'];

// ---- Voice clone status badge ----
type CloneStatus = 'none' | 'uploading' | 'ready' | 'failed';

function StatusBadge({ status }: { status: CloneStatus }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
        <CheckCircle size={12} /> Active
      </span>
    );
  }
  if (status === 'uploading') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
        <Loader2 size={12} className="animate-spin" /> Training…
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
        <AlertCircle size={12} /> Failed
      </span>
    );
  }
  return null;
}

// ---- Voice Clone section ----
function VoiceCloneSection() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cloneName, setCloneName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Show toast based on Stripe redirect query params (safe: only runs client-side)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('addon') === 'activated') {
      toast.success('Voice Clone add-on activated! Upload your voice samples below.');
    } else if (params.get('addon') === 'cancelled') {
      toast.error('Voice clone checkout cancelled. No charge was made.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const authHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: addonData, mutate: mutateAddon } = useSWR('voice-clone-addon', async () => {
    const res = await fetch(`${API_URL}/billing/voice-clone`, { headers: authHeader() });
    if (!res.ok) return { active: false };
    return res.json();
  });

  const { data: cloneData, mutate: mutateClone } = useSWR('voice-clone-status', async () => {
    const res = await fetch(`${API_URL}/settings/voice/clone`, { headers: authHeader() });
    if (!res.ok) return { status: 'none', voiceCloneId: null, voiceCloneName: null };
    return res.json();
  });

  const addonActive: boolean = addonData?.active ?? false;
  const cloneStatus: CloneStatus = cloneData?.status ?? 'none';
  const hasClone = cloneStatus === 'ready';
  const isLocked = !addonActive;

  async function handleSubscribe() {
    setSubscribing(true);
    try {
      const res = await fetch(`${API_URL}/billing/voice-clone/checkout`, {
        method: 'POST',
        headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Could not start checkout');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setSubscribing(false);
    }
  }

  async function handleUpload() {
    if (!selectedFiles.length) {
      toast.error('Select at least one audio file first');
      return;
    }
    const form = new FormData();
    form.append('name', cloneName.trim() || 'My Custom Voice');
    for (const f of selectedFiles) form.append('files', f);

    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/settings/voice/clone`, {
        method: 'POST',
        headers: authHeader(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Upload failed');
      toast.success('Voice clone created! Your custom voice is now active.');
      setSelectedFiles([]);
      setCloneName('');
      await mutateClone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload voice samples');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove your custom voice clone? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/settings/voice/clone`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Delete failed');
      }
      toast.success('Voice clone removed');
      await mutateClone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove voice clone');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic size={16} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Custom Voice Clone</h2>
          {hasClone && <StatusBadge status={cloneStatus} />}
          {cloneStatus === 'uploading' && <StatusBadge status="uploading" />}
        </div>
        <span className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2.5 py-0.5">
          Add-on · $49/mo
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Upload 1–5 audio samples of your voice (30s–3 min each) and we&apos;ll clone it using our AI voice engine. Your cloned voice will be used for all AI-generated calls and audio messages.
      </p>

      {isLocked ? (
        // ── Stripe subscribe CTA ───────────────────────────────────────────
        <div className="rounded-xl bg-brand-50 border border-brand-200 px-5 py-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-brand-900">Add Voice Clone — $49/mo</p>
            <p className="text-xs text-brand-700 mt-0.5">
              Upload your voice once. The AI receptionist speaks in your voice on every call.
            </p>
          </div>
          <ul className="text-xs text-brand-700 space-y-1">
            {['Powered by ElevenLabs AI', 'Ready in under 60 seconds', 'Cancel anytime'].map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <CheckCircle size={11} className="text-brand-500 shrink-0" /> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            className="btn-primary w-full justify-center"
          >
            {subscribing
              ? <><Loader2 size={15} className="animate-spin" /> Redirecting to checkout…</>
              : <><CreditCard size={15} /> Add Voice Clone — $49/mo</>}
          </button>
        </div>
      ) : hasClone ? (
        // ── Active clone ───────────────────────────────────────────────────
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800">
                {cloneData?.voiceCloneName ?? 'Custom Voice'}
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                ID: <code className="font-mono">{cloneData?.voiceCloneId?.slice(0, 16)}…</code>
              </p>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Remove
            </button>
          </div>
          <p className="text-xs text-green-600">
            To replace your voice clone, remove the current one and upload new samples.
          </p>
        </div>
      ) : (
        // ── Upload form ────────────────────────────────────────────────────
        <div className="space-y-3">
          {cloneStatus === 'failed' && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertCircle size={13} /> The last upload failed. Please try again with clear audio samples.
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Voice name</label>
            <input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="e.g. Sarah — Front Desk"
              maxLength={80}
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Audio samples <span className="text-gray-400 font-normal">(1–5 files, mp3 / wav / m4a)</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-400 cursor-pointer bg-gray-50 hover:bg-brand-50 transition-colors px-4 py-6"
            >
              <Upload size={20} className="text-gray-400" />
              <p className="text-sm text-gray-600 text-center">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                  : 'Click to select audio files'}
              </p>
              <p className="text-xs text-gray-400">30 seconds – 3 minutes per sample recommended</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,audio/flac"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 5);
                setSelectedFiles(files);
              }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <ul className="text-xs text-gray-600 space-y-1">
              {selectedFiles.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-green-500 shrink-0" />
                  {f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFiles.length}
            className="btn-primary w-full justify-center"
          >
            {uploading ? (
              <><Loader2 size={15} className="animate-spin" /> Creating clone…</>
            ) : (
              <><Mic size={15} /> Create voice clone</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main page
// ============================================================
export default function VoiceAgentPage() {
  const { data } = useSWR('settings', () => settingsApi.get());
  const settings = (data as any)?.settings;
  const tenant = (data as any)?.tenant;

  const [voiceName, setVoiceName] = useState('eve');
  const [voiceProvider, setVoiceProvider] = useState('grok');
  const [afterHoursMode, setAfterHoursMode] = useState('voicemail');
  const [transferNumber, setTransferNumber] = useState('');
  const [vertical, setVertical] = useState('generic');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (settings) {
      setVoiceName((settings.voiceName ?? 'eve').toLowerCase());
      setVoiceProvider(settings.voiceProvider ?? 'grok');
      setAfterHoursMode(settings.afterHoursMode ?? 'voicemail');
      setTransferNumber(settings.transferNumber ?? '');
    }
    if (tenant?.vertical) setVertical(tenant.vertical);
  }, [settings, tenant]);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        settingsApi.update({ voiceName, voiceProvider, afterHoursMode, transferNumber }),
        tenant?.vertical !== vertical ? tenantsApi.updateVertical(vertical) : Promise.resolve(),
      ]);
      try { localStorage.setItem('onboarding_vertical', vertical); } catch { /* ignore */ }
      await mutate('settings');
      await mutate('tenant');
      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Voice Agent</h1>
        <p className="text-gray-500 mt-1">Configure your AI receptionist&apos;s voice and behavior</p>
      </div>

      {/* ── Voice & Behavior ───────────────────────────────── */}
      <div className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="input"
          >
            {VERTICALS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Industry tunes the AI receptionist&apos;s vocabulary, escalation triggers, and example workflows.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Voice Provider</label>
          <select
            value={voiceProvider}
            onChange={(e) => setVoiceProvider(e.target.value)}
            className="input"
          >
            <option value="grok">Standard AI Voice — $0.05/min — Recommended</option>
            <option value="elevenlabs">ElevenLabs — supports custom voice clone</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Voice Name</label>
          {voiceProvider === 'grok' ? (
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="input"
            >
              {GROK_VOICES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="ElevenLabs voice name or ID"
              className="input"
            />
          )}
          {voiceProvider === 'elevenlabs' && (
            <p className="text-xs text-gray-400 mt-1">
              Leave blank to use your custom voice clone (if active), or enter an ElevenLabs voice ID.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">After-Hours Mode</label>
          <select
            value={afterHoursMode}
            onChange={(e) => setAfterHoursMode(e.target.value)}
            className="input"
          >
            <option value="voicemail">Voicemail — AI takes a message</option>
            <option value="transfer">Transfer — forward to another number</option>
            <option value="callback_promise">Callback Promise — AI promises to call back</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Staff Transfer Number
          </label>
          <input
            value={transferNumber}
            onChange={(e) => setTransferNumber(e.target.value)}
            placeholder="+15550001234"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            Phone number to transfer escalations and after-hours calls to
          </p>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary">
          <Save size={16} />
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* ── Custom Voice Clone ─────────────────────────────── */}
      <VoiceCloneSection />
    </div>
  );
}
