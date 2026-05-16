'use client';
// ============================================================
// ROI Section — high-converting cost comparison + calculator
// Placed between Features and Pricing on the landing page
// ============================================================
import { useState, useMemo } from 'react';

// ── Plan options for the calculator ─────────────────────────
const PLAN_OPTIONS = [
  { key: 'starter', label: 'Starter', price: 79 },
  { key: 'growth',  label: 'Growth',  price: 179 },
  { key: 'scale',   label: 'Scale',   price: 399 },
];

// ── After-hours benefits ─────────────────────────────────────
const AFTER_HOURS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: '24/7 coverage',
    desc: 'Calls answered at 2am just the same as 2pm. Nights, weekends, holidays.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Messages captured',
    desc: 'Every after-hours caller leaves a message — no more voicemails that nobody checks.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: 'Appointments booked',
    desc: 'Patients can schedule after hours and wake up to a confirmed appointment.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'Zero missed leads',
    desc: 'After-hours callers are your hottest leads. Now none of them slip through.',
  },
];

// ── Outcome cards ────────────────────────────────────────────
const OUTCOMES = [
  {
    value: '$3,500+',
    label: 'Monthly savings',
    sub: 'vs. a $20/hr receptionist',
    color: 'text-emerald-400',
    glow: 'shadow-emerald-900/40',
    bg: 'bg-emerald-950/30 border-emerald-500/20',
  },
  {
    value: '24/7',
    label: 'Call coverage',
    sub: 'nights, weekends & holidays',
    color: 'text-brand-400',
    glow: 'shadow-brand-900/40',
    bg: 'bg-brand-950/30 border-brand-500/20',
  },
  {
    value: '∞',
    label: 'Simultaneous calls',
    sub: 'never a busy signal again',
    color: 'text-violet-400',
    glow: 'shadow-violet-900/40',
    bg: 'bg-violet-950/30 border-violet-500/20',
  },
];

// ── Helper ───────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ── ROI Calculator ───────────────────────────────────────────
function RoiCalculator() {
  const [wage, setWage]       = useState(22);
  const [hours, setHours]     = useState(40);
  const [planKey, setPlanKey] = useState('starter');

  const plan = PLAN_OPTIONS.find(p => p.key === planKey) ?? PLAN_OPTIONS[0]!;

  const { employeeCost, savings, annualSavings } = useMemo(() => {
    const trueCost    = wage * 1.2;          // employer taxes + overhead
    const employeeCost = trueCost * hours * 4;
    const savings      = Math.max(0, employeeCost - plan.price);
    return { employeeCost, savings, annualSavings: savings * 12 };
  }, [wage, hours, plan.price]);

  return (
    <div className="glass-card rounded-3xl overflow-hidden border border-white/8">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-white/8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-brand-950 border border-brand-500/30 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-brand-400">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">Savings Calculator</h3>
        </div>
        <p className="text-sm text-gray-500 ml-11">See your exact numbers in seconds</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="space-y-6">
            {/* Hourly wage */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-gray-400">Receptionist hourly wage</label>
                <span className="text-lg font-black text-white">${wage}/hr</span>
              </div>
              <input
                type="range"
                min={15} max={40} step={1}
                value={wage}
                onChange={e => setWage(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c96442 ${((wage-15)/(40-15))*100}%, rgba(255,255,255,0.1) ${((wage-15)/(40-15))*100}%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-700 mt-1.5">
                <span>$15</span><span>$40</span>
              </div>
            </div>

            {/* Hours per week */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-gray-400">Hours per week</label>
                <span className="text-lg font-black text-white">{hours} hrs</span>
              </div>
              <input
                type="range"
                min={20} max={60} step={5}
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c96442 ${((hours-20)/(60-20))*100}%, rgba(255,255,255,0.1) ${((hours-20)/(60-20))*100}%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-700 mt-1.5">
                <span>20 hrs</span><span>60 hrs</span>
              </div>
            </div>

            {/* Plan selector */}
            <div>
              <label className="text-sm font-medium text-gray-400 block mb-3">AI Receptionist plan</label>
              <div className="grid grid-cols-3 gap-2">
                {PLAN_OPTIONS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPlanKey(p.key)}
                    className={`rounded-xl py-2.5 px-3 text-center transition-all duration-150 border ${
                      planKey === p.key
                        ? 'bg-brand-600/20 border-brand-500/60 text-white'
                        : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                    }`}
                  >
                    <div className="text-xs font-bold">{p.label}</div>
                    <div className={`text-sm font-black mt-0.5 ${planKey === p.key ? 'text-brand-300' : ''}`}>${p.price}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex flex-col justify-center gap-4">
            <div className="rounded-2xl border border-white/8 p-5" style={{ background: 'rgba(239,68,68,0.05)' }}>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-1">Employee monthly cost</p>
              <p className="text-3xl font-black text-red-400">{fmt(employeeCost)}</p>
              <p className="text-xs text-gray-700 mt-1">
                ${wage}/hr × 1.2 burden × {hours} hrs × 4 weeks
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 p-5" style={{ background: 'rgba(201,100,66,0.08)' }}>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-1">AI Receptionist monthly cost</p>
              <p className="text-3xl font-black text-brand-400">{fmt(plan.price)}</p>
              <p className="text-xs text-gray-700 mt-1">
                {plan.label} plan · 24/7 · unlimited after-hours
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 p-5" style={{ background: 'rgba(16,185,129,0.07)' }}>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">You save every month</p>
              <p className="text-4xl font-black text-emerald-400">{fmt(savings)}</p>
              <p className="text-xs text-emerald-700 mt-1 font-semibold">
                {fmt(annualSavings)} back in your pocket annually
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────
export function RoiSection() {
  return (
    <section id="roi" className="py-28 px-4 bg-gray-950">
      <div className="max-w-6xl mx-auto">

        {/* ── Section header ── */}
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">Return on investment</p>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
            A full-time receptionist costs<br />
            <span className="text-red-400 line-through decoration-2 opacity-70">$3,800–$4,800/mo</span>
            <span className="text-gray-600"> &nbsp;&nbsp;</span>
            <span className="gradient-text">We start at $79.</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            And the AI works nights, weekends, and holidays — without overtime, sick days, or benefits.
          </p>
        </div>

        {/* ── Cost comparison ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-16">

          {/* Traditional employee */}
          <div className="rounded-3xl border border-red-500/15 overflow-hidden"
            style={{ background: 'rgba(239,68,68,0.04)' }}>
            <div className="px-8 pt-7 pb-5 border-b border-red-500/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-500/30 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-red-400">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Traditional</p>
                  <h3 className="text-base font-bold text-white">Human Receptionist</h3>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-white">$3,840</span>
                <span className="text-gray-500 mb-1.5 text-sm">– $4,800<span className="text-gray-600">/mo</span></span>
              </div>
              <p className="text-xs text-gray-600 mt-1">After taxes, benefits & overhead (1.2× true cost)</p>
            </div>

            <ul className="px-8 py-6 space-y-4">
              {[
                { bad: true,  text: '$20–$25/hr base wage · true cost $24–$30/hr' },
                { bad: true,  text: 'Works 9am–5pm only — closed evenings & weekends' },
                { bad: true,  text: 'One call at a time — busy signals when slammed' },
                { bad: true,  text: 'Sick days, vacations, turnover risk' },
                { bad: true,  text: 'After-hours calls go to voicemail — or are missed entirely' },
                { bad: true,  text: 'Taxes, benefits, PTO, training costs on top' },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3 text-sm text-gray-500">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-red-950 border border-red-500/30 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-red-400">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          {/* AI Receptionist */}
          <div className="rounded-3xl border border-brand-500/25 overflow-hidden relative"
            style={{ background: 'linear-gradient(160deg, rgba(201,100,66,0.10) 0%, rgba(26,22,20,0.6) 100%)' }}>
            {/* Top glow line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />

            <div className="px-8 pt-7 pb-5 border-b border-brand-500/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-brand-950/60 border border-brand-500/30 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-brand-400">
                    <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-400 uppercase tracking-widest">AI-powered</p>
                  <h3 className="text-base font-bold text-white">AI Receptionist</h3>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-white">$79</span>
                <span className="text-gray-500 mb-1.5 text-sm">– $399<span className="text-gray-600">/mo</span></span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Flat monthly rate — no surprises, no overhead</p>
            </div>

            <ul className="px-8 py-6 space-y-4">
              {[
                'Flat monthly cost — no taxes, benefits, or payroll',
                'Available 24/7 — nights, weekends, holidays, automatically',
                'Handles unlimited simultaneous calls at once',
                'Never calls in sick, never quits, never has a bad day',
                'Books appointments and captures leads after hours',
                'Setup in under 10 minutes — no hiring process',
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-emerald-400">
                      <path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Outcome cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {OUTCOMES.map((o) => (
            <div key={o.label} className={`rounded-2xl border p-6 text-center ${o.bg} shadow-xl ${o.glow}`}>
              <p className={`text-5xl font-black mb-2 ${o.color}`}>{o.value}</p>
              <p className="text-white font-bold text-base mb-1">{o.label}</p>
              <p className="text-gray-600 text-sm">{o.sub}</p>
            </div>
          ))}
        </div>

        {/* ── After-hours block ── */}
        <div className="rounded-3xl border border-white/8 overflow-hidden mb-16"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-8 py-8 md:px-12 md:py-10">
            <div className="flex flex-col md:flex-row gap-10 items-start">

              {/* Left copy */}
              <div className="md:w-80 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-violet-950/60 border border-violet-500/30 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-violet-400">
                      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">After-hours coverage</p>
                </div>
                <h3 className="text-2xl font-black text-white mb-3 leading-snug">
                  Your office closes.<br />Your AI doesn&apos;t.
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Most practices lose 30–40% of potential new patients to after-hours voicemail.
                  Our AI answers every single one — and books them in.
                </p>
                <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3">
                  <p className="text-sm text-violet-300 font-semibold">
                    &ldquo;Wake up to new patients, not missed calls.&rdquo;
                  </p>
                </div>
              </div>

              {/* Right grid */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {AFTER_HOURS.map((item) => (
                  <div key={item.title} className="glass-card rounded-2xl p-5 border border-white/6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-violet-950/50 border border-violet-500/20 flex items-center justify-center text-violet-400">
                        {item.icon}
                      </div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROI Calculator ── */}
        <RoiCalculator />

        {/* ── CTA nudge ── */}
        <div className="text-center mt-12">
          <p className="text-gray-600 text-sm mb-4">
            Most practices break even in the first week.
          </p>
          <a
            href="/signup"
            className="glow-btn inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white bg-brand-600 rounded-xl shadow-lg shadow-brand-950"
          >
            Start your free trial — 14 days free
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd"/>
            </svg>
          </a>
        </div>

      </div>
    </section>
  );
}
