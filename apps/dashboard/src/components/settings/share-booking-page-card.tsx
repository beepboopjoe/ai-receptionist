'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Copy, ExternalLink } from 'lucide-react';
import { useTenant } from '@/lib/TenantProvider';
import { usePlan } from '@/lib/usePlan';
import { useToast } from '@/components/ui/toast';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import { bookingPagePath, bookingPageUrl } from '@/lib/booking-page-url';

export function ShareBookingPageCard() {
  const { tenant, loading } = useTenant();
  const { isDemoAccount, loading: planLoading } = usePlan();
  const toast = useToast();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (loading || !tenant?.slug) {
    return (
      <div className="card p-5">
        <p className="text-sm text-gray-500">Loading your booking page…</p>
      </div>
    );
  }

  const path = bookingPagePath(tenant.slug);
  const url = bookingPageUrl(tenant.slug);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Booking page link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
          <Calendar size={16} className="text-brand-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Share your booking page</h2>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Customers pick a service and time here. It writes to the same calendar the AI uses on
            the phone, so you do not double-book.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={url}
          className="input flex-1 text-sm"
          aria-label="Booking page link"
        />
        <button type="button" onClick={() => void copy()} className="btn-secondary justify-center">
          <Copy size={14} /> Copy
        </button>
        <Link href={path} target="_blank" className="btn-secondary justify-center">
          <ExternalLink size={14} /> Open
        </Link>
      </div>

      {!planLoading && isDemoAccount && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
          <p className="text-xs text-amber-900">
            Online booking is not live on Free. Upgrade to take appointments from this page.
          </p>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="text-xs font-semibold text-brand-700 mt-1 hover:underline"
          >
            See Starter $20 / Growth $199 / Scale $399 / Business $599 →
          </button>
        </div>
      )}

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="public_booking" />
    </div>
  );
}
