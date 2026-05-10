'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VERTICALS } from '@/lib/verticals';
import { tenantsApi } from '@/lib/api';

export default function Step0IndustryPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setSaving(true);
    try {
      localStorage.setItem('onboarding_vertical', selected);
    } catch { /* ignore */ }

    // Persist to backend so the voice agent + dashboard pick it up.
    // localStorage is the fallback if the API call fails (e.g. offline / dev mode).
    try {
      await tenantsApi.updateVertical(selected);
    } catch (err) {
      console.warn('Failed to persist vertical to backend; localStorage will be used as fallback', err);
    }

    router.push('/onboarding/plan');
  }

  return (
    <div className="space-y-6">
      <div className="text-center pb-2">
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">What kind of business are you?</h1>
        <p className="text-cream-600 mt-2 text-sm">
          We&apos;ll tailor your AI receptionist to your industry.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {VERTICALS.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelected(v.id)}
            className={`card p-5 text-left transition-all hover:shadow-md ${
              selected === v.id
                ? 'border-2 border-brand-500 bg-brand-50'
                : 'border-2 border-transparent hover:border-brand-200'
            }`}
          >
            <div className="text-3xl mb-3">{v.emoji}</div>
            <p className="font-semibold text-gray-900 text-sm">{v.label}</p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">{v.description}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="btn-primary px-8 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
