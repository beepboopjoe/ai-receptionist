// ============================================================
// /demo — Public marketing demo page. Cream theme to match
// /inbound and /outbound. Four named Grok voices + live call-me.
// Industry sample-call clips are intentionally not shown here.
// ============================================================
'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Phone, Sparkles, ShieldCheck } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { VoiceLanguageDemo } from '@/components/ui/voice-language-demo';
import { BRAND_STACK_LINE } from '@/lib/brand';
import { CallMeWidget } from '@/components/ui/call-me-widget';

// Heavy interactive widget — load on demand, no SSR needed.
const DashboardTeaser = dynamic(
  () => import('@/components/ui/dashboard-teaser').then((m) => m.DashboardTeaser),
  { ssr: false }
);

export default function DemoPage() {
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
            Hear the voices. Try a live call.
          </h1>
          <p className="text-lg text-cream-700 mt-7 max-w-2xl mx-auto leading-relaxed">
            Aurora, Castor, Cosmo, and Zenith — the same Grok voices your callers hear.
            Enter your number and we&apos;ll call you. Language is detected automatically
            when you pick up. No sign-up required.
          </p>
          <p className="text-xs font-semibold text-cream-500 mt-4 tracking-wide">
            {BRAND_STACK_LINE}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              <Phone size={15} /> Try Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-cream-800 bg-white border border-cream-200 rounded-xl hover:bg-cream-50 transition-colors"
            >
              See pricing
            </Link>
          </div>
          <div className="mt-10">
            <CallMeWidget />
          </div>
        </div>
      </section>

      {/* ── Named voices ──────────────────────────────────── */}
      <section className="py-16 bg-cream-50 border-t border-cream-200">
        <VoiceLanguageDemo hideLanguageSelector />
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
              title: 'Natural Grok voices',
              desc: 'Aurora, Castor, Cosmo, and Zenith — conversational cadence, handles interruption. Callers hang up surprised — not annoyed.',
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
            10 free inbound minutes. No credit card. Set up takes under 10 minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              <Phone size={15} /> Try Free
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
