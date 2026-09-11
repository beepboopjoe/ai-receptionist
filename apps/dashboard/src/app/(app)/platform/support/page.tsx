'use client';
// ============================================================
// /platform/support — founder ticket queue.
//
// Tenant Help CTAs submit to /support; this page is where Joey
// works those client-assist situations (reply / resolve / reopen).
// ============================================================
import Link from 'next/link';
import useSWR from 'swr';
import { Shield, Loader2, LifeBuoy } from 'lucide-react';
import { platformApi } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { SupportTicketsSection } from '@/components/platform/support-tickets-section';

export default function PlatformSupportPage() {
  const { data: whoamiData, isLoading: whoamiLoading } = useSWR(
    'platform-whoami',
    () => platformApi.whoami()
  );
  const isPlatformAdmin = Boolean(whoamiData?.ok);

  if (whoamiLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <EmptyState
        icon={Shield}
        label="Platform admin only"
        hint="This page is reserved for the platform owner. If you should have access, ask for your email to be added to ADMIN_EMAILS on the API."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
          <LifeBuoy size={22} className="text-white" />
        </div>
        <div>
          <h1 className="font-serif text-3xl text-gray-900 tracking-tight">Support tickets</h1>
          <p className="text-gray-600 mt-1">
            Client messages from Help in the dashboard. Reply by email, then resolve when the
            situation is handled.
          </p>
          <Link
            href="/platform"
            className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-indigo-700 hover:underline"
          >
            ← Platform Admin
          </Link>
        </div>
      </div>

      <SupportTicketsSection />
    </div>
  );
}
