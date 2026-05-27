// ============================================================
// /knowledge-base — Phase 14. Public marketing landing for the
// Knowledge Base feature. Cream theme matching the other product
// landings. Hero → how-it-works → sample doc → why it matters →
// pricing → FAQ → CTA.
// ============================================================
import Link from 'next/link';
import {
  Upload,
  Sparkles,
  CheckCircle,
  FileText,
  BookOpen,
  ArrowRight,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';

const STEPS = [
  {
    icon: Upload,
    title: 'Upload your docs',
    body: 'Drop your fee schedule, intake forms, FAQs, or any PDF/Word file. We chunk and index them in under a minute.',
  },
  {
    icon: Sparkles,
    title: 'The AI grounds every call in them',
    body: 'Before each call starts, we pull the most relevant passages from your docs and inject them into the system prompt as authoritative business context.',
  },
  {
    icon: CheckCircle,
    title: 'Callers get the right answers',
    body: 'When a patient asks about a cleaning price or a client asks if you handle auto accidents, the AI quotes your actual docs instead of falling back to "let me have someone call you back".',
  },
];

const FAQ = [
  {
    q: 'What file types are supported?',
    a: 'PDF, DOCX, TXT, and Markdown. Files up to 10 MB each.',
  },
  {
    q: 'How quickly does an uploaded doc start affecting calls?',
    a: 'Usually within 30–60 seconds. Upload → parse → chunk → embed via OpenAI — then the next call your AI handles will use the doc.',
  },
  {
    q: 'Will my documents be shared with anyone?',
    a: 'No. Documents are stored encrypted in your tenant\'s Postgres row. Embeddings are computed via OpenAI but only the chunk text is sent (not the original filename or metadata). Nothing is shared across tenants.',
  },
  {
    q: 'What if a doc has wrong or outdated info?',
    a: 'Delete it from /settings/knowledge-base — chunks are removed from AI retrieval immediately. Or upload a corrected version and delete the old one. The AI never caches outside of the current chunk set.',
  },
  {
    q: 'Can the AI hallucinate facts that aren\'t in my docs?',
    a: 'Less likely with docs uploaded, but no AI is hallucination-free. We instruct the AI to prefer your docs over its general knowledge and to escalate when uncertain. For high-stakes info (legal advice, medical diagnoses, binding price quotes), always have a human review.',
  },
  {
    q: 'How many documents can I upload?',
    a: 'Trial: 2 docs / 2 MB. Starter: 5 docs / 10 MB. Growth: 25 docs / 100 MB. Scale: unlimited (soft cap 500 docs / 2 GB).',
  },
];

const SAMPLE_DOC_PREVIEW = `# Family Dental of Pasadena — Fee Schedule

## New Patient Exam + Cleaning
- New patient comprehensive exam: $185
- Adult prophylaxis (cleaning): $145
- Bitewing X-rays (4 films): $95
- Periapical X-ray (1 film): $35
- New-patient package (exam + cleaning + X-rays): $325

## Insurance We Accept
- Delta Dental PPO
- Cigna PPO
- Aetna PPO
- MetLife PPO
- We do NOT accept HMO plans or state Medicaid.

## Scheduling Policy
- New patients should arrive 15 minutes early to complete paperwork.
- Same-day emergency slots reserved for existing patients only.
- 24-hour cancellation notice required; $50 fee for late cancels.`;

export default function KnowledgeBaseLandingPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <MarketingHeader />

      {/* ═══ HERO ═══ */}
      <section className="mesh-gradient-light pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-6">
            <BookOpen size={12} /> Knowledge Base
          </span>
          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight mb-6 leading-tight">
            Teach your AI<br />
            <span className="gradient-text">your business.</span>
          </h1>
          <p className="text-xl text-cream-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your fee schedule, intake forms, FAQs, or any PDF. The AI grounds every call in them — no more "let me have someone get back to you" for things the doc already answers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
            >
              Start free trial <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg border border-cream-300 text-cream-800 font-semibold hover:bg-white transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20 px-6 bg-white border-y border-cream-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Three steps. Two minutes.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="bg-cream-50 rounded-2xl p-6 border border-cream-200">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mb-4">
                  <step.icon size={20} className="text-white" />
                </div>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Step {i + 1}</p>
                <h3 className="font-semibold text-lg text-cream-900 mb-2">{step.title}</h3>
                <p className="text-sm text-cream-600 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SAMPLE DOC PREVIEW ═══ */}
      <section className="py-20 px-6 bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">What it looks like</p>
            <h2 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">
              Upload a doc like this…
            </h2>
            <p className="text-cream-600">
              …and the AI quotes from it on every call.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
            <div className="border-b border-cream-200 px-5 py-3 flex items-center gap-3 bg-cream-50">
              <FileText size={18} className="text-cream-500" />
              <span className="text-sm font-medium text-cream-800">family-dental-fee-schedule.pdf</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-semibold">Ready · 14 chunks</span>
            </div>
            <pre className="p-6 text-sm text-cream-800 font-mono leading-relaxed whitespace-pre-wrap">
              {SAMPLE_DOC_PREVIEW}
            </pre>
          </div>
          <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-lg p-5">
            <p className="text-sm text-indigo-900">
              <strong>Caller asks:</strong> "How much is a cleaning for a new patient?"
            </p>
            <p className="text-sm text-indigo-900 mt-2">
              <strong>AI answers:</strong> "For a new patient, we offer a package that includes the comprehensive exam, cleaning, and bitewing X-rays for $325. Would you like to schedule that?"
            </p>
            <p className="text-xs text-indigo-600 mt-3 italic">
              ✨ Pulled straight from your uploaded fee schedule. Not guessed. Not hallucinated.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ WHY IT MATTERS ═══ */}
      <section className="py-20 px-6 bg-white border-y border-cream-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Why it matters.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center px-4">
              <div className="text-5xl font-serif text-brand-600 mb-3">68%</div>
              <p className="text-cream-700 leading-relaxed text-sm">
                of callers want a price quote on their first call. Without a knowledge base, the AI can't give one and callers drop off.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="text-5xl font-serif text-brand-600 mb-3">0</div>
              <p className="text-cream-700 leading-relaxed text-sm">
                hallucinated facts when the answer is in your doc. The AI is instructed to prefer your docs over general knowledge.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="text-5xl font-serif text-brand-600 mb-3">∞</div>
              <p className="text-cream-700 leading-relaxed text-sm">
                training capacity. Upload as many docs as your plan allows. Your AI gets smarter with every one.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="py-20 px-6 bg-cream-50">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Pricing</p>
          <h2 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">
            Bundled with every plan.
          </h2>
          <p className="text-cream-600 mb-10">
            No per-document fees. Document limits scale with your plan.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { plan: 'Trial', docs: '2 docs', size: '2 MB' },
              { plan: 'Starter', docs: '5 docs', size: '10 MB' },
              { plan: 'Growth', docs: '25 docs', size: '100 MB' },
              { plan: 'Scale', docs: '500 docs', size: '2 GB' },
            ].map((tier) => (
              <div key={tier.plan} className="bg-white rounded-xl border border-cream-200 p-5">
                <p className="text-xs font-bold text-cream-500 uppercase tracking-wider mb-2">{tier.plan}</p>
                <p className="font-serif text-2xl text-cream-900">{tier.docs}</p>
                <p className="text-sm text-cream-500 mt-1">{tier.size}</p>
              </div>
            ))}
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 mt-8 text-brand-700 font-semibold hover:underline"
          >
            See full pricing <ExternalLink size={14} />
          </Link>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-20 px-6 bg-white border-y border-cream-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-4xl text-cream-900 tracking-tight text-center mb-10">
            Frequently asked
          </h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <details key={i} className="group bg-cream-50 rounded-xl border border-cream-200 p-5">
                <summary className="font-semibold text-cream-900 cursor-pointer flex items-center justify-between">
                  {item.q}
                  <span className="text-cream-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="text-sm text-cream-700 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="bg-cream-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight mb-5">
            Your AI is only as good as<br />
            <span className="gradient-text">what you teach it.</span>
          </h2>
          <p className="text-cream-400 text-lg mb-10 max-w-xl mx-auto">
            Start the trial, upload your fee schedule, place a test call. See the difference in 90 seconds.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors"
          >
            Start free trial <ArrowRight size={16} />
          </Link>
          <div className="flex items-center justify-center gap-2 mt-8 text-xs text-cream-500">
            <Shield size={12} />
            <span>Encrypted at rest · Not shared across tenants · Delete anytime</span>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
