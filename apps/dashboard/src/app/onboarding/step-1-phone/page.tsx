'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingApi } from '@/lib/api';
import { usePlan } from '@/lib/usePlan';
import { CheckCircle, ArrowRight, Info } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';

export default function Step1PhonePage() {
  const vertical = useVertical();
  const router = useRouter();
  const { plan } = usePlan();
  const isTrial = plan === 'trial';
  // Starter is BYO by default — no auto-provision, customer forwards an
  // existing line or buys a dedicated number from Settings → Phone Numbers.
  const isStarter = plan === 'starter';

  const [areaCode, setAreaCode] = useState('');
  const [provisioned, setProvisioned] = useState<{ phoneNumber: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [option, setOption] = useState<'twilio' | 'ringcentral' | null>(null);
  const [trialStepDone, setTrialStepDone] = useState(false);
  const [starterStepDone, setStarterStepDone] = useState(false);

  // Auto-complete step 1 for trial users — they don't need to provision a number
  useEffect(() => {
    if (isTrial && option === 'twilio' && !trialStepDone) {
      setTrialStepDone(true);
      void onboardingApi.completeStep(1);
    }
  }, [isTrial, option, trialStepDone]);

  // Auto-complete step 1 for Starter once they confirm the BYO path
  useEffect(() => {
    if (isStarter && option === 'twilio' && !starterStepDone) {
      setStarterStepDone(true);
      void onboardingApi.completeStep(1);
    }
  }, [isStarter, option, starterStepDone]);

  async function handleProvision() {
    setLoading(true);
    setError('');
    try {
      const result = await onboardingApi.provisionNumber(areaCode || undefined);
      setProvisioned(result);
      await onboardingApi.completeStep(1);
    } catch (err: any) {
      setError(err.message ?? 'Provisioning failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 1 — Set Up Your AI Phone Line</h2>
        <p className="text-sm text-gray-500">
          Choose how you want to connect your AI receptionist to your phone system.
        </p>
      </div>

      {/* Option A — Forwarding number (recommended) */}
      <div
        onClick={() => setOption('twilio')}
        className={`card p-6 cursor-pointer transition-all ${
          option === 'twilio' ? 'ring-2 ring-brand-500' : 'hover:ring-1 hover:ring-gray-300'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="text-3xl">📞</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">Quick Setup — Forwarding Number</p>
              <span className="badge badge-green">Recommended</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              We provision a phone number for your {vertical.businessNoun}. You just set your existing main line to
              forward to it — no changes to your phone system. Works with any carrier.
            </p>
            <p className="text-xs text-gray-400 mt-2">✓ Done in 60 seconds · ✓ Works with any phone system</p>
          </div>
        </div>

        {option === 'twilio' && (
          <div className="mt-5 space-y-3">
            {isTrial ? (
              /* ── Trial: platform shared number — no Telnyx provisioning ── */
              <div className="rounded-xl bg-brand-50 border border-brand-200 px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-brand-600 shrink-0" />
                  <p className="text-sm font-semibold text-brand-900">Using platform shared number</p>
                </div>
                <p className="text-sm text-brand-700">
                  During your free trial, inbound calls are routed through our shared platform number.
                  When you subscribe to a paid plan, you&apos;ll get your own dedicated local number.
                </p>
                <p className="text-xs text-brand-500">✓ No setup required · ✓ Upgrade anytime for a dedicated number</p>
              </div>
            ) : isStarter ? (
              /* ── Starter: BYO number — no provisioning, forward existing line ── */
              <div className="rounded-xl bg-brand-50 border border-brand-200 px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-brand-600 shrink-0" />
                  <p className="text-sm font-semibold text-brand-900">Bring your own number</p>
                </div>
                <p className="text-sm text-brand-700">
                  Starter plans don&apos;t include a dedicated line. Forward your existing business number
                  to the AI, or port your number to us for free.
                </p>
                <ul className="text-sm text-brand-700 list-disc list-inside space-y-1">
                  <li>Set call forwarding on your current carrier to the AI line</li>
                  <li>Or port your number free in <a className="underline" href="/settings/phone-numbers">Settings → Phone Numbers</a></li>
                  <li>Need a fresh line? Add one for $5/mo any time</li>
                </ul>
                <p className="text-xs text-brand-500">✓ Works with any phone system · ✓ Add a dedicated line whenever you want</p>
              </div>
            ) : !provisioned ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred area code (optional)
                  </label>
                  <input
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="e.g. 212"
                    className="input w-40"
                    maxLength={3}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  onClick={handleProvision}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Provisioning…' : 'Provision My Number'}
                </button>
              </>
            ) : (
              <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-green-600" />
                  <p className="font-semibold text-green-800">Your number is ready!</p>
                </div>
                <p className="text-2xl font-bold text-green-900">{provisioned.phoneNumber}</p>
                <p className="text-sm text-green-700 mt-2">
                  Set your existing {vertical.businessNoun} phone to forward to this number.
                  Your carrier or VoIP provider usually has a &quot;Call Forwarding&quot; or &quot;Forward When Busy&quot; option.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Option B — RingCentral */}
      <div
        onClick={() => setOption('ringcentral')}
        className={`card p-6 cursor-pointer transition-all ${
          option === 'ringcentral' ? 'ring-2 ring-brand-500' : 'hover:ring-1 hover:ring-gray-300'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="text-3xl">🔔</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">RingCentral Integration</p>
            <p className="text-sm text-gray-500 mt-1">
              Already using RingCentral? Connect your account directly via OAuth.
            </p>
            <p className="text-xs text-gray-400 mt-2">✓ No forwarding setup needed · Requires RingCentral account</p>
          </div>
        </div>
        {option === 'ringcentral' && (
          <div className="mt-4">
            <a
              href="/api/v1/integrations/ringcentral/connect"
              className="btn-primary inline-flex"
            >
              Connect RingCentral
            </a>
          </div>
        )}
      </div>

      {/* Next — shown once user has made a valid selection */}
      {(provisioned || (isTrial && option === 'twilio') || (isStarter && option === 'twilio') || option === 'ringcentral') && (
        <button
          onClick={() => router.push('/onboarding/step-2-calendar')}
          className="btn-primary w-full justify-center"
        >
          Continue to Step 2 <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
