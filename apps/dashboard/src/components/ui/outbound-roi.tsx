'use client';
// ============================================================
// OutboundRoi — interactive ROI calculator scoped to outbound
// campaigns. Sliders for inactive list size, average visit
// value, and expected reactivation rate. Forks the pattern in
// roi-section.tsx but with outbound-specific math.
// ============================================================
import { useMemo, useState } from 'react';
import Link from 'next/link';

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function OutboundRoi() {
  const [inactive, setInactive] = useState(1000);
  const [avgVisit, setAvgVisit] = useState(480);
  const [reactivationPct, setReactivationPct] = useState(12);

  const monthlyRevenue = useMemo(() => {
    return Math.round(inactive * (reactivationPct / 100) * avgVisit);
  }, [inactive, avgVisit, reactivationPct]);

  const annualRevenue = monthlyRevenue * 12;
  const planCost = 399; // Growth plan covers outbound
  const annualNet = annualRevenue - planCost * 12;

  return (
    <section className="relative max-w-5xl mx-auto px-6 py-20">
      <div className="text-center mb-10">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Outbound ROI</p>
        <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight">
          What's hiding in your inactive list?
        </h2>
        <p className="text-cream-600 mt-3 max-w-xl mx-auto">
          Most practices are sitting on six figures of unbooked revenue. Drag the sliders to see your number.
        </p>
      </div>

      <div className="rounded-3xl bg-cream-100 border border-cream-200 p-8 md:p-10">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Sliders */}
          <div className="space-y-7">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-cream-800">Inactive patients in your PMS</label>
                <span className="font-serif text-2xl text-cream-900">{inactive.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={100}
                max={5000}
                step={50}
                value={inactive}
                onChange={(e) => setInactive(Number(e.target.value))}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, #c96442 ${((inactive - 100) / (5000 - 100)) * 100}%, rgba(60,50,40,0.10) ${((inactive - 100) / (5000 - 100)) * 100}%)`,
                  height: 6,
                  borderRadius: 4,
                }}
              />
              <p className="text-xs text-cream-500 mt-1.5">Patients you haven't seen in 12+ months</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-cream-800">Average visit value</label>
                <span className="font-serif text-2xl text-cream-900">{formatMoney(avgVisit)}</span>
              </div>
              <input
                type="range"
                min={150}
                max={1200}
                step={10}
                value={avgVisit}
                onChange={(e) => setAvgVisit(Number(e.target.value))}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, #c96442 ${((avgVisit - 150) / (1200 - 150)) * 100}%, rgba(60,50,40,0.10) ${((avgVisit - 150) / (1200 - 150)) * 100}%)`,
                  height: 6,
                  borderRadius: 4,
                }}
              />
              <p className="text-xs text-cream-500 mt-1.5">Cleaning + exam + occasional treatment</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-cream-800">Expected reactivation rate</label>
                <span className="font-serif text-2xl text-cream-900">{reactivationPct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={reactivationPct}
                onChange={(e) => setReactivationPct(Number(e.target.value))}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, #c96442 ${((reactivationPct - 5) / (30 - 5)) * 100}%, rgba(60,50,40,0.10) ${((reactivationPct - 5) / (30 - 5)) * 100}%)`,
                  height: 6,
                  borderRadius: 4,
                }}
              />
              <p className="text-xs text-cream-500 mt-1.5">Industry benchmark for AI-assisted outreach: 8-15%</p>
            </div>
          </div>

          {/* Result panel */}
          <div className="rounded-2xl bg-white p-7 border border-cream-200 shadow-sm">
            <p className="text-xs font-semibold text-cream-500 uppercase tracking-wider">Projected new revenue</p>
            <p className="font-serif text-5xl md:text-6xl text-brand-600 tracking-tight mt-2">
              {formatMoney(monthlyRevenue)}
              <span className="text-base text-cream-500 font-sans">/mo</span>
            </p>

            <div className="mt-6 space-y-3 border-t border-cream-200 pt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-cream-600">Annual revenue</span>
                <span className="font-semibold text-cream-900">{formatMoney(annualRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-cream-600">Less Growth plan ({formatMoney(planCost)}/mo)</span>
                <span className="text-cream-700">−{formatMoney(planCost * 12)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-3 border-t border-cream-200">
                <span className="font-semibold text-cream-900">Net new annual revenue</span>
                <span className="font-serif text-2xl text-cream-900">{formatMoney(annualNet)}</span>
              </div>
            </div>

            <Link
              href="/onboarding/plan"
              className="glow-btn mt-7 inline-flex items-center justify-center gap-2 w-full py-3.5 text-sm font-semibold text-white bg-brand-600 rounded-xl"
            >
              Start free trial →
            </Link>
            <p className="text-[11px] text-cream-500 text-center mt-3">
              14-day trial · 200 outbound minutes free · No credit card
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
