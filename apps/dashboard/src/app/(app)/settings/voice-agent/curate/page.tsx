'use client';
// ============================================================
// /settings/voice-agent/curate — Agent Curation Wizard.
//
// Walks the user through ~8 vertical-aware questions whose answers
// get synthesized into a sectioned markdown blob and saved to
// tenant_settings.business_context (the same field the AI sees on
// every call). Re-runnable: pre-fills from any existing curation
// block in the saved context.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Save,
  Loader2,
  Eye,
} from 'lucide-react';
import { settingsApi } from '@/lib/api';
import { useVertical } from '@/lib/useVertical';
import { useToast } from '@/components/ui/toast';
import { CURATION_QUESTIONS, type CurationQuestion } from '@/lib/agent-curation-questions';
import { synthesizeContext, parseContextToAnswers } from '@/lib/agent-curation-synth';
import type { Vertical } from '@ai-receptionist/shared';

export default function CuratePage() {
  const router = useRouter();
  const toast = useToast();
  const vertical = useVertical();
  const { data } = useSWR('settings', () => settingsApi.get());
  const settings = (data as any)?.settings as { businessContext?: string | null } | undefined;
  const existingContext = settings?.businessContext ?? '';

  const questions = useMemo<CurationQuestion[]>(
    () => CURATION_QUESTIONS[vertical.id as Vertical] ?? CURATION_QUESTIONS.generic,
    [vertical.id]
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0); // 0..questions.length-1, then questions.length for preview
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Pre-fill from any existing curation block once settings load.
  useEffect(() => {
    if (!settings || hydrated) return;
    setAnswers(parseContextToAnswers(questions, existingContext));
    setHydrated(true);
  }, [settings, hydrated, questions, existingContext]);

  const totalSteps = questions.length + 1; // questions + 1 preview/save step
  const isPreviewStep = step >= questions.length;
  const currentQuestion = !isPreviewStep ? questions[step] : null;
  const progress = Math.round(((step + (isPreviewStep ? 1 : 0)) / totalSteps) * 100);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function goNext() {
    if (isPreviewStep) return;
    if (step === questions.length - 1) {
      // Entering preview — build the synthesized text
      setPreview(synthesizeContext(questions, answers, existingContext));
    }
    setStep((s) => s + 1);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.update({ businessContext: preview });
      await mutate('settings');
      toast.success("Saved — the AI will use this context on every call from now on");
      router.replace('/settings/voice-agent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/settings/voice-agent"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={14} /> Back to Voice Agent
        </Link>
        <span className="text-xs text-gray-400 tabular-nums">
          {isPreviewStep ? 'Final review' : `Question ${step + 1} of ${questions.length}`}
        </span>
      </div>

      {/* Title */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-amber-500 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-cream-900 tracking-tight">Curate your AI agent</h1>
          <p className="text-cream-600 text-sm mt-0.5">
            Answer a few questions about your {vertical.businessNoun} so the AI can sound like one of your team
            members on every call.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-1.5 bg-gradient-to-r from-brand-500 to-amber-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Body */}
      {!hydrated ? (
        <div className="card p-12 text-center">
          <Loader2 size={20} className="mx-auto animate-spin text-gray-400" />
        </div>
      ) : !isPreviewStep && currentQuestion ? (
        <QuestionStep
          question={currentQuestion}
          value={answers[currentQuestion.id] ?? ''}
          onChange={(v) => setAnswer(currentQuestion.id, v)}
        />
      ) : (
        <PreviewStep preview={preview} onChange={setPreview} questions={questions} answers={answers} />
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {isPreviewStep ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              <><Save size={14} /> Save &amp; apply</>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goNext}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 px-2"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"
            >
              {step === questions.length - 1 ? (
                <><Eye size={14} /> Preview</>
              ) : (
                <>Continue <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single-question step ─────────────────────────────────────
function QuestionStep({
  question,
  value,
  onChange,
}: {
  question: CurationQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const rows = question.rows ?? 5;
  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 leading-snug">{question.label}</h2>
        {question.hint && (
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{question.hint}</p>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 1500))}
        placeholder={question.placeholder}
        rows={rows}
        className="input font-normal text-sm"
        autoFocus
      />

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Section: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{question.sectionTitle}</code></span>
        <span className="tabular-nums">{value.length} / 1500</span>
      </div>
    </div>
  );
}

// ── Final preview step ──────────────────────────────────────
function PreviewStep({
  preview,
  onChange,
  questions,
  answers,
}: {
  preview: string;
  onChange: (v: string) => void;
  questions: CurationQuestion[];
  answers: Record<string, string>;
}) {
  const answered = questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length;
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <Check size={16} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ready to apply</h2>
          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
            You answered <strong>{answered} of {questions.length}</strong> questions. Below is the context the AI
            will see on every call. Edit anything before saving — your changes are preserved.
          </p>
        </div>
      </div>

      <textarea
        value={preview}
        onChange={(e) => onChange(e.target.value)}
        rows={18}
        className="input font-mono text-xs leading-relaxed"
        spellCheck={false}
      />

      <p className="text-xs text-gray-500 leading-relaxed">
        Saving overwrites the curation block in your <strong>Business context</strong> field. Any prose you added
        manually outside the <code className="bg-gray-100 px-1.5 py-0.5 rounded">agent-curation-v1</code> markers
        is preserved.
      </p>
    </div>
  );
}
