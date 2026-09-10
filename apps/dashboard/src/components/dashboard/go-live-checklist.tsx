'use client';
import Link from 'next/link';
import { ArrowRight, Check, Phone, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { callsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useGoLive, type GoLiveStep } from '@/lib/useGoLive';

export function GoLiveChecklist() {
  const goLive = useGoLive();
  if (goLive.loading) return null;
  if (goLive.ready) {
    return <TestCallCard />;
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-amber-50/40 p-6 space-y-5">
      <div>
        <h2 className="font-serif text-xl text-cream-900 mb-1">Let&apos;s get your front desk answering</h2>
        <p className="text-sm text-cream-700">
          {goLive.completedCount} of {goLive.steps.filter((s) => s.id !== 'test_call').length} setup
          steps done. Finish these so callers can reach your AI.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {goLive.steps.map((step, i) => (
          <ChecklistStep key={step.id} step={step} index={i + 1} />
        ))}
      </div>
      <TestCallCard embedded />
    </div>
  );
}

function ChecklistStep({ step, index }: { step: GoLiveStep; index: number }) {
  return (
    <Link
      href={step.href}
      className={`group rounded-xl border p-4 transition-all ${
        step.done
          ? 'bg-white/70 border-emerald-200'
          : 'bg-white border-cream-200 hover:border-brand-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
            step.done ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white'
          }`}
        >
          {step.done ? <Check size={14} /> : index}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-cream-900 mb-0.5">{step.title}</p>
          <p className="text-xs text-cream-600 leading-relaxed mb-2">{step.desc}</p>
          {!step.done && step.id !== 'test_call' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-1.5 transition-all">
              {step.cta} <ArrowRight size={11} />
            </span>
          )}
          {step.done && <span className="text-xs font-semibold text-emerald-700">Done</span>}
        </div>
      </div>
    </Link>
  );
}

export function TestCallCard({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const { hasTransfer, hasPhone, transferNumber } = useGoLive();
  const [placing, setPlacing] = useState(false);

  const disabledReason = !hasTransfer
    ? 'Save a Staff Transfer Number first — Join call, take-over, and your test call all ring that number.'
    : !hasPhone
      ? 'Buy or port a phone number so the call can come from your line (or a platform demo line).'
      : null;
  const canCall = hasTransfer;

  async function placeTestCall() {
    if (!canCall) {
      toast.error(disabledReason ?? 'Finish setup before placing a test call.');
      return;
    }
    setPlacing(true);
    try {
      const result = await callsApi.testCall();
      if (result.ok) {
        if (result.usedDemoFallback) {
          toast.info(
            `Calling ${result.toNumber} now from our platform line — your AI will still answer.`
          );
        } else {
          toast.success(`Calling ${result.toNumber} now — pick up to hear your AI.`);
        }
      } else {
        toast.error(result.message ?? 'Could not place the test call.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test call failed');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div
      id="test-call"
      className={
        embedded
          ? 'rounded-xl bg-white border border-cream-200 p-4'
          : 'rounded-2xl border border-brand-200 bg-white p-6'
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-cream-900">Call your AI</p>
          <p className="text-sm text-cream-600 mt-0.5">
            {canCall
              ? `We will ring ${transferNumber} so you can talk to your receptionist like a customer would.`
              : disabledReason}
          </p>
        </div>
        <button
          type="button"
          onClick={placeTestCall}
          disabled={!canCall || placing}
          title={canCall ? 'Place a test call' : disabledReason ?? 'Finish setup first'}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {placing ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
          {placing ? 'Calling…' : 'Call my AI'}
        </button>
      </div>
    </div>
  );
}
