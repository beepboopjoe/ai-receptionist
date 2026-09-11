'use client';
// DemoUpgradeCard — Free-account CTA. Explore the dashboard; go-live
// (phone + activate) unlocks after upgrade. Prices from the catalog.
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { getPlan } from '@ai-receptionist/shared';
import { UpgradeModal } from '@/components/ui/upgrade-modal';

const growth = getPlan('growth')!;
const scale = getPlan('scale')!;
const business = getPlan('business')!;

export function DemoUpgradeCard({
  title = 'Explore the dashboard',
  body = 'This is a preview of the Telfin interface. Upgrade when you are ready to go live with a phone number and AI receptionist.',
}: {
  title?: string;
  body?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <UpgradeModal open={open} onClose={() => setOpen(false)} reason="go_live" />
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-amber-50/40 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-xl text-cream-900 mb-1">{title}</h2>
            <p className="text-sm text-cream-700">{body}</p>
          </div>
        </div>
        <p className="text-xs text-cream-600">
          {growth.name} ${growth.monthlyPrice}/mo · {scale.name} ${scale.monthlyPrice}/mo ·{' '}
          {business.name} ${business.monthlyPrice}/mo
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Upgrade to go live <ArrowRight size={14} />
          </button>
          <Link
            href="/billing"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-cream-200 bg-white text-cream-800 text-sm font-semibold hover:bg-cream-50 transition-colors"
          >
            See plans
          </Link>
        </div>
      </div>
    </>
  );
}
