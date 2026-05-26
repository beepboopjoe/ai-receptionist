// ============================================================
// SectionAgent — the suggestive agent that lives at the top of
// each dashboard section (Calls, Missed Calls, Appointments,
// Escalations). Three stacked layers:
//
//   1. "What this is" — static educational copy from section-meta
//   2. Static action chips — quick navigation to related settings
//   3. Live counts + pending agent suggestions (dynamic)
//
// Pulls live counts via /sections/:section/suggestions and pending
// agent suggestions via the existing /agent/suggestions endpoint,
// rendering them with AgentSuggestionRow for visual consistency
// with the dashboard-wide queue. Collapsible — customers who
// know what a section does can hide the header permanently.
// ============================================================
'use client';
import useSWR from 'swr';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { sectionsApi, agentApi, type SectionLiveCount } from '@/lib/api';
import { useVertical } from '@/lib/useVertical';
import { getSectionMeta, type SectionKey, type VerticalCopyCtx } from '@/lib/section-meta';
import { AgentSuggestionRow } from './agent-suggestion-row';

interface SectionAgentProps {
  section: SectionKey;
}

const COUNT_STYLES: Record<SectionLiveCount['severity'], string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-100',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
};

export function SectionAgent({ section }: SectionAgentProps) {
  const meta = getSectionMeta(section);
  const vertical = useVertical();
  const Icon = meta.icon;

  // Vertical-aware copy context — drives "patient" vs "client" vs "lead"
  // swapping in the section meta's whatThisIs/actions functions. The
  // vertical type only exposes plural forms, so we depluralize naively
  // (works for all 6 current verticals: patients/clients/leads/customers/
  // showings/consultations/appointments — none has an irregular plural).
  const depluralize = (s: string) => (s.endsWith('s') ? s.slice(0, -1) : s);
  const copyCtx: VerticalCopyCtx = {
    contactSingular: depluralize(vertical.contactNounPlural),
    contactPlural: vertical.contactNounPlural,
    appointmentSingular: depluralize(vertical.appointmentNounPlural),
    appointmentPlural: vertical.appointmentNounPlural,
  };

  // Collapse state persists per-section per-tenant in localStorage so
  // power users can dismiss the agent permanently without it nagging.
  const storageKey = `section-agent:${section}:collapsed`;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(localStorage.getItem(storageKey) === 'true');
  }, [storageKey]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      /* ignore */
    }
  }

  // Dynamic data
  const { data: sectionData } = useSWR(
    `section-suggestions-${section}`,
    () => sectionsApi.suggestions(section),
    { refreshInterval: 60_000 }
  );
  const { data: agentData, mutate: mutateAgent } = useSWR(
    'agent-suggestions',
    () => agentApi.listSuggestions('pending'),
    { refreshInterval: 30_000 }
  );

  const liveCounts = sectionData?.liveCounts ?? [];
  const pendingIds = new Set(sectionData?.pendingSuggestionIds ?? []);
  const inlineSuggestions = (agentData?.data ?? []).filter((s) => pendingIds.has(s.id));

  const staticActions = meta.actions(copyCtx);
  const whatThisIs = meta.whatThisIs(copyCtx);

  return (
    <div className="rounded-2xl border border-cream-200 bg-gradient-to-br from-cream-50 via-white to-amber-50/40 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={toggleCollapse}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-white/50 transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-amber-500 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-cream-500" />
            <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">
              {meta.title}
            </p>
          </div>
          {!collapsed && (
            <p className="text-sm text-cream-700 mt-1 leading-relaxed">{whatThisIs}</p>
          )}
        </div>
        <span className="text-cream-400 shrink-0 mt-1">
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {!collapsed && (
        <>
          {/* Live counts */}
          {liveCounts.length > 0 && (
            <div className="px-5 py-3 border-t border-cream-100 flex flex-wrap gap-2">
              {liveCounts.map((c) => (
                <span
                  key={c.label}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${COUNT_STYLES[c.severity]}`}
                >
                  <span className="font-bold tabular-nums">{c.value}</span>
                  <span className="opacity-80">{c.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Static action chips */}
          {staticActions.length > 0 && (
            <div className="px-5 py-3 border-t border-cream-100 flex flex-wrap gap-2">
              {staticActions.map((a) => {
                const isAnchor = a.href.startsWith('#');
                const Component: any = isAnchor ? 'a' : Link;
                const props = isAnchor
                  ? { href: a.href }
                  : { href: a.href, ...(a.external && { target: '_blank', rel: 'noreferrer' }) };
                return (
                  <Component
                    key={a.label}
                    {...props}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5 text-xs font-medium text-cream-800 hover:bg-cream-50 hover:border-cream-300 transition-colors"
                  >
                    {a.label}
                  </Component>
                );
              })}
            </div>
          )}

          {/* Inline pending suggestions (re-homed from dashboard global queue) */}
          {inlineSuggestions.length > 0 && (
            <div className="border-t border-cream-100 bg-white/60">
              <div className="px-5 pt-3 pb-2 flex items-center gap-2">
                <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">
                  Suggested actions
                </p>
                <span className="text-[10px] text-cream-500">
                  · {inlineSuggestions.length} pending
                </span>
              </div>
              <div className="divide-y divide-cream-50">
                {inlineSuggestions.map((s) => (
                  <AgentSuggestionRow
                    key={s.id}
                    suggestion={s}
                    onChange={() => void mutateAgent()}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
