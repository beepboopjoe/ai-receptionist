// ============================================================
// /demo — Public marketing demo page. Cream theme to match
// /inbound and /outbound. Shows scripted audio samples across
// all 6 verticals in EN + ES, plus a DashboardTeaser.
// ============================================================
'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Phone, Sparkles, ShieldCheck } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { VERTICALS, type Vertical } from '@/lib/verticals';
import { SampleCallPlayer } from '@/components/ui/sample-call-player';
import { VoiceLanguageDemo } from '@/components/ui/voice-language-demo';

// Heavy interactive widget — load on demand, no SSR needed.
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
  const [sampleLang, setSampleLang] = useState<'en' | 'es'>('en');

  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mesh-gradient-light pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <Sparkles size={13} />
            See it before you sign up
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-cream-900 tracking-tight leading-[1.05]">
            Hear the AI handle
            <br />
            <span className="gradient-text">real calls, one ring at a time.</span>
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Scripted scenarios across six industries — in English and Spanish. Press play,
            hear the voice quality, and see the conversation unfold. No sign-up required.
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

      {/* ── Voices & Sample Calls (unified) ──────────────────── */}
      <section className="py-16 bg-cream-50 border-t border-cream-200">
        {/* Voice × Language demo */}
        <VoiceLanguageDemo />

        {/* Sample calls by industry */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-14">
          <div className="border-t border-cream-200 pt-12">
            <div className="text-center mb-8">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-2">
                Sample calls by industry
              </p>
              <h3 className="font-serif text-2xl md:text-3xl text-cream-900 tracking-tight">
                Hear the AI handle real scenarios.
              </h3>
              <p className="text-cream-600 mt-2 text-sm max-w-lg mx-auto">
                Real scripts. Same voice your customers hear. Press play — no account required.
              </p>
            </div>

            {/* Vertical filter pills */}
            <div className="flex items-center gap-2 flex-wrap justify-center mb-6">
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

            {/* EN / ES language toggle */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {([
                { lang: 'en', flag: '🇺🇸', label: 'English' },
                { lang: 'es', flag: '🇪🇸', label: 'Español' },
              ] as const).map(({ lang, flag, label }) => (
                <button
                  key={lang}
                  onClick={() => setSampleLang(lang)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                    sampleLang === lang
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white border border-cream-200 text-cream-700 hover:bg-cream-100'
                  }`}
                >
                  {flag} {label}
                </button>
              ))}
            </div>

            <SampleCallPlayer
              singleLang={sampleLang}
              {...(verticalFilter ? { vertical: verticalFilter } : {})}
              callType="inbound"
            />
          </div>
        </div>
      </section>

      {/* ── Interactive dashboard preview ──────────────────── */}
      <section className="bg-white border-t border-cream-200">
        <DashboardTeaser />
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

      <MarketingFooter />
    </div>
  );
}
