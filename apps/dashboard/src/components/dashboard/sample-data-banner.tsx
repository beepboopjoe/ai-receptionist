'use client';
// Persistent-but-quiet label so sample office rows are never mistaken
// for live production data. Shown on list pages when fill() overlays.
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function SampleDataBanner({
  noun = 'this list',
}: {
  noun?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <Sparkles size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-semibold">Sample data</span>
          {' — '}
          {noun} is a browse-only preview of a live office. Upgrade to Starter ($20/mo) to go live.
        </p>
      </div>
      <Link
        href="/billing"
        className="shrink-0 text-xs font-semibold text-amber-900 hover:underline"
      >
        See plans →
      </Link>
    </div>
  );
}
