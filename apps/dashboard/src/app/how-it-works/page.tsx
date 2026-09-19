// ============================================================
// /how-it-works — Short walkthrough. Nav destination.
// Three steps, then inbound / outbound / SMS. No script dump.
// ============================================================
import Link from 'next/link';
import { ArrowRight, Megaphone, MessageSquare, Phone } from 'lucide-react';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { BRAND_NAME } from '@/lib/brand';

const STEPS = [
  {
    n: '1',
    title: 'Connect a number',
    desc: 'Forward your line or we provision one. Works with any phone system. Upgrade to go live.',
  },
  {
    n: '2',
    title: 'AI answers every call',
    desc: 'Greets callers, books the calendar, texts when needed, and escalates to staff — 24/7.',
  },
  {
    n: '3',
    title: 'You watch the dashboard',
    desc: 'Every call logged. Transcript, recording, and what the AI did — in one place.',
  },
];

const LANES = [
  {
    href: '/inbound',
    icon: Phone,
    label: 'Inbound',
    desc: 'Picks up, books, and hands off emergencies.',
  },
  {
    href: '/outbound',
    icon: Megaphone,
    label: 'Outbound',
    desc: 'Calls your lists back on paid plans.',
  },
  {
    href: '/pricing',
    icon: MessageSquare,
    label: 'SMS',
    desc: 'Reminders and missed-call texts from your number.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <MarketingHeader />

      <section className="mesh-gradient-light pt-20 sm:pt-24 pb-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-4">
            How it works
          </p>
          <h1 className="font-serif text-[2.15rem] leading-[1.1] sm:text-5xl text-cream-900 tracking-tight">
            First ring to booked appointment.
          </h1>
          <p className="text-lg text-cream-700 mt-6 max-w-xl mx-auto leading-relaxed">
            {BRAND_NAME} is one receptionist: answer, book, follow up. Hear the voices or try it free.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-2xl bg-white border border-cream-200 p-7">
              <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-serif flex items-center justify-center mb-4 text-lg">
                {step.n}
              </div>
              <h2 className="font-semibold text-cream-900 mb-2">{step.title}</h2>
              <p className="text-sm text-cream-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {LANES.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-2xl bg-white border border-cream-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className="text-brand-600" />
                <p className="text-sm font-semibold text-cream-900">{label}</p>
              </div>
              <p className="text-sm text-cream-600 leading-relaxed">{desc}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-2 transition-all">
                More <ArrowRight size={12} />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-cream-900 text-white py-14 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-3xl tracking-tight mb-4">Try it, then go live.</h2>
          <p className="text-cream-400 mb-8">
            Free explores the dashboard. Starter $20 puts a number on the line.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-brand-600 rounded-xl"
            >
              Try Free →
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-cream-200 border border-white/20 rounded-xl hover:bg-white/5"
            >
              Hear the voices
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
