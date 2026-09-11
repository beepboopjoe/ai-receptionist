'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { onboardingApi, callsApi, phoneNumbersApi } from '@/lib/api';
import { CheckCircle, Circle, ArrowLeft, Zap, Phone, Loader2, AlertCircle } from 'lucide-react';
import { usePlan } from '@/lib/usePlan';
import { DemoUpgradeCard } from '@/components/dashboard/demo-upgrade-card';

export default function Step5ActivatePage() {
  const router = useRouter();
  const { isDemoAccount } = usePlan();
  const { data: status } = useSWR('onboarding-status', () => onboardingApi.getStatus());
  const { data: phones } = useSWR('phone-numbers', () => phoneNumbersApi.list());
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [inboundNote, setInboundNote] = useState('');
  const [placingTestCall, setPlacingTestCall] = useState(false);
  const [testCallMessage, setTestCallMessage] = useState('');

  const inboundDid =
    status?.inbound &&
    status.inbound.phoneE164?.startsWith('+') &&
    (status.inbound.provisionStatus ?? 'active') === 'active'
      ? status.inbound.phoneE164
      : (phones?.data ?? []).find(
          (n) => n.phoneE164?.startsWith('+') && (n.provisionStatus ?? 'active') === 'active'
        )?.phoneE164 ?? null;
  const inboundFailed = status?.inbound?.provisionStatus === 'failed';
  const includesDid = status?.includesInboundDid === true;
  const steps = status?.stepsCompleted ?? {};

  const checklist = [
    {
      label: inboundDid
        ? 'Phone line provisioned'
        : includesDid
          ? inboundFailed
            ? 'Phone line — last order failed (we will retry on Go Live)'
            : 'Phone line — we assign an included DID on Go Live'
          : 'Phone line — subscribe or buy a number for inbound calls',
      done: Boolean(inboundDid),
    },
    { label: 'Calendar connected (or skipped)', done: Boolean(steps.step2_calendar) },
    { label: 'Contact list imported (or skipped)', done: Boolean(steps.step3_contacts) },
    { label: 'Office rules configured', done: Boolean(steps.step4_rules) },
  ];

  async function handleActivate() {
    setActivating(true);
    setError('');
    setInboundNote('');
    try {
      const result = await onboardingApi.activate();
      await mutate('onboarding-status');
      await mutate('phone-numbers');
      const inbound = result.inbound;
      if (inbound?.status === 'active' && inbound.number?.phoneE164?.startsWith('+')) {
        router.replace('/dashboard');
        return;
      }
      if (inbound?.status === 'failed') {
        setInboundNote(
          inbound.reason
            ? `You're live, but the inbound number failed: ${inbound.reason}. Retry in Settings → Phone numbers.`
            : "You're live, but we could not assign an inbound number. Retry in Settings → Phone numbers."
        );
        setActivating(false);
        return;
      }
      if (inbound?.status === 'skipped') {
        setInboundNote(
          'Account is live. Dedicated inbound numbers are included on paid plans — subscribe or buy one to receive calls.'
        );
        setActivating(false);
        return;
      }
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Activation failed');
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
    } catch (err: unknown) {
      setTestCallMessage(err instanceof Error ? err.message : 'Test call failed');
    } finally {
      setPlacingTestCall(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 6 of 6 — Activate</h2>
        <p className="text-sm text-gray-500">
          Review what&apos;s done, then go live. Paid plans get an included inbound DID here if you
          don&apos;t already have one.
        </p>
      </div>

      <div className="card p-6 space-y-3">
        <h3 className="font-medium text-gray-700 mb-2">Setup Checklist</h3>
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            {item.done ? (
              <CheckCircle size={18} className="text-green-500 shrink-0" />
            ) : (
              <Circle size={18} className="text-amber-400 shrink-0" />
            )}
            <span className={`text-sm ${item.done ? 'text-gray-700' : 'text-amber-900'}`}>
              {item.label}
            </span>
          </div>
        ))}
        {inboundDid && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            Inbound number: <span className="font-semibold">{inboundDid}</span>
            {' — '}
            <Link href="/settings/phone-numbers" className="underline">
              Settings → Phone numbers
            </Link>
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}
      {inboundNote && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p>{inboundNote}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link href="/settings/phone-numbers" className="btn-primary text-sm">
                Phone numbers
              </Link>
              <Link href="/dashboard" className="btn-secondary text-sm">
                Go to dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="card p-6 bg-gradient-to-br from-amber-50 to-brand-50 border-amber-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-cream-900 mb-1">Hear your AI before going live</p>
            <p className="text-xs text-cream-700 mb-3">
              Have your own AI receptionist call you. You&apos;ll hear exactly what your callers will
              hear — same voice, same vertical, same business context. Requires a staff transfer
              number from step 4.
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

      {isDemoAccount ? (
        <DemoUpgradeCard
          title="Upgrade to activate"
          body="Receptionist activation and a dedicated inbound number unlock on a paid plan. You can keep exploring the dashboard in the meantime."
        />
      ) : (
      <div className="card p-6 bg-brand-600 text-white text-center">
        <Zap size={36} className="mx-auto mb-3 opacity-90" />
        <p className="text-xl font-bold mb-1">Ready to go live?</p>
        <p className="text-brand-200 text-sm mb-5">
          Paid go-live assigns a Telfin inbound DID when your plan includes one. Forward your
          existing business line to it. Porting is optional later — not a day-one blocker.
        </p>
        <button
          onClick={handleActivate}
          disabled={activating}
          className="w-full bg-white text-brand-700 font-semibold rounded-lg py-3 px-6 hover:bg-brand-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activating ? 'Activating…' : '🚀 Go Live!'}
        </button>
      </div>
      )}

      <button onClick={() => router.back()} className="btn-secondary">
        <ArrowLeft size={16} /> Back
      </button>
    </div>
  );
}
