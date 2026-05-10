'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingApi, settingsApi } from '@/lib/api';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { getSavedVertical, getVertical } from '@/lib/verticals';

const DEFAULT_HOURS = {
  mon: { open: '08:00', close: '17:00' },
  tue: { open: '08:00', close: '17:00' },
  wed: { open: '08:00', close: '17:00' },
  thu: { open: '08:00', close: '17:00' },
  fri: { open: '08:00', close: '16:00' },
};

export default function Step4RulesPage() {
  const router = useRouter();
  const vertical = getVertical(getSavedVertical());
  const [businessName, setBusinessName] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [afterHoursMode, setAfterHoursMode] = useState('voicemail');
  const [saving, setSaving] = useState(false);

  // Capitalize first letter of businessNoun
  const businessLabel = vertical.businessNoun.charAt(0).toUpperCase() + vertical.businessNoun.slice(1);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.update({
        afterHoursMode,
        transferNumber,
      });
      await settingsApi.updateOfficeHours(DEFAULT_HOURS);
      await onboardingApi.completeStep(4);
      router.push('/onboarding/step-5-activate');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 4 — Configure Office Rules</h2>
        <p className="text-sm text-gray-500">
          Set your office hours, after-hours behavior, and staff transfer number.
        </p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{businessLabel} Name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder={vertical.businessPlaceholder}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            After-Hours Mode
          </label>
          <select
            value={afterHoursMode}
            onChange={(e) => setAfterHoursMode(e.target.value)}
            className="input"
          >
            <option value="voicemail">Voicemail — AI takes a message</option>
            <option value="transfer">Transfer to staff</option>
            <option value="callback_promise">Promise a callback</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Staff Number (for escalations &amp; transfers)
          </label>
          <input
            value={transferNumber}
            onChange={(e) => setTransferNumber(e.target.value)}
            placeholder="+15550001234"
            className="input"
          />
        </div>

        <p className="text-sm text-gray-500">
          Office hours are pre-filled to Mon–Fri 8am–5pm. You can adjust them in{' '}
          <span className="text-brand-600">Settings → Office Hours</span> after activation.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
          <Save size={16} />
          {saving ? 'Saving…' : 'Save & Continue'}
          {!saving && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
}
