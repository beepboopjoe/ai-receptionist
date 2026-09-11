'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { integrationsApi, onboardingApi, phoneNumbersApi } from '@/lib/api';
import { usePlan } from '@/lib/usePlan';
import { CheckCircle, ArrowRight, Info, AlertCircle } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';

function formatDid(e164: string): string {
  const m = /^\+(\d{1,3})(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

export default function Step1PhonePage() {
  const vertical = useVertical();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get('subscribed') === '1';
  const { plan } = usePlan();
  const isTrial = plan === 'trial' && !justSubscribed;

  const { data: status } = useSWR('onboarding-status', () => onboardingApi.getStatus());
  const { data: phones } = useSWR('phone-numbers', () => phoneNumbersApi.list());

  const existingDid =
    status?.inbound &&
    status.inbound.phoneE164?.startsWith('+') &&
    (status.inbound.provisionStatus ?? 'active') === 'active'
      ? status.inbound.phoneE164
      : (phones?.data ?? []).find(
          (n) => n.phoneE164?.startsWith('+') && (n.provisionStatus ?? 'active') === 'active'
        )?.phoneE164 ?? null;
  const failedInbound =
    status?.inbound?.provisionStatus === 'failed' ? status.inbound : null;
  const includesDid = status?.includesInboundDid ?? !isTrial;

  const [areaCode, setAreaCode] = useState('');
  const [provisioned, setProvisioned] = useState<{ phoneNumber: string } | null>(
    existingDid ? { phoneNumber: existingDid } : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [option, setOption] = useState<'twilio' | 'ringcentral' | null>(
    existingDid || justSubscribed ? 'twilio' : null
  );
  const [trialStepDone, setTrialStepDone] = useState(false);

  useEffect(() => {
    if (existingDid && !provisioned) {
      setProvisioned({ phoneNumber: existingDid });
      setOption('twilio');
    }
  }, [existingDid, provisioned]);

  useEffect(() => {
    if (isTrial && option === 'twilio' && !trialStepDone && !existingDid) {
      setTrialStepDone(true);
      void onboardingApi.completeStep(1);
    }
  }, [isTrial, option, trialStepDone, existingDid]);

  useEffect(() => {
    if (!justSubscribed || provisioned || existingDid || loading) return;
    setOption('twilio');
    void handleProvision();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after Stripe return
  }, [justSubscribed]);

  async function handleProvision() {
    setLoading(true);
    setError('');
    try {
      const attempts = justSubscribed ? 6 : 1;
      let lastErr: Error | null = null;
      for (let i = 0; i < attempts; i++) {
        try {
          const result = await onboardingApi.provisionNumber(areaCode || undefined);
          setProvisioned(result);
          await onboardingApi.completeStep(1);
          await mutate('onboarding-status');
          await mutate('phone-numbers');
          await mutate('billing');
          lastErr = null;
          break;
        } catch (err: unknown) {
          lastErr = err instanceof Error ? err : new Error('Provisioning failed');
          const msg = lastErr.message.toLowerCase();
          const waitingForPlan = justSubscribed && (msg.includes('subscribe') || msg.includes('plan'));
          if (!waitingForPlan) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (lastErr) setError(lastErr.message);
    } finally {
      setLoading(false);
    }
  }

  const canContinue =
    Boolean(provisioned) || (isTrial && option === 'twilio') || option === 'ringcentral';

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 1 — Set Up Your AI Phone Line</h2>
        <p className="text-sm text-gray-500">
          Choose how you want to connect your AI receptionist to your phone system.
        </p>
        {justSubscribed && (
          <p className="mt-3 text-sm text-brand-800 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            Subscription confirmed. We&apos;re assigning your included inbound number now.
          </p>
        )}
      </div>

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
            {isTrial && !provisioned ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-amber-700 shrink-0" />
                  <p className="text-sm font-semibold text-amber-950">Dedicated inbound number comes with a paid plan</p>
                </div>
                <p className="text-sm text-amber-900">
                  Free trial does not include a Telfin inbound DID — inbound calls only reach your AI
                  after you subscribe (Growth includes 2 numbers) or buy a number. You can still hear
                  the AI with a test call after you add a staff transfer number in step 4.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href="/pricing" className="btn-primary text-sm">
                    See plans
                  </Link>
                  <Link href="/settings/phone-numbers" className="btn-secondary text-sm">
                    Phone numbers
                  </Link>
                </div>
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
                {failedInbound?.provisionError && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Last order failed: {failedInbound.provisionError}. Retry below or finish later in
                    Settings → Phone numbers.
                  </p>
                )}
                {error && (
                  <p className="text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    {error}
                  </p>
                )}
                <button
                  onClick={handleProvision}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading
                    ? 'Provisioning…'
                    : failedInbound
                      ? 'Retry my number'
                      : includesDid
                        ? 'Get my included number'
                        : 'Provision My Number'}
                </button>
              </>
            ) : (
              <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-green-600" />
                  <p className="font-semibold text-green-800">Your number is ready!</p>
                </div>
                <p className="text-2xl font-bold text-green-900">{formatDid(provisioned.phoneNumber)}</p>
                <p className="text-sm text-green-700 mt-2">
                  Set your existing {vertical.businessNoun} phone to forward to this number.
                  Your carrier or VoIP provider usually has a &quot;Call Forwarding&quot; or &quot;Forward When Busy&quot; option.
                </p>
                <Link href="/settings/phone-numbers" className="text-sm text-green-800 underline mt-2 inline-block">
                  Same number in Settings → Phone numbers
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

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
              href={integrationsApi.connectUrl('ringcentral')}
              className="btn-primary inline-flex"
            >
              Connect RingCentral
            </a>
          </div>
        )}
      </div>

      {canContinue && (
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
