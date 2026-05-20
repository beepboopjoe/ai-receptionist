'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { TenantProvider } from '@/lib/TenantProvider';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ToastProvider } from '@/components/ui/toast';
import { RouteProgress } from '@/components/ui/route-progress';
import { OnboardingBanner } from '@/components/layout/onboarding-banner';
import { CommandPalette } from '@/components/ui/command-palette';
import { IdleTimeout } from '@/components/ui/idle-timeout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <TenantProvider>
      <ToastProvider>
        <IdleTimeout />
        <RouteProgress />
        <CommandPalette />
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <OnboardingBanner />
            {/* pt-16 on mobile leaves room for the fixed mobile top bar */}
            {/* key={pathname} resets the error boundary on every navigation */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pt-20 md:pt-8 pb-8">
              <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
      </ToastProvider>
    </TenantProvider>
  );
}
