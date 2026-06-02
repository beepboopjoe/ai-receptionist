'use client';
// ============================================================
// /workflows — Phase 28a. The Workflows gallery: the centerpiece
// of the "AI front desk" dashboard.
//
// A menu of ready-to-run, comms-native automations grouped into
// three categories. Each card is a packaging + deep-link layer
// over a feature that already exists — clicking "Set up" jumps to
// the surface that powers it. This page has no execution logic and
// no API calls; it renders buildWorkflowCatalog(vertical).
// ============================================================
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import {
  buildWorkflowCatalog,
  CATEGORY_META,
  CHANNEL_META,
  STATUS_META,
  type WorkflowCategory,
  type WorkflowDef,
} from '@/lib/workflow-catalog';

const CATEGORY_ORDER: WorkflowCategory[] = ['reactive', 'proactive', 'admin'];

export default function WorkflowsPage() {
  const vertical = useVertical();
  const catalog = buildWorkflowCatalog(vertical);

  const liveCount = catalog.filter((w) => w.status === 'live').length;
  const setupCount = catalog.filter((w) => w.status === 'setup').length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Workflows</h1>
        <p className="text-gray-500 mt-1 max-w-2xl">
          Your AI front desk, one menu. Each workflow is a ready-to-run automation — turn it on and
          it answers, books, reminds, and follows up on its own.
        </p>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {liveCount} live
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-500" /> {setupCount} ready to set up
          </span>
        </div>
      </div>

      {/* Category sections */}
      {CATEGORY_ORDER.map((cat) => {
        const items = catalog.filter((w) => w.category === cat);
        if (items.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <section key={cat} className="space-y-4">
            <div className="border-b border-cream-200 pb-2">
              <h2 className="font-serif text-xl text-cream-900">{meta.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{meta.tagline}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((w) => (
                <WorkflowCard key={w.id} workflow={w} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowDef }) {
  const Icon = workflow.icon;
  const status = STATUS_META[workflow.status];
  const channel = CHANNEL_META[workflow.channel];
  const isComingSoon = workflow.status === 'coming_soon';

  const badgeClass =
    workflow.status === 'live'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : workflow.status === 'setup'
        ? 'bg-brand-50 text-brand-700 border-brand-200'
        : 'bg-gray-100 text-gray-500 border-gray-200';

  const card = (
    <div
      className={`h-full rounded-2xl border bg-white p-5 flex flex-col transition-all ${
        isComingSoon
          ? 'border-cream-200 opacity-70'
          : 'border-cream-200 hover:border-brand-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-brand-600" />
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeClass}`}>
          {status.label}
        </span>
      </div>
      <h3 className="font-semibold text-cream-900 text-sm mb-1">{workflow.name}</h3>
      <p className="text-xs text-gray-600 leading-relaxed flex-1">{workflow.description}</p>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-cream-100">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {channel.label}
        </span>
        {isComingSoon ? (
          <span className="text-xs font-semibold text-gray-400">Coming soon</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-1.5 transition-all">
            {status.cta} <ArrowRight size={12} />
          </span>
        )}
      </div>
    </div>
  );

  if (isComingSoon || !workflow.setupHref) {
    return <div className="group cursor-default">{card}</div>;
  }
  return (
    <Link href={workflow.setupHref} className="group block">
      {card}
    </Link>
  );
}
