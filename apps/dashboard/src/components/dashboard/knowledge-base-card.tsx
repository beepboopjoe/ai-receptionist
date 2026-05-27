// ============================================================
// KnowledgeBaseCard — promotes the Knowledge Base feature on
// surfaces where a tenant should upload their docs:
//   - /dashboard home
//   - /settings/voice-agent (next to the Curate-My-Agent card)
//
// Same visual language family as LeadDiscoveryCard but indigo
// accent so the two promo cards are visually distinct when
// stacked on the dashboard home.
// ============================================================
'use client';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';

interface KnowledgeBaseCardProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  cta?: string;
  compact?: boolean;
}

export function KnowledgeBaseCard({
  eyebrow = 'Knowledge Base',
  title = 'Teach your AI your business',
  description = "Upload your fee schedule, intake forms, FAQs, or any PDF. The AI grounds every call in them — no more 'I'm not sure, let me have someone call you back' for things the doc already answers.",
  cta = 'Upload your docs',
  compact = false,
}: KnowledgeBaseCardProps) {
  return (
    <Link
      href="/settings/knowledge-base"
      className={`block rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-brand-50/40 hover:shadow-md transition-shadow ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 ${
            compact ? 'w-9 h-9' : 'w-11 h-11'
          }`}
        >
          <BookOpen size={compact ? 16 : 18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
            {eyebrow}
          </p>
          <p className={`font-semibold text-cream-900 mt-0.5 ${compact ? 'text-sm' : ''}`}>
            {title}
          </p>
          <p
            className={`text-cream-700 mt-1 leading-relaxed ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            {description}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-700 transition-colors whitespace-nowrap">
          {cta} <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}
