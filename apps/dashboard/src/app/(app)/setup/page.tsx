'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { ArrowRight, Check, Phone } from 'lucide-react';
import { onboardingApi, phoneNumbersApi, settingsApi } from '@/lib/api';
import { usePlan } from '@/lib/usePlan';
import { useToast } from '@/components/ui/toast';
import { DemoUpgradeCard } from '@/components/dashboard/demo-upgrade-card';
import { WebsiteImportCard } from '@/components/setup/website-import-card';
import { InboundRoutingCard } from '@/components/settings/inbound-routing-card';
import { ForwardYourLineCard } from '@/components/settings/forward-your-line-card';
import { ShareBookingPageCard } from '@/components/settings/share-booking-page-card';

const STEPS = [
  { id: 'knowledge', label: 'Your business' },
  { id: 'number', label: 'Public number' },
  { id: 'answering', label: 'Who answers' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

function formatDid(e164: string): string {
  const m = /^\+(\d{1,3})(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

export default function SetupPage() {
  const toast = useToast();
  const { isDemoAccount, loading: planLoading } = usePlan();
  const { data: phones } = useSWR('phone-numbers', () => phoneNumbersApi.list());
  const { data: settingsPayload } = useSWR('settings', () => settingsApi.get());
  const [step, setStep] = useState<StepId>('knowledge');
  const [areaCode, setAreaCode] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [transfer, setTransfer] = useState('');
  const [savingTransfer, setSavingTransfer] = useState(false);

  const settings = (settingsPayload as { settings?: Record<string, unknown> } | undefined)?.settings;
  const savedTransfer = String(settings?.transferNumber ?? '').trim();

  useEffect(() => {
    if (savedTransfer) setTransfer((current) => current || savedTransfer);
  }, [savedTransfer]);

  const did =
    (phones?.data ?? []).find(
      (n) => n.phoneE164?.startsWith('+') && (n.provisionStatus ?? 'active') === 'active',
    )?.phoneE164 ?? null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const nextLabel = useMemo(() => {
    if (step === 'knowledge') return 'Next: your public number';
    if (step === 'number') return 'Next: who answers first';
    return 'Go to Home';
  }, [step]);

  async function provision() {
    setProvisioning(true);
    try {
      const result = await onboardingApi.provisionNumber(areaCode || undefined);
      await mutate('phone-numbers');
      await mutate('onboarding-status');
      toast.success(`Your public number is ${formatDid(result.phoneNumber)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not get a number yet');
    } finally {
      setProvisioning(false);
    }
  }

  async function saveTransfer() {
    if (!transfer.trim()) return;
    setSavingTransfer(true);
    try {
      await settingsApi.update({ transferNumber: transfer.trim() });
      await mutate('settings');
      toast.success('Team number saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the team number');
    } finally {
      setSavingTransfer(false);
    }
  }

  function advance() {
    if (step === 'knowledge') setStep('number');
    else if (step === 'number') setStep('answering');
    else window.location.assign('/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Get started</p>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight mt-1">
          Go live in a few minutes
        </h1>
        <p className="text-sm text-cream-600 mt-2">
          Teach Telfin about your business, get a public number, and choose who answers first.
          Industry presets are optional.
        </p>
      </div>

      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < stepIndex;
          return (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${
                  active
                    ? 'border-brand-300 bg-brand-50'
                    : done
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Step {i + 1}
                </p>
                <p className="text-sm font-semibold text-gray-900">{s.label}</p>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 'knowledge' && (
        <WebsiteImportCard onImported={() => setStep('number')} onSkip={() => setStep('number')} />
      )}

      {step === 'number' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
              <Phone size={16} className="text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Your public number</h2>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                This is the number callers dial — or the number you forward your existing line to.
                Same-day on a paid plan.
              </p>
            </div>
          </div>

          {did ? (
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Check size={16} className="text-green-700" />
                <p className="text-sm font-semibold text-green-900">Ready today</p>
              </div>
              <p className="text-2xl font-bold text-green-950">{formatDid(did)}</p>
            </div>
          ) : planLoading ? (
            <p className="text-sm text-gray-500">Checking your plan…</p>
          ) : isDemoAccount ? (
            <DemoUpgradeCard
              title="Upgrade to get your public number"
              body="Explore the dashboard first if you want. A live number is included on Starter, Growth, Scale, and Business."
            />
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Preferred area code <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="415"
                className="input w-32"
                maxLength={3}
              />
              <button type="button" onClick={provision} disabled={provisioning} className="btn-primary">
                {provisioning ? 'Getting your number…' : 'Get my public number'}
              </button>
            </div>
          )}

          {did && <ForwardYourLineCard did={did} />}
        </div>
      )}

      {step === 'answering' && (
        <div className="space-y-4">
          <InboundRoutingCard />
          <div className="card p-5 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Team phone number
            </label>
            <p className="text-xs text-gray-500">
              The phone your people carry. We ring it when the team should answer first, and for
              handoff during a live call.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={transfer}
                onChange={(e) => setTransfer(e.target.value)}
                placeholder="+15551234567"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={saveTransfer}
                disabled={savingTransfer || !transfer.trim()}
                className="btn-primary justify-center"
              >
                {savingTransfer ? 'Saving…' : 'Save number'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={advance} className="btn-primary">
          {nextLabel} <ArrowRight size={14} />
        </button>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
          Back to Home
        </Link>
      </div>

      <ShareBookingPageCard />
    </div>
  );
}
