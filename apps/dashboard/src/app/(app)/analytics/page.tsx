'use client';
// ============================================================
// /analytics — Phase 12.6. Renders aggregated metrics for the
// last N days: totals, daily bar chart (hand-rolled SVG), peak
// hour, and ROI estimates. Gated behind the 'analytics' feature
// flag (Scale plan); free/Starter/Growth see a LockedFeature
// overlay with the upgrade modal.
// ============================================================
import useSWR from 'swr';
import { useState } from 'react';
import { analyticsApi } from '@/lib/api';
import { useFeatureFlags } from '@/lib/featureFlags';
import { LockedFeature } from '@/components/ui/locked-feature';
import { SectionAgent } from '@/components/dashboard/section-agent';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Calendar,
  AlertCircle,
  TrendingUp,
  Clock,
  DollarSign,
  Sparkles,
} from 'lucide-react';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

export default function AnalyticsPage() {
  const { has, loading: flagsLoading } = useFeatureFlags();
  const entitled = flagsLoading ? false : has('analytics');
  const [days, setDays] = useState(30);

  // Only fetch when entitled — otherwise the gated component renders
  // with an empty stub behind the lock overlay.
  const { data, isLoading } = useSWR(
    entitled ? ['analytics-overview', days] : null,
    () => analyticsApi.overview(days)
  );

  // Always render the page shell. Lock overlay handles the gate so
  // the layout doesn't jump for paid users while the flag loads.
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Analytics</h1>
          <p className="text-gray-500 mt-1">
            Volume, answer rates, peak hours, and the ROI you&apos;re capturing.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-cream-200 bg-white p-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                days === r.value
                  ? 'bg-brand-600 text-white'
                  : 'text-cream-600 hover:text-cream-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!entitled && !flagsLoading ? (
        <LockedFeature requiredPlan="scale" reason="pro_analytics" label="Analytics is a Scale-plan feature">
          <AnalyticsStub />
        </LockedFeature>
      ) : isLoading || !data ? (
        <AnalyticsLoading />
      ) : (
        <AnalyticsContent data={data} />
      )}
    </div>
  );
}

// ── Real content ────────────────────────────────────────────────────────────

function AnalyticsContent({ data }: { data: NonNullable<ReturnType<typeof useEmptyData>> }) {
  const { totals, daily, peakHour, roi } = data;

  return (
    <>
      {/* Top stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Calls"
          value={totals.calls.toLocaleString()}
          icon={Phone}
          color="bg-blue-500"
        />
        <StatCard
          label="Answer Rate"
          value={`${totals.answerRate}%`}
          icon={PhoneIncoming}
          color="bg-emerald-500"
        />
        <StatCard
          label="Bookings"
          value={totals.bookings.toLocaleString()}
          icon={Calendar}
          color="bg-purple-500"
        />
        <StatCard
          label="Missed"
          value={totals.missed.toLocaleString()}
          icon={PhoneMissed}
          color="bg-red-500"
        />
      </div>

      {/* Daily activity chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 text-sm">Daily activity</h2>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <LegendDot color="bg-brand-500" label="Calls" />
            <LegendDot color="bg-red-400" label="Missed" />
            <LegendDot color="bg-purple-500" label="Bookings" />
          </div>
        </div>
        <DailyChart daily={daily} />
      </div>

      {/* Peak hour + escalations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Peak hour
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {peakHour ? formatHour(peakHour.hour) : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {peakHour
              ? `${peakHour.count} calls came in during this hour. Worth knowing for staffing or after-hours rules.`
              : 'Not enough call data to spot a pattern yet.'}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
              <AlertCircle size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                Escalations
              </p>
              <p className="text-lg font-semibold text-gray-900">{totals.escalations}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Calls flagged for human follow-up. A low number means your AI is handling the
            conversation end-to-end.
          </p>
        </div>
      </div>

      {/* ROI block */}
      <div className="card p-6 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 border-emerald-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              What your AI delivered
            </p>
            <p className="text-lg font-semibold text-gray-900">
              The bottom-line impact
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RoiCard
            icon={PhoneIncoming}
            label="Calls answered"
            value={roi.callsRecovered.toLocaleString()}
            sub="Every one would've gone to voicemail without the AI."
          />
          <RoiCard
            icon={DollarSign}
            label="Estimated revenue captured"
            value={`$${roi.moneySaved.toLocaleString()}`}
            sub={`Based on ${roi.callsRecovered ? totals.bookings : 0} bookings × $${roi.avgBookingValueUsd} avg value.`}
          />
          <RoiCard
            icon={TrendingUp}
            label="Hours of staff work avoided"
            value={`${roi.hoursOfStaffWork.toFixed(1)} hrs`}
            sub={`Roughly $${roi.humanCostAvoided.toLocaleString()} in receptionist wages.`}
          />
        </div>
      </div>

      <SectionAgent section="calls" />
    </>
  );
}

// ── Daily SVG bar chart ─────────────────────────────────────────────────────

function DailyChart({ daily }: { daily: AnalyticsOverview['daily'] }) {
  if (daily.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400">
        No data in this window yet.
      </div>
    );
  }
  const maxCalls = Math.max(1, ...daily.map((d) => d.calls));
  const width = 800;
  const height = 180;
  const barGap = 2;
  const barWidth = Math.max(2, (width - daily.length * barGap) / daily.length);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height + 20}`}
        preserveAspectRatio="none"
        className="w-full h-48"
        role="img"
        aria-label={`Daily activity over ${daily.length} days`}
      >
        {daily.map((d, i) => {
          const x = i * (barWidth + barGap);
          // Stacked: bookings on top, missed in middle (red), answered base (brand)
          const callBarH = (d.calls / maxCalls) * height;
          const missedH = (d.missed / maxCalls) * height;
          const bookingsH = (d.bookings / maxCalls) * height;
          const callsY = height - callBarH;
          const missedY = height - missedH;
          const bookingsY = height - bookingsH - 4; // float above bar
          return (
            <g key={d.date}>
              <title>{`${d.date}: ${d.calls} calls · ${d.missed} missed · ${d.bookings} bookings`}</title>
              {/* Calls (brand) — base bar */}
              <rect
                x={x}
                y={callsY}
                width={barWidth}
                height={callBarH}
                fill="#6366F1"
                opacity={0.9}
                rx={1}
              />
              {/* Missed (red) — overlaid at the top of the calls bar */}
              {d.missed > 0 && (
                <rect
                  x={x}
                  y={missedY}
                  width={barWidth}
                  height={missedH}
                  fill="#F87171"
                  opacity={0.85}
                  rx={1}
                />
              )}
              {/* Bookings dot above the bar */}
              {d.bookings > 0 && (
                <circle
                  cx={x + barWidth / 2}
                  cy={bookingsY}
                  r={Math.min(4, Math.max(2, bookingsHRadius(d.bookings)))}
                  fill="#A855F7"
                  opacity={0.9}
                />
              )}
            </g>
          );
        })}
        {/* x-axis baseline */}
        <line x1={0} x2={width} y1={height} y2={height} stroke="#E5E7EB" strokeWidth={1} />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
        <span>{daily[0]?.date}</span>
        <span>{daily[daily.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function bookingsHRadius(n: number): number {
  return 2 + Math.log2(n + 1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={13} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">{value}</p>
    </div>
  );
}

function RoiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-white/80 border border-emerald-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-emerald-600" />
        <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className="font-serif text-3xl text-cream-900 tabular-nums">{value}</p>
      <p className="text-[11px] text-cream-600 mt-2 leading-relaxed">{sub}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function formatHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? 'am' : 'pm';
  return `${h12}:00 ${period}`;
}

// ── Loading + locked stub ──────────────────────────────────────────────────

function AnalyticsLoading() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <Skeleton width="w-24" height="h-3" />
            <Skeleton width="w-16" height="h-7" />
          </div>
        ))}
      </div>
      <div className="card p-6">
        <Skeleton width="w-full" height="h-48" />
      </div>
    </>
  );
}

// Stub for the locked overlay. Renders dummy stat shapes so the blur
// looks like a real page underneath.
function AnalyticsStub() {
  const fake = {
    period: { days: 30, from: '', to: '' },
    totals: {
      calls: 247,
      answered: 232,
      missed: 15,
      bookings: 48,
      escalations: 3,
      totalDurationSeconds: 12600,
      answerRate: 94,
    },
    daily: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      calls: 5 + Math.round(Math.sin(i) * 4 + Math.random() * 6),
      missed: Math.round(Math.random() * 2),
      bookings: Math.round(Math.random() * 3),
    })),
    peakHour: { hour: 10, count: 24 },
    roi: {
      callsRecovered: 232,
      moneySaved: 9600,
      hoursOfStaffWork: 3.5,
      humanCostAvoided: 77,
      avgBookingValueUsd: 200,
    },
  };
  return <AnalyticsContent data={fake} />;
}

// Stub return-type helper for the AnalyticsContent prop typing — needs to
// match the shape from analyticsApi.overview().
function useEmptyData() {
  return null as unknown as AnalyticsOverview;
}

import type { AnalyticsOverview } from '@/lib/api';
