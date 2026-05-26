'use client';
// ============================================================
// PlanComparisonTable — feature matrix on /pricing.
// Rows grouped by section in ascending-unlock order; cells are
// either ✓, —, or specific values (minutes, numbers).
// Responsive: <md collapses to per-plan stacked cards.
// ============================================================
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { billingApi } from '@/lib/api';

type PlanCol = 'trial' | 'starter' | 'growth' | 'scale' | 'enterprise';

// Trial is the leftmost column — visitors see "free" before any paid price.
const PLAN_COLS: { key: PlanCol; name: string; price: string; popular?: boolean }[] = [
  { key: 'trial',      name: 'Free Trial', price: 'Free'    },
  { key: 'starter',    name: 'Starter',    price: '$79/mo'  },
  { key: 'growth',     name: 'Growth',     price: '$199/mo', popular: true },
  { key: 'scale',      name: 'Scale',      price: '$399/mo' },
  { key: 'enterprise', name: 'Enterprise', price: 'Custom'  },
];

type Cell = boolean | string;

// Cell tuples are now 5-wide: [trial, starter, growth, scale, enterprise].
// Trial is inbound-only — every Messaging / Outbound / Integrations /
// Operations row is `false`. See Phase 12.2 plan in the docs.
const SECTIONS: {
  title: string;
  rows: { label: string; cells: [Cell, Cell, Cell, Cell, Cell] }[];
}[] = [
  {
    title: 'Core',
    rows: [
      { label: 'AI voice minutes / month',          cells: ['10 total', '200', '750', '1,500', 'Unlimited'] },
      { label: 'English + Spanish AI receptionist', cells: [true, true, true, true, true] },
      { label: '24/7 inbound answering',            cells: [true, true, true, true, true] },
      { label: 'Call transcripts + summaries',      cells: [true, true, true, true, true] },
      { label: 'Calendar sync (Google / Outlook)',  cells: [true, true, true, true, true] },
    ],
  },
  {
    title: 'Messaging — included on every paid plan',
    rows: [
      { label: 'Missed-call text-back SMS',                cells: [false, true, true, true, true] },
      { label: 'Two-way SMS inbox',                        cells: [false, true, true, true, true] },
      { label: 'Appointment reminder SMS (24h + 2h)',      cells: [false, true, true, true, true] },
      { label: 'Reply CONFIRM / CANCEL handling',          cells: [false, true, true, true, true] },
    ],
  },
  {
    title: 'Phone numbers',
    rows: [
      { label: 'Included local phone numbers',                cells: ['BYO', 'BYO', '2', '5', 'Custom'] },
      { label: 'Bring your own number (free porting)',        cells: [true, true, true, true, true] },
      { label: 'Buy add-on local number ($5/mo each)',        cells: [false, true, true, true, true] },
      { label: 'Toll-free number add-on ($10/mo)',            cells: [false, true, true, true, true] },
    ],
  },
  {
    title: 'Outbound',
    rows: [
      { label: 'Outbound test calls',                       cells: [false, true, true, true, true] },
      { label: 'Outbound calling campaigns',                cells: [false, false, true, true, true] },
      { label: 'Voicemail drop + AMD',                      cells: [false, false, true, true, true] },
      { label: 'Advanced campaign retries',                 cells: [false, false, false, true, true] },
      { label: 'Lead Discovery (Google Maps · $0.99/lead)', cells: [false, false, true, true, true] },
    ],
  },
  {
    title: 'Integrations',
    rows: [
      { label: 'Webhooks',                     cells: [false, false, true, true, true] },
      { label: 'CRM sync (HubSpot, etc.)',     cells: [false, false, true, true, true] },
      { label: 'Public REST API access',       cells: [false, false, false, true, true] },
      { label: 'Custom integrations',          cells: [false, false, false, false, true] },
    ],
  },
  {
    title: 'Operations',
    rows: [
      { label: 'Priority support',            cells: [false, false, true, true, true] },
      { label: 'Multi-location support',      cells: [false, false, false, true, true] },
      { label: 'Advanced analytics',          cells: [false, false, false, true, true] },
      { label: 'Custom voice clone add-on',   cells: [false, false, false, true, true] },
      { label: 'HIPAA-ready / BAA',           cells: [false, false, false, false, true] },
      { label: 'White-label',                 cells: [false, false, false, false, true] },
      { label: 'Dedicated onboarding',        cells: [false, false, false, false, true] },
    ],
  },
];

function CellRender({ value, popular }: { value: Cell; popular?: boolean }) {
  if (value === true)  return <Check size={16} className={popular ? 'text-brand-600' : 'text-brand-500'} aria-label="Included" />;
  if (value === false) return <Minus size={16} className="text-cream-300" aria-label="Not included" />;
  return <span className={`text-sm font-semibold ${popular ? 'text-brand-700' : 'text-cream-900'}`}>{value}</span>;
}

export function PlanComparisonTable() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('auth_token'));
  }, []);

  async function handleCheckout(planKey: PlanCol) {
    if (planKey === 'enterprise') {
      window.location.href = 'mailto:hello@aireceptionist.ai';
      return;
    }
    setCheckingOut(planKey);
    try {
      const { url } = await billingApi.checkout(planKey, 'monthly');
      window.location.href = url;
    } catch {
      setCheckingOut(null);
    }
  }

  function ctaFor(planKey: PlanCol, label: string) {
    if (planKey === 'enterprise') {
      return (
        <a
          href="mailto:hello@aireceptionist.ai"
          className="block w-full text-center py-2.5 px-3 rounded-xl text-xs font-semibold bg-cream-900 text-white hover:bg-cream-800 transition-colors"
        >
          Contact Sales
        </a>
      );
    }
    if (planKey === 'trial') {
      // Free trial — straight to signup, no Stripe checkout regardless of auth state.
      return (
        <Link
          href="/signup?plan=trial"
          className="block w-full text-center py-2.5 px-3 rounded-xl text-xs font-semibold bg-cream-900 text-white hover:bg-cream-800 transition-colors"
        >
          Try free
        </Link>
      );
    }
    if (isLoggedIn) {
      return (
        <button
          type="button"
          onClick={() => void handleCheckout(planKey)}
          disabled={checkingOut === planKey}
          className="block w-full text-center py-2.5 px-3 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
        >
          {checkingOut === planKey ? 'Redirecting…' : `Subscribe to ${label}`}
        </button>
      );
    }
    return (
      <Link
        href={`/signup?plan=${planKey}&cycle=monthly`}
        className="block w-full text-center py-2.5 px-3 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
      >
        Subscribe to {label}
      </Link>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Desktop / tablet table ───────────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-50 border-b border-cream-200">
              <th scope="col" className="text-left px-6 py-5 font-semibold text-cream-600 uppercase tracking-wider text-xs w-[28%]">
                Feature
              </th>
              {PLAN_COLS.map((p) => (
                <th
                  scope="col"
                  key={p.key}
                  className={`px-4 py-5 text-center ${p.popular ? 'bg-brand-50 border-x border-brand-200' : ''}`}
                >
                  <p className={`font-serif text-lg ${p.popular ? 'text-brand-700' : 'text-cream-900'}`}>
                    {p.name}
                  </p>
                  <p className={`text-xs mt-0.5 ${p.popular ? 'text-brand-600 font-semibold' : 'text-cream-500'}`}>
                    {p.price}
                  </p>
                  {p.popular && (
                    <span className="inline-block mt-2 text-[10px] font-bold tracking-widest text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-2.5 py-0.5 uppercase">
                      Most Popular
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section) => (
              <Fragment key={section.title}>
                <tr className="bg-cream-50/60 border-y border-cream-200">
                  <th colSpan={6} scope="rowgroup" className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-brand-600">
                    {section.title}
                  </th>
                </tr>
                {section.rows.map((row) => (
                  <tr key={`${section.title}-${row.label}`} className="border-b border-cream-100 last:border-b-0">
                    <td className="px-6 py-3 text-cream-800">{row.label}</td>
                    {row.cells.map((cell, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3 text-center ${PLAN_COLS[i]!.popular ? 'bg-brand-50/40' : ''}`}
                      >
                        <CellRender value={cell} popular={PLAN_COLS[i]!.popular ?? false} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}

            {/* CTA row */}
            <tr className="bg-cream-50/80 border-t-2 border-cream-200">
              <td className="px-6 py-5"></td>
              {PLAN_COLS.map((p) => (
                <td key={`${p.key}-cta`} className={`px-3 py-5 ${p.popular ? 'bg-brand-50' : ''}`}>
                  {ctaFor(p.key, p.name)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Mobile stacked per-plan cards ────────────────── */}
      <div className="md:hidden space-y-5">
        {PLAN_COLS.map((p, planIdx) => (
          <div
            key={p.key}
            className={`rounded-2xl border p-5 ${p.popular ? 'border-brand-300 bg-brand-50/40' : 'border-cream-200 bg-white'}`}
          >
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="font-serif text-xl text-cream-900">{p.name}</p>
                <p className="text-xs text-cream-500 mt-0.5">{p.price}</p>
              </div>
              {p.popular && (
                <span className="text-[10px] font-bold text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-2 py-0.5 uppercase tracking-wider">
                  Popular
                </span>
              )}
            </div>
            <div className="space-y-4">
              {SECTIONS.map((section) => (
                <div key={`${p.key}-${section.title}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-2">{section.title}</p>
                  <ul className="space-y-1.5">
                    {section.rows.map((row) => (
                      <li key={`${p.key}-${section.title}-${row.label}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-cream-700">{row.label}</span>
                        <CellRender value={row.cells[planIdx]!} popular={p.popular ?? false} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-5">{ctaFor(p.key, p.name)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
