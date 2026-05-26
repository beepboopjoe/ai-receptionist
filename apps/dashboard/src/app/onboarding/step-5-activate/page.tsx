'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingApi, callsApi } from '@/lib/api';
import { CheckCircle, ArrowLeft, Zap, Phone, Loader2 } from 'lucide-react';

const CHECKLIST = [
  'Phone line provisioned',
  'Calendar connected',
  'Contact list imported (or skipped)',
  'Office rules configured',
];

export default function Step5ActivatePage() {
  const router = useRouter();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [placingTestCall, setPlacingTestCall] = useState(false);
  const [testCallMessage, setTestCallMessage] = useState('');

  async function handleActivate() {
    setActivating(true);
    setError('');
    try {
      await onboardingApi.activate();
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Activation failed');
      setActivating(false);
    }
  }

  async function handleTestCall() {
    setPlacingTestCall(true);
    setTestCallMessage('');
    try {
      const result = await callsApi.testCall();
      if (result.ok) {
        setTestCallMessage(`Look at your phone — your AI is calling ${result.toNumber} now.`);
      } else {
        setTestCallMessage(result.message ?? 'Could not place the test call.');
      }
    } catch (err: any) {
      setTestCallMessage(err.message ?? 'Test call failed');
    } finally {
      setPlacingTestCall(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 5 — Activate</h2>
        <p className="text-sm text-gray-500">
          Everything is set up. Click "Go Live" to activate your AI receptionist.
        </p>
      </div>

      <div className="card p-6 space-y-3">
        <h3 className="font-medium text-gray-700 mb-2">Setup Checklist</h3>
        {CHECKLIST.map((item) => (
          <div key={item} className="flex items-center gap-3">
            <CheckCircle size={18} className="text-green-500 shrink-0" />
            <span className="text-sm text-gray-700">{item}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* Hear it for yourself before activation. Reduces "what's it sound like?"
          anxiety that drives some first-time customers to delay going live. */}
      <div className="card p-6 bg-gradient-to-br from-amber-50 to-brand-50 border-amber-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-cream-900 mb-1">Hear your AI before going live</p>
            <p className="text-xs text-cream-700 mb-3">
              Have your own AI receptionist call you. You&apos;ll hear exactly what your callers will
              hear — same voice, same vertical, same business context.
            </p>
            <button
              onClick={handleTestCall}
              disabled={placingTestCall}
              className="inline-flex items-center gap-2 bg-cream-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-cream-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {placingTestCall ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Placing call…
                </>
              ) : (
                <>
                  <Phone size={14} />
                  Call my AI now
                </>
              )}
            </button>
            {testCallMessage && (
              <p className="text-xs mt-3 text-cream-800 bg-white/70 border border-cream-200 rounded-md px-3 py-2">
                {testCallMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6 bg-brand-600 text-white text-center">
        <Zap size={36} className="mx-auto mb-3 opacity-90" />
        <p className="text-xl font-bold mb-1">Ready to go live?</p>
        <p className="text-brand-200 text-sm mb-5">
          Your AI receptionist will start answering calls immediately after activation.
        </p>
        <button
          onClick={handleActivate}
          disabled={activating}
          className="w-full bg-white text-brand-700 font-semibold rounded-lg py-3 px-6 hover:bg-brand-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activating ? 'Activating…' : '🚀 Go Live!'}
        </button>
      </div>

      <button onClick={() => router.back()} className="btn-secondary">
        <ArrowLeft size={16} /> Back
      </button>
    </div>
  );
}
