'use client';
// ============================================================
// ROI Section — cost comparison + savings calculator.
// Themed to match the rest of the site (cream palette, serif
// headings, brand-orange accent) — sits inside /pricing between
// the comparison table block and the FAQ.
// ============================================================
import { useState, useMemo } from 'react';
import { Clock, MessageSquare, Calendar, Zap, Users, Sparkles, X, Check, DollarSign, Moon } from 'lucide-react';

// ── Plan options for the calculator ─────────────────────────
const PLAN_OPTIONS = [
  { key: 'starter', label: 'Starter', price: 79 },
  { key: 'growth',  label: 'Growth',  price: 199 },
  { key: 'scale',   label: 'Scale',   price: 399 },
];

// ── After-hours benefits ─────────────────────────────────────
const AFTER_HOURS = [
  {
    icon: <Clock size={18} className="text-brand-600" />,
    title: '24/7 coverage',
    desc: 'Calls answered at 2am just the same as 2pm. Nights, weekends, holidays.',
  },
  {
    icon: <MessageSquare size={18} className="text-brand-600" />,
    title: 'Messages captured',
    desc: 'Every after-hours caller leaves a message — no more voicemails that nobody checks.',
  },
  {
    icon: <Calendar size={18} className="text-brand-600" />,
    title: 'Appointments booked',
    desc: 'Callers can schedule after hours and wake up to a confirmed appointment.',
  },
  {
    icon: <Zap size={18} className="text-brand-600" />,
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
    accent: 'text-emerald-600',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
  },
  {
    value: '24/7',
    label: 'Call coverage',
    sub: 'nights, weekends & holidays',
    accent: 'text-brand-600',
    border: 'border-brand-100',
    bg: 'bg-brand-50',
  },
  {
    value: '∞',
    label: 'Simultaneous calls',
    sub: 'never a busy signal again',
    accent: 'text-sky-600',
    border: 'border-sky-200',
    bg: 'bg-sky-50',
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
    const trueCost     = wage * 1.2;          // employer taxes + overhead
    const employeeCost = trueCost * hours * 4;
    const savings      = Math.max(0, employeeCost - plan.price);
    return { employeeCost, savings, annualSavings: savings * 12 };
  }, [wage, hours, plan.price]);

  return (
    <div className="rounded-2xl bg-white border border-cream-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 border-b border-cream-200">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
            <DollarSign size={18} className="text-brand-600" />
          </div>
          <h3 className="font-serif text-2xl text-cream-900 tracking-tight">Savings calculator</h3>
        </div>
        <p className="text-sm text-cream-600 ml-12">See your exact numbers in seconds.</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="space-y-6">
            {/* Hourly wage */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-cream-700">Receptionist hourly wage</label>
                <span className="text-lg font-semibold text-cream-900">${wage}/hr</span>
              </div>
              <input
                type="range"
                min={15} max={40} step={1}
                value={wage}
                onChange={e => setWage(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c96442 ${((wage-15)/(40-15))*100}%, #e9e1d4 ${((wage-15)/(40-15))*100}%)`
                }}
              />
              <div className="flex justify-between text-xs text-cream-500 mt-1.5">
                <span>$15</span><span>$40</span>
              </div>
            </div>

            {/* Hours per week */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-cream-700">Hours per week</label>
                <span className="text-lg font-semibold text-cream-900">{hours} hrs</span>
              </div>
              <input
                type="range"
                min={20} max={60} step={5}
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c96442 ${((hours-20)/(60-20))*100}%, #e9e1d4 ${((hours-20)/(60-20))*100}%)`
                }}
              />
              <div className="flex justify-between text-xs text-cream-500 mt-1.5">
                <span>20 hrs</span><span>60 hrs</span>
              </div>
            </div>

            {/* Plan selector */}
            <div>
              <label className="text-sm font-medium text-cream-700 block mb-3">Telfin plan</label>
              <div className="grid grid-cols-3 gap-2">
                {PLAN_OPTIONS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPlanKey(p.key)}
                    className={`rounded-xl py-2.5 px-3 text-center transition-all duration-150 border ${
                      planKey === p.key
                        ? 'bg-brand-50 border-brand-300 text-cream-900'
                        : 'bg-white border-cream-200 text-cream-600 hover:border-cream-300 hover:text-cream-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{p.label}</div>
                    <div className={`text-sm font-semibold mt-0.5 ${planKey === p.key ? 'text-brand-600' : ''}`}>${p.price}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex flex-col justify-center gap-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-widest mb-1">Employee monthly cost</p>
              <p className="font-serif text-3xl text-red-700">{fmt(employeeCost)}</p>
              <p className="text-xs text-red-600/80 mt-1">
                ${wage}/hr × 1.2 burden × {hours} hrs × 4 weeks
              </p>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-widest mb-1">Telfin monthly cost</p>
              <p className="font-serif text-3xl text-brand-700">{fmt(plan.price)}</p>
              <p className="text-xs text-brand-700/80 mt-1">
                {plan.label} plan · 24/7 · unlimited after-hours
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-widest mb-1">You save every month</p>
              <p className="font-serif text-4xl text-emerald-700">{fmt(savings)}</p>
              <p className="text-xs text-emerald-700/80 mt-1 font-semibold">
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
    <section id="roi" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">

        {/* ── Section header ── */}
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Return on investment</p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight leading-[1.1]">
            A full-time receptionist costs
            <br />
            <span className="text-red-500 line-through decoration-2 opacity-80">$3,800–$4,800/mo</span>
            <span className="text-cream-400">{'  '}</span>
            <span className="gradient-text">We start at $79.</span>
          </h2>
          <p className="text-cream-600 text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
            And the AI works nights, weekends, and holidays — without overtime, sick days, or benefits.
          </p>
        </div>

        {/* ── Cost comparison ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-16">

          {/* Traditional employee */}
          <div className="rounded-3xl bg-white border border-cream-200 overflow-hidden">
            <div className="px-8 pt-7 pb-5 border-b border-cream-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                  <Users size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Traditional</p>
                  <h3 className="text-base font-semibold text-cream-900">Human receptionist</h3>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <span className="font-serif text-5xl text-cream-900 tracking-tight">$3,840</span>
                <span className="text-cream-500 mb-1.5 text-sm">– $4,800<span className="text-cream-400">/mo</span></span>
              </div>
              <p className="text-xs text-cream-500 mt-1">After taxes, benefits & overhead (1.2× true cost)</p>
            </div>

            <ul className="px-8 py-6 space-y-4">
              {[
                '$20–$25/hr base wage · true cost $24–$30/hr',
                'Works 9am–5pm only — closed evenings & weekends',
                'One call at a time — busy signals when slammed',
                'Sick days, vacations, turnover risk',
                'After-hours calls go to voicemail — or are missed entirely',
                'Taxes, benefits, PTO, training costs on top',
              ].map((text) => (
                <li key={text} className="flex items-start gap-3 text-sm text-cream-700">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <X size={12} className="text-red-500" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Telfin */}
          <div className="rounded-3xl bg-white border border-brand-200 overflow-hidden relative shadow-sm">
            {/* Top brand line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/70 to-transparent" />

            <div className="px-8 pt-7 pb-5 border-b border-cream-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                  <Sparkles size={18} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-600 uppercase tracking-widest">AI-powered</p>
                  <h3 className="text-base font-semibold text-cream-900">Telfin</h3>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <span className="font-serif text-5xl text-cream-900 tracking-tight">$79</span>
                <span className="text-cream-500 mb-1.5 text-sm">– $399<span className="text-cream-400">/mo</span></span>
              </div>
              <p className="text-xs text-cream-500 mt-1">Flat monthly rate — no surprises, no overhead</p>
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
                <li key={feat} className="flex items-start gap-3 text-sm text-cream-800">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-emerald-600" />
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
            <div key={o.label} className={`rounded-2xl border ${o.border} ${o.bg} p-6 text-center`}>
              <p className={`font-serif text-5xl mb-2 ${o.accent} tracking-tight`}>{o.value}</p>
              <p className="text-cream-900 font-semibold text-base mb-1">{o.label}</p>
              <p className="text-cream-600 text-sm">{o.sub}</p>
            </div>
          ))}
        </div>

        {/* ── After-hours block ── */}
        <div className="rounded-3xl border border-cream-200 bg-white overflow-hidden mb-16">
          <div className="px-8 py-8 md:px-12 md:py-10">
            <div className="flex flex-col md:flex-row gap-10 items-start">

              {/* Left copy */}
              <div className="md:w-80 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                    <Moon size={18} className="text-brand-600" />
                  </div>
                  <p className="text-xs font-bold text-brand-600 uppercase tracking-widest">After-hours coverage</p>
                </div>
                <h3 className="font-serif text-3xl text-cream-900 tracking-tight mb-3 leading-snug">
                  Your office closes.<br />Your AI doesn&apos;t.
                </h3>
                <p className="text-cream-600 text-sm leading-relaxed">
                  Most practices lose 30–40% of potential new patients to after-hours voicemail.
                  Our AI answers every single one — and books them in.
                </p>
                <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
                  <p className="text-sm text-brand-700 font-semibold">
                    &ldquo;Wake up to new patients, not missed calls.&rdquo;
                  </p>
                </div>
              </div>

              {/* Right grid */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {AFTER_HOURS.map((item) => (
                  <div key={item.title} className="rounded-2xl bg-cream-50 border border-cream-200 p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                        {item.icon}
                      </div>
                      <h4 className="text-sm font-semibold text-cream-900">{item.title}</h4>
                    </div>
                    <p className="text-xs text-cream-600 leading-relaxed">{item.desc}</p>
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
          <p className="text-cream-600 text-sm mb-4">
            Most practices break even in the first week.
          </p>
          <a
            href="#plans"
            className="glow-btn inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
          >
            Choose your plan
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd"/>
            </svg>
          </a>
        </div>

      </div>
    </section>
  );
}
