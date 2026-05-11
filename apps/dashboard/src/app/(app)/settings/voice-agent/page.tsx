'use client';
import useSWR, { mutate } from 'swr';
import { settingsApi, tenantsApi } from '@/lib/api';
import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { VERTICALS } from '@/lib/verticals';
import { useToast } from '@/components/ui/toast';

// xAI Voice Agent voices (current spec: lowercase, eve is the recommended default)
const GROK_VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'];

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
      // Coerce legacy capitalized voice names to lowercase (xAI now requires lowercase)
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
        // Persist vertical if it changed; updateVertical is idempotent.
        tenant?.vertical !== vertical ? tenantsApi.updateVertical(vertical) : Promise.resolve(),
      ]);
      // Mirror to localStorage so the rest of the app picks it up immediately.
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
        <p className="text-gray-500 mt-1">Configure your AI receptionist's voice and behavior</p>
      </div>

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
            Industry tunes the AI receptionist&apos;s vocabulary, escalation triggers, and example workflows. Changing this updates terminology across your dashboard.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Voice Provider</label>
          <select
            value={voiceProvider}
            onChange={(e) => setVoiceProvider(e.target.value)}
            className="input"
          >
            <option value="grok">Grok Voice (xAI) — $0.05/min — Recommended</option>
            <option value="elevenlabs">ElevenLabs</option>
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
    </div>
  );
}
