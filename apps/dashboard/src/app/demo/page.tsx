// ============================================================
// /demo — Public marketing demo page. Cream theme to match
// /inbound and /outbound. Shows pre-recorded video demos of the
// AI handling calls across all 6 verticals + a DashboardTeaser
// so visitors see exactly what they'll get inside.
//
// Note: the previous version of this page streamed live audio
// to xAI's Realtime WS. We swapped to video per product
// decision — video plays instantly, doesn't burn xAI minutes
// per page-view, and converts better than a live-but-finicky
// browser-mic flow.
// ============================================================
'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Phone, Sparkles, ShieldCheck } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { VERTICALS, type Vertical } from '@/lib/verticals';
import { DemoVideoPlayer } from '@/components/ui/demo-video-player';

// Lazy-load — heavy mockup of the dashboard UI shouldn't block paint.
const DashboardTeaser = dynamic(
  () => import('@/components/ui/dashboard-teaser').then((m) => m.DashboardTeaser),
  { ssr: false }
);

// Vertical pills order — keep "all" first for default-shown state.
const VERTICAL_FILTERS: { key: 'all' | Vertical; label: string; emoji: string }[] = [
  { key: 'all', label: 'All scenarios', emoji: '🎬' },
  { key: 'dental', label: 'Dental', emoji: '🦷' },
  { key: 'insurance', label: 'Insurance', emoji: '📋' },
  { key: 'legal', label: 'Legal', emoji: '⚖️' },
  { key: 'real_estate', label: 'Real Estate', emoji: '🏠' },
  { key: 'home_services', label: 'Home Services', emoji: '🏘️' },
  { key: 'generic', label: 'Other', emoji: '🎯' },
];

export default function DemoPage() {
  const [filter, setFilter] = useState<'all' | Vertical>('all');
  const verticalFilter = filter === 'all' ? undefined : filter;

  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      {/* ── Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-nav border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-serif text-lg shadow-sm">
              ar
            </div>
            <span className="font-serif text-lg text-cream-900">{BRAND_NAME}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <Link href="/inbound" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Inbound</Link>
            <Link href="/outbound" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Outbound</Link>
            <Link href="/pricing" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Pricing</Link>
            <Link href="/demo" className="text-sm font-medium text-brand-600">Demo</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="glow-btn inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              Start free trial →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mesh-gradient-light pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            See it before you sign up
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight leading-[1.05]">
            Watch the AI handle
            <br />
            <span className="gradient-text">real calls, one ring at a time.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Pre-recorded scenarios from real customers. Pick your industry, hear the voice quality,
            and see the natural conversation flow. No sign-up required.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              <Phone size={15} /> Start free trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-800 bg-white border border-cream-200 rounded-xl hover:bg-cream-50 transition-colors"
            >
              See pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Vertical filter pills ──────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-6 pt-10">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {VERTICAL_FILTERS.map((v) => {
            const active = filter === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setFilter(v.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white border border-cream-200 text-cream-700 hover:bg-cream-100'
                }`}
              >
                <span>{v.emoji}</span> {v.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Video grid ────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <DemoVideoPlayer vertical={verticalFilter} max={4} />
        <p className="text-center text-xs text-cream-500 mt-6">
          Every video uses the same Aria voice (xAI Grok TTS) — the exact same agent your customers hear.
        </p>
      </section>

      {/* ── Dashboard preview ─────────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Behind the scenes</p>
            <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
              Every call lands in one dashboard.
            </h2>
            <p className="text-cream-600 mt-3 max-w-xl mx-auto">
              Recordings, transcripts, structured data. Searchable, exportable, webhook-pushable to your CRM.
            </p>
          </div>
          <DashboardTeaser />
        </div>
      </section>

      {/* ── What's different about ours ───────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-cream-100 border border-cream-200 text-cream-700 text-xs font-semibold px-4 py-2 rounded-full mb-5">
            <ShieldCheck size={13} className="text-brand-600" />
            Built like a real receptionist
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
            Why the voice quality matters.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              title: 'xAI Grok latest voice model',
              desc: 'Natural cadence, conversational pauses, handles interruption. Callers hang up surprised — not annoyed.',
            },
            {
              title: 'English + Spanish in one call',
              desc: 'Detects caller language automatically and switches mid-conversation. No extra charge.',
            },
            {
              title: 'Books straight to your calendar',
              desc: 'Reads real-time Google or Outlook availability. No "we\'ll call to confirm" handoff.',
            },
            {
              title: 'Recording + transcript every call',
              desc: 'Searchable from the dashboard. Webhooks fire on every booking, escalation, or missed call.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-white border border-cream-200 p-6">
              <h3 className="font-semibold text-cream-900">{f.title}</h3>
              <p className="text-sm text-cream-600 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="bg-cream-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight">
            Ready to put your AI receptionist on the line?
          </h2>
          <p className="text-cream-300 mt-4 max-w-xl mx-auto">
            14-day free trial. No credit card. Set up takes under 10 minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              <Phone size={15} /> Start free trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-100 border border-white/20 rounded-xl hover:bg-white/5 transition-colors"
            >
              Compare plans →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-cream-200 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-cream-500">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">ar</div>
            <span className="font-serif text-cream-700">{BRAND_NAME}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-cream-900 transition-colors">Home</Link>
            <Link href="/inbound" className="hover:text-cream-900 transition-colors">Inbound</Link>
            <Link href="/outbound" className="hover:text-cream-900 transition-colors">Outbound</Link>
            <Link href="/pricing" className="hover:text-cream-900 transition-colors">Pricing</Link>
            <a href="mailto:hello@aireceptionist.ai" className="hover:text-cream-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
