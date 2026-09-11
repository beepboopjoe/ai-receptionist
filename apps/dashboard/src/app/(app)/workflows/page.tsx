'use client';
// ============================================================
// /workflows — gallery of ready-to-run automations.
//
// Packaging + deep-link layer over features that already exist.
// Layout is a calm list with progressive disclosure: inbound
// workflows stay open; outreach and follow-through start collapsed.
// ============================================================
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import {
  buildWorkflowCatalog,
  CATEGORY_META,
  CHANNEL_META,
  STATUS_META,
  type WorkflowCategory,
  type WorkflowDef,
  type WorkflowStatus,
} from '@/lib/workflow-catalog';
import { useGoLive } from '@/lib/useGoLive';

const CATEGORY_ORDER: WorkflowCategory[] = ['reactive', 'proactive', 'admin'];
const DEFAULT_OPEN: Record<WorkflowCategory, boolean> = {
  reactive: true,
  proactive: false,
  admin: false,
};

function resolveWorkflowStatus(
  workflow: WorkflowDef,
  goLive: { hasPhone: boolean; hasPendingPort: boolean; hasCalendar: boolean; hasOpenHours: boolean; hasTransfer: boolean }
): WorkflowStatus {
  if (workflow.status !== 'live') return workflow.status;
  const phoneReady = goLive.hasPhone || goLive.hasPendingPort;
  if (workflow.id === 'call-answering' || workflow.id === 'lead-intake') {
    return phoneReady ? 'live' : 'setup';
  }
  if (workflow.id === 'appointment-booking') {
    return phoneReady && (goLive.hasCalendar || goLive.hasOpenHours) ? 'live' : 'setup';
  }
  if (workflow.id === 'ask-your-ai') {
    return phoneReady && goLive.hasTransfer ? 'live' : 'setup';
  }
  return workflow.status;
}

export default function WorkflowsPage() {
  const vertical = useVertical();
  const goLive = useGoLive();
  const catalog = buildWorkflowCatalog(vertical).map((w) => ({
    ...w,
    status: resolveWorkflowStatus(w, goLive),
  }));

  const liveCount = catalog.filter((w) => w.status === 'live').length;
  const setupCount = catalog.filter((w) => w.status === 'setup').length;
  const nextSetup = catalog.find((w) => w.status === 'setup' && w.setupHref);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Workflows</h1>
        <p className="text-gray-500 mt-1">
          Ready-made automations for your front desk. Start with answering the phone — open the
          rest when you need them.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {liveCount} live
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-500" /> {setupCount} ready to set up
          </span>
        </div>
        {nextSetup?.setupHref && (
          <Link
            href={nextSetup.setupHref}
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Next: {nextSetup.name} <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const items = catalog.filter((w) => w.category === cat && w.status !== 'coming_soon');
        if (items.length === 0) return null;
        return <WorkflowGroup key={cat} category={cat} items={items} />;
      })}
    </div>
  );
}

function WorkflowGroup({
  category,
  items,
}: {
  category: WorkflowCategory;
  items: WorkflowDef[];
}) {
  const [open, setOpen] = useState(DEFAULT_OPEN[category]);
  const meta = CATEGORY_META[category];
  const setupInGroup = items.filter((w) => w.status === 'setup').length;

  return (
    <section className="rounded-2xl border border-cream-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-cream-50/80 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-cream-900">{meta.label}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.tagline}</p>
        </div>
        <span className="text-xs text-gray-400 tabular-nums shrink-0">
          {items.length}
          {setupInGroup > 0 ? ` · ${setupInGroup} to set up` : ''}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul className="divide-y divide-cream-100 border-t border-cream-100">
          {items.map((w) => (
            <li key={w.id}>
              <WorkflowRow workflow={w} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WorkflowRow({ workflow }: { workflow: WorkflowDef }) {
  const Icon = workflow.icon;
  const status = STATUS_META[workflow.status];
  const channel = CHANNEL_META[workflow.channel];
  const href = workflow.setupHref;

  const statusClass =
    workflow.status === 'live'
      ? 'text-emerald-700'
      : workflow.status === 'setup'
        ? 'text-brand-700'
        : 'text-gray-400';

  const inner = (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <div className="w-8 h-8 rounded-lg bg-cream-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={15} className="text-brand-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-sm text-cream-900">{workflow.name}</h3>
          <span className={`text-[11px] font-semibold ${statusClass}`}>{status.label}</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mt-0.5 line-clamp-2">
          {workflow.description}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mt-1.5">
          {channel.label}
        </p>
      </div>
      {href && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 shrink-0 mt-1 group-hover:gap-1.5 transition-all">
          {status.cta} <ArrowRight size={12} />
        </span>
      )}
    </div>
  );

  if (!href) {
    return inner;
  }
  return (
    <Link href={href} className="group block hover:bg-cream-50/70 transition-colors">
      {inner}
    </Link>
  );
}
