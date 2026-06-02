'use client';
import useSWR, { mutate } from 'swr';
import { settingsApi, tenantsApi, callsApi } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Save, Mic, Upload, Trash2, CheckCircle, AlertCircle, Loader2, CreditCard, Sparkles, ArrowRight, Phone, Scale } from 'lucide-react';
import { VERTICALS } from '@/lib/verticals';
import { useToast } from '@/components/ui/toast';
import { KnowledgeBaseCard } from '@/components/dashboard/knowledge-base-card';
import {
  LEGAL_PRACTICE_AREAS,
  applyPracticeAreaToContext,
  detectPracticeAreaFromContext,
  type LegalPracticeArea,
} from '@/lib/legal-presets';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

// xAI Voice Agent voices (current spec: lowercase, eve is the recommended default)
const GROK_VOICES = [
  { id: 'eve', label: 'Eve', description: 'Engaging & enthusiastic', isDefault: true },
  { id: 'ara', label: 'Ara', description: 'Balanced & conversational', isDefault: false },
  { id: 'rex', label: 'Rex', description: 'Professional & articulate', isDefault: false },
  { id: 'sal', label: 'Sal', description: 'Versatile & neutral',       isDefault: false },
  { id: 'leo', label: 'Leo', description: 'Decisive & commanding',     isDefault: false },
];

// ---- Voice preview card ----
function VoiceCard({
  voice,
  selected,
  onSelect,
}: {
  voice: typeof GROK_VOICES[0];
  selected: boolean;
  onSelect: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation(); // don't also trigger card selection
    const audio = audioRef.current;
    if (!audio || missing) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true), () => setMissing(true));
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
        selected
          ? 'border-brand-400 bg-brand-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <audio
        ref={audioRef}
        src={`/audio/voices/${voice.id}-preview.mp3`}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => setMissing(true)}
      />
      {/* Radio dot */}
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        selected ? 'border-brand-600' : 'border-gray-300'
      }`}>
        {selected && <div className="w-2 h-2 rounded-full bg-brand-600" />}
      </div>
      {/* Voice info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{voice.label}</span>
          {voice.isDefault && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-semibold">
              Default
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{voice.description}</p>
      </div>
      {/* Play preview button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={missing}
        title={missing ? 'Preview not available' : playing ? 'Pause preview' : 'Play preview'}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          missing
            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
            : playing
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-brand-100 hover:text-brand-600'
        }`}
      >
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
    </div>
  );
}

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
  const [businessContext, setBusinessContext] = useState('');
  const [vertical, setVertical] = useState('generic');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [placingTestCall, setPlacingTestCall] = useState(false);
  const toast = useToast();

  async function placeTestCall() {
    if (!transferNumber) {
      toast.error('Save a Staff Transfer Number first.');
      return;
    }
    setPlacingTestCall(true);
    try {
      const result = await callsApi.testCall();
      if (result.ok) {
        if (result.usedDemoFallback) {
          // Trial tenant w/o a provisioned number: we used the platform
          // shared line. Surface that so they know why caller ID looks unfamiliar.
          toast.info(
            `Calling ${result.toNumber} now from our platform line — your AI will still answer. Provision your own number in Settings → Phone Numbers to use yours.`
          );
        } else {
          toast.success(`Calling ${result.toNumber} now — pick up to hear your AI.`);
        }
      } else {
        toast.error(result.message ?? 'Could not place the test call.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test call failed');
    } finally {
      setPlacingTestCall(false);
    }
  }

  useEffect(() => {
    if (settings) {
      setVoiceName((settings.voiceName ?? 'eve').toLowerCase());
      setVoiceProvider(settings.voiceProvider ?? 'grok');
      setAfterHoursMode(settings.afterHoursMode ?? 'voicemail');
      setTransferNumber(settings.transferNumber ?? '');
      setBusinessContext(settings.businessContext ?? '');
    }
    if (tenant?.vertical) setVertical(tenant.vertical);
  }, [settings, tenant]);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        settingsApi.update({ voiceName, voiceProvider, afterHoursMode, transferNumber, businessContext }),
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
            <option value="grok">Standard AI Voice — Recommended</option>
            <option value="elevenlabs">ElevenLabs — supports custom voice clone</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
          {voiceProvider === 'grok' ? (
            <div className="space-y-2">
              {GROK_VOICES.map((v) => (
                <VoiceCard
                  key={v.id}
                  voice={v}
                  selected={voiceName === v.id}
                  onSelect={() => setVoiceName(v.id)}
                />
              ))}
              <p className="text-xs text-gray-400 mt-1">
                Click ▶ on any voice to hear a short preview before choosing.
              </p>
            </div>
          ) : (
            <>
              <input
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="ElevenLabs voice name or ID"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave blank to use your custom voice clone (if active), or enter an ElevenLabs voice ID.
              </p>
            </>
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
            Business context for the AI
            <span className="text-gray-400 font-normal ml-1.5">(optional)</span>
          </label>

          {/* Curation Wizard CTA — guided alternative to free-text entry */}
          <Link
            href="/settings/voice-agent/curate"
            className="block mb-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-amber-50 p-4 hover:border-brand-300 transition-colors group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-amber-500 flex items-center justify-center shrink-0">
                  <Sparkles size={15} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-900">Not sure what to write?</p>
                  <p className="text-xs text-brand-700 mt-0.5 leading-snug">
                    Answer 8 quick questions and we&apos;ll build your AI&apos;s context for you.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 group-hover:gap-1.5 transition-all shrink-0">
                Curate my agent <ArrowRight size={12} />
              </span>
            </div>
          </Link>

          {/* ── Knowledge Base promo (Phase 14) — sits next to Curate as
              the doc-upload alternative to free-text business context. */}
          <div className="mb-3">
            <KnowledgeBaseCard
              compact
              title="Got a fee schedule or intake form?"
              description="Upload the doc and the AI grounds every call in it — no need to retype everything into this textarea."
              cta="Upload docs"
            />
          </div>

          {/* ── Legal practice-area preset (Phase 26a) ───────────────
              Only renders when tenant vertical === 'legal'. Selecting an
              area appends/overwrites a context block wrapped in
              <!-- legal-practice-area-v1 --> anchors so user prose is
              preserved. */}
          {vertical === 'legal' && (
            <LegalPracticeAreaSelect
              businessContext={businessContext}
              onApply={(updatedContext) => setBusinessContext(updatedContext)}
            />
          )}

          <textarea
            value={businessContext}
            onChange={(e) => setBusinessContext(e.target.value.slice(0, 4000))}
            placeholder="Tell the AI about your business so it can answer caller questions accurately. Example: We're a family dental practice in Pasadena. We accept all major PPOs except Delta. New patients should arrive 15 minutes early. Same-day emergency slots are reserved for existing patients."
            rows={6}
            className="input font-normal"
          />
          <div className="flex items-start justify-between gap-3 mt-1">
            <p className="text-xs text-gray-400 flex-1">
              The AI uses this on every call as authoritative business info — services, pricing
              rules, scheduling policies, brand voice, anything you&apos;d train a new front-desk
              hire on.
            </p>
            <p className="text-xs text-gray-400 tabular-nums shrink-0">
              {businessContext.length} / 4000
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Staff Transfer Number
          </label>
          <div className="flex gap-2">
            <input
              value={transferNumber}
              onChange={(e) => setTransferNumber(e.target.value)}
              placeholder="+15550001234"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={placeTestCall}
              disabled={!transferNumber || placingTestCall}
              title={transferNumber ? 'Place a test call — your AI will ring your number' : 'Enter a number first'}
              className="inline-flex items-center gap-1.5 px-3 rounded-lg bg-cream-900 text-white text-xs font-semibold hover:bg-cream-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {placingTestCall ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
              Test it now
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Phone number to transfer escalations and after-hours calls to. Click <strong>Test it now</strong> to have your AI call you — best way to hear how it sounds.
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

// ── Legal practice-area select — Phase 26a ────────────────────
// Renders only on /settings/voice-agent for legal-vertical tenants.
// Selecting an area appends/overwrites a block in the Business Context
// wrapped in <!-- legal-practice-area-v1 --> anchor comments so the
// user's other custom prose is preserved across re-selections.
function LegalPracticeAreaSelect({
  businessContext,
  onApply,
}: {
  businessContext: string;
  onApply: (updatedContext: string) => void;
}) {
  const detected = detectPracticeAreaFromContext(businessContext);
  const [selectedId, setSelectedId] = useState<string>(detected ?? '');
  const [showDetails, setShowDetails] = useState(false);

  // Re-sync the dropdown when the Business Context is loaded async from settings.
  useEffect(() => {
    const next = detectPracticeAreaFromContext(businessContext);
    if (next && next !== selectedId) setSelectedId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessContext]);

  function handleSelect(id: string) {
    setSelectedId(id);
    if (!id) return;
    const preset = LEGAL_PRACTICE_AREAS.find((p) => p.id === id);
    if (!preset) return;
    const updated = applyPracticeAreaToContext(businessContext, preset);
    onApply(updated);
  }

  const selected = LEGAL_PRACTICE_AREAS.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white border border-indigo-200 flex items-center justify-center shrink-0">
          <Scale size={16} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
            Legal practice area
          </p>
          <p className="text-xs text-indigo-900/80 mb-3">
            Selecting an area appends a tuned context block (intake vocabulary, escalation
            triggers, tone). You can edit the textarea below freely — re-selecting only
            overwrites the practice-area block, not your other prose.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-indigo-200 bg-white focus:outline-none focus:border-indigo-400 max-w-xs"
            >
              <option value="">— None (clear practice-area block) —</option>
              {LEGAL_PRACTICE_AREAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {selected && (
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="text-xs font-semibold text-indigo-700 hover:underline"
              >
                {showDetails ? 'Hide details' : 'What changes when I pick this?'}
              </button>
            )}
          </div>
          {selected && showDetails && (
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <span className="font-semibold text-indigo-900">Escalation vocabulary the AI listens for:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selected.escalationVocab.map((v) => (
                    <span key={v} className="bg-white border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-semibold text-indigo-900">Initial greeting tone:</span>{' '}
                <span className="text-indigo-800">{selected.greetingTone}</span>
              </div>
              <div>
                <span className="font-semibold text-indigo-900">Block appended below:</span>
                <pre className="mt-1 bg-white border border-indigo-100 rounded-md p-2 text-[10px] text-indigo-900 whitespace-pre-wrap leading-snug max-h-32 overflow-y-auto">
                  {selected.contextBlock}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
