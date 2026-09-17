'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingApi, settingsApi, tenantsApi } from '@/lib/api';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { InboundRoutingCard } from '@/components/settings/inbound-routing-card';

const DEFAULT_HOURS = {
  mon: { open: '08:00', close: '17:00' },
  tue: { open: '08:00', close: '17:00' },
  wed: { open: '08:00', close: '17:00' },
  thu: { open: '08:00', close: '17:00' },
  fri: { open: '08:00', close: '16:00' },
};

export default function Step4RulesPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [afterHoursMode, setAfterHoursMode] = useState('voicemail');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.update({
        afterHoursMode,
        transferNumber,
      });
      if (businessName.trim()) {
        await tenantsApi.update({ name: businessName.trim() });
      }
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
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 5 of 6 — Hours and who answers</h2>
        <p className="text-sm text-gray-500">
          Tell Telfin when your team is in, and whether people or Telfin should pick up first.
        </p>
      </div>

      <InboundRoutingCard />

      <div className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="My Business"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            After hours — what Telfin says
          </label>
          <select
            value={afterHoursMode}
            onChange={(e) => setAfterHoursMode(e.target.value)}
            className="input"
          >
            <option value="voicemail">Take a message</option>
            <option value="transfer">Try to reach someone on the team</option>
            <option value="callback_promise">Promise a callback</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Team phone number
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
