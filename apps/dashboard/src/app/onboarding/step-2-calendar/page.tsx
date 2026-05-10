'use client';
import { useRouter } from 'next/navigation';
import { onboardingApi } from '@/lib/api';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';

export default function Step2CalendarPage() {
  const router = useRouter();
  const vertical = useVertical();

  async function handleSkip() {
    await onboardingApi.completeStep(2);
    router.push('/onboarding/step-3-patients');
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 2 — Connect Your Calendar</h2>
        <p className="text-sm text-gray-500">
          Connect your calendar so the AI can check availability and book {vertical.appointmentNounPlural} in real time.
        </p>
      </div>

      <div className="space-y-4">
        <a
          href="/api/v1/integrations/google-calendar/connect"
          className="card p-5 flex items-center gap-4 hover:ring-1 hover:ring-gray-300 transition-all cursor-pointer"
        >
          <div className="text-3xl">📅</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Google Calendar</p>
            <p className="text-sm text-gray-500">Connect via Google OAuth</p>
          </div>
          <ArrowRight size={18} className="text-gray-400" />
        </a>

        <a
          href="/api/v1/integrations/microsoft-calendar/connect"
          className="card p-5 flex items-center gap-4 hover:ring-1 hover:ring-gray-300 transition-all cursor-pointer"
        >
          <div className="text-3xl">📆</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Microsoft 365 / Outlook</p>
            <p className="text-sm text-gray-500">Connect via Microsoft OAuth</p>
          </div>
          <ArrowRight size={18} className="text-gray-400" />
        </a>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={handleSkip} className="text-sm text-gray-400 hover:text-gray-600">
          Skip for now →
        </button>
      </div>
    </div>
  );
}
