'use client';
// ============================================================
// RoiCalculator — Phase 17. Interactive widget for marketing pages.
//
// Inputs:
//   - callsPerMonth   (how many inbound calls the business handles)
//   - missedRate      (% of those that currently go to voicemail)
//   - avgCustomerValue (revenue from one converted call)
//   - captureRate     (% of recovered calls that convert; default 25%)
//
// Outputs:
//   - missedCallsRecovered/mo
//   - recoveredRevenue/mo
//   - platformCost/mo (Growth plan default)
//   - netLift = recoveredRevenue - platformCost
//   - roiMultiple = recoveredRevenue / platformCost
//
// All math is client-side so the widget works on a static export.
// ============================================================
import { useState, useMemo } from 'react';

const PLATFORM_COST_MONTHLY = 199; // Growth plan baseline; swap to plan picker later.

export interface RoiCalculatorProps {
  /** Default vertical to flavor the copy ("patients" vs "clients" vs "leads"). */
  vertical?: 'legal' | 'dental' | 'insurance' | 'real_estate' | 'home_services' | 'generic';
  /** Override the platform cost shown. Default = $199 (Growth plan). */
  platformCostMonthly?: number;
  /** Default inputs (per vertical). */
  defaults?: {
    callsPerMonth?: number;
    missedRate?: number;
    avgCustomerValue?: number;
    captureRate?: number;
  };
}

const VERTICAL_NOUNS: Record<NonNullable<RoiCalculatorProps['vertical']>, { contact: string; ctaNoun: string }> = {
  legal:         { contact: 'prospects',   ctaNoun: 'signed retainer' },
  dental:        { contact: 'patients',    ctaNoun: 'new patient'      },
  insurance:     { contact: 'prospects',   ctaNoun: 'bound policy'     },
  real_estate:   { contact: 'leads',       ctaNoun: 'closed transaction' },
  home_services: { contact: 'customers',   ctaNoun: 'booked job'       },
  generic:       { contact: 'callers',     ctaNoun: 'new customer'     },
};

const DEFAULT_BY_VERTICAL: Record<NonNullable<RoiCalculatorProps['vertical']>, Required<NonNullable<RoiCalculatorProps['defaults']>>> = {
  legal:         { callsPerMonth: 120, missedRate: 35, avgCustomerValue: 2400, captureRate: 25 },
  dental:        { callsPerMonth: 250, missedRate: 30, avgCustomerValue: 1800, captureRate: 30 },
  insurance:     { callsPerMonth: 180, missedRate: 25, avgCustomerValue: 420,  captureRate: 35 },
  real_estate:   { callsPerMonth: 80,  missedRate: 40, avgCustomerValue: 8400, captureRate: 15 },
  home_services: { callsPerMonth: 200, missedRate: 35, avgCustomerValue: 650,  captureRate: 40 },
  generic:       { callsPerMonth: 150, missedRate: 30, avgCustomerValue: 1500, captureRate: 25 },
};

function currency(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function RoiCalculator({
  vertical = 'generic',
  platformCostMonthly = PLATFORM_COST_MONTHLY,
  defaults,
}: RoiCalculatorProps) {
  const seedDefaults = { ...DEFAULT_BY_VERTICAL[vertical], ...defaults };
  const nouns = VERTICAL_NOUNS[vertical];

  const [callsPerMonth, setCallsPerMonth] = useState(seedDefaults.callsPerMonth);
  const [missedRate, setMissedRate] = useState(seedDefaults.missedRate);
  const [avgCustomerValue, setAvgCustomerValue] = useState(seedDefaults.avgCustomerValue);
  const [captureRate, setCaptureRate] = useState(seedDefaults.captureRate);

  const math = useMemo(() => {
    const missedCalls = (callsPerMonth * missedRate) / 100;
    const recoveredConversions = (missedCalls * captureRate) / 100;
    const recoveredRevenue = recoveredConversions * avgCustomerValue;
    const netLift = recoveredRevenue - platformCostMonthly;
    const roiMultiple = platformCostMonthly > 0 ? recoveredRevenue / platformCostMonthly : 0;
    return { missedCalls, recoveredConversions, recoveredRevenue, netLift, roiMultiple };
  }, [callsPerMonth, missedRate, avgCustomerValue, captureRate, platformCostMonthly]);

  return (
    <section className="py-20 px-6 bg-cream-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
            ROI Calculator
          </p>
          <h2 className="font-serif text-4xl md:text-5xl text-cream-900 tracking-tight mb-3">
            What is one missed call worth to you?
          </h2>
          <p className="text-cream-600 max-w-2xl mx-auto">
            Adjust the sliders to your numbers. The math updates live.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ── Inputs ── */}
          <div className="space-y-5">
            <SliderRow
              label={`Inbound calls per month`}
              value={callsPerMonth}
              min={20}
              max={1000}
              step={10}
              format={(v) => v.toLocaleString()}
              onChange={setCallsPerMonth}
            />
            <SliderRow
              label="% currently missed (voicemail / no-answer)"
              value={missedRate}
              min={5}
              max={70}
              step={1}
              format={(v) => `${v}%`}
              onChange={setMissedRate}
            />
            <SliderRow
              label={`Average revenue from one ${nouns.ctaNoun}`}
              value={avgCustomerValue}
              min={50}
              max={20000}
              step={50}
              format={currency}
              onChange={setAvgCustomerValue}
            />
            <SliderRow
              label={`% of recovered calls that become ${nouns.contact}`}
              value={captureRate}
              min={5}
              max={75}
              step={1}
              format={(v) => `${v}%`}
              onChange={setCaptureRate}
            />
          </div>

          {/* ── Outputs ── */}
          <div className="flex flex-col justify-center bg-gradient-to-br from-cream-50 to-brand-50/40 rounded-xl p-6 border border-cream-200">
            <div className="space-y-4">
              <Stat
                label="Calls recovered per month"
                value={Math.round(math.missedCalls).toLocaleString()}
              />
              <Stat
                label={`New ${nouns.contact} per month`}
                value={Math.round(math.recoveredConversions).toLocaleString()}
              />
              <Stat
                label="Recovered revenue per month"
                value={currency(Math.round(math.recoveredRevenue))}
                emphasize
              />
              <div className="border-t border-cream-200 pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-cream-600">Platform cost (Growth plan)</span>
                  <span className="text-cream-700">{currency(platformCostMonthly)}/mo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cream-700 font-semibold">Net monthly lift</span>
                  <span
                    className={`font-bold ${math.netLift > 0 ? 'text-emerald-700' : 'text-red-600'}`}
                  >
                    {math.netLift > 0 ? '+' : ''}
                    {currency(Math.round(math.netLift))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cream-700">ROI multiple</span>
                  <span className="font-bold text-brand-700">
                    {math.roiMultiple.toFixed(1)}×
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-cream-400 text-center mt-4 max-w-2xl mx-auto">
          Math is illustrative — every business is different. Defaults seeded from common industry
          benchmarks. Slide to your real numbers.
        </p>
      </div>
    </section>
  );
}

// ── Small internals ────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="text-sm font-medium text-cream-800">{label}</label>
        <span className="font-mono font-semibold text-brand-700">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-cream-500 font-semibold">{label}</div>
      <div
        className={`font-serif ${emphasize ? 'text-4xl text-brand-700' : 'text-2xl text-cream-900'}`}
      >
        {value}
      </div>
    </div>
  );
}
