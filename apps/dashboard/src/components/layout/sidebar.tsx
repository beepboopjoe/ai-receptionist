'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Phone,
  Calendar,
  Users,
  PhoneMissed,
  Bell,
  AlertCircle,
  Settings,
  LogOut,
  Megaphone,
  MessageSquare,
  CreditCard,
  Zap,
  BarChart2,
  Building2,
  Lock,
  Menu,
  X,
  Shield,
  Sparkles,
  LifeBuoy,
  Crosshair,
} from 'lucide-react';
import { clsx } from 'clsx';
import { logout } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { usePlan } from '@/lib/usePlan';
import { useFeatureFlags } from '@/lib/featureFlags';
import { useVertical } from '@/lib/useVertical';
import { BRAND_NAME } from '@/lib/brand';
import { complianceApi, platformApi } from '@/lib/api';
import useSWR from 'swr';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import type { UpgradeReason } from '@/components/ui/upgrade-modal';
import { useLiveCalls } from '@/lib/useLiveCalls';

function buildNav(contactsLabel: string, appointmentsLabel: string) {
  return [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requires: undefined as undefined | 'two_way_sms' },
    { href: '/calls', label: 'Call Log', icon: Phone, requires: undefined as undefined | 'two_way_sms' },
    { href: '/appointments', label: appointmentsLabel, icon: Calendar, requires: undefined as undefined | 'two_way_sms' },
    { href: '/contacts', label: contactsLabel, icon: Users, requires: undefined as undefined | 'two_way_sms' },
    { href: '/leads/discover', label: 'Lead Discovery', icon: Crosshair, requires: undefined as undefined | 'two_way_sms' },
    { href: '/missed-calls', label: 'Missed Calls', icon: PhoneMissed, requires: undefined as undefined | 'two_way_sms' },
    { href: '/reminders', label: 'Reminders', icon: Bell, requires: undefined as undefined | 'two_way_sms' },
    { href: '/escalations', label: 'Escalations', icon: AlertCircle, requires: undefined as undefined | 'two_way_sms' },
    { href: '/campaigns', label: 'Campaigns', icon: Megaphone, requires: undefined as undefined | 'two_way_sms' },
    { href: '/messages', label: 'Messages', icon: MessageSquare, requires: 'two_way_sms' as const },
    { href: '/billing', label: 'Billing', icon: CreditCard, requires: undefined as undefined | 'two_way_sms' },
  ];
}

// Pro-locked nav entries. When `href` is set AND the tenant is entitled,
// the item renders as a real Link; otherwise it shows the upgrade modal.
const proNavItems: {
  label: string;
  icon: React.ElementType;
  reason: UpgradeReason;
  href?: string;
}[] = [
  { label: 'Analytics', icon: BarChart2, reason: 'pro_analytics', href: '/analytics' },
  { label: 'Multi-location', icon: Building2, reason: 'multi_location' },
];

const settingsNav = [
  { href: '/settings/phone-numbers', label: 'Phone Numbers', icon: null },
  { href: '/settings/integrations', label: 'Integrations', icon: null },
  { href: '/settings/office-hours', label: 'Office Hours', icon: null },
  { href: '/settings/voice-agent', label: 'Voice Agent', icon: null },
  { href: '/settings/notifications', label: 'Notifications', icon: null },
  { href: '/settings/webhooks', label: 'Webhooks', icon: null },
  { href: '/settings/api-keys', label: 'API Keys', icon: null },
  { href: '/settings/team', label: 'Team', icon: null },
  { href: '/settings/audit-log', label: 'Audit Log', icon: null },
  { href: '/settings/compliance', label: 'Compliance', icon: 'shield' as const },
  { href: '/settings/agent', label: 'AI Agent', icon: 'sparkles' as const },
  { href: '/support', label: 'Help & Support', icon: 'lifebuoy' as const },
];

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  growth: 'Growth',
  scale: 'Scale',
  enterprise: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-50 text-blue-700',
  growth: 'bg-brand-50 text-brand-700',
  scale: 'bg-purple-50 text-purple-700',
  enterprise: 'bg-amber-50 text-amber-700',
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { plan, usagePercent, minutesUsed, minutesIncluded, loading } = usePlan();
  const { has } = useFeatureFlags();
  const analyticsEnabled = has('analytics');
  const vertical = useVertical();
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  // Mobile drawer state — sidebar is hidden on mobile and revealed via the
  // top-bar hamburger button. Closing happens on link click (handled inline).
  const [mobileOpen, setMobileOpen] = useState(false);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const nav = buildNav(cap(vertical.contactNounPlural), cap(vertical.appointmentNounPlural));

  // Live-call pulse — when one or more AI calls are in progress, the
  // Call Log link sprouts a red dot so customers can spot the action.
  // Shares the same WebSocket connection as the /calls page (useActivityFeed).
  const { activeCalls } = useLiveCalls();
  const liveCallCount = activeCalls.length;

  // Compliance badge — show amber dot on Compliance nav item when BAA is
  // unsigned. Only fetch when the user is authenticated (window exists).
  const { data: complianceStatus } = useSWR(
    typeof window !== 'undefined' ? 'compliance-status' : null,
    () => complianceApi.getStatus(),
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false }
  );
  // Show badge for dental/healthcare vertical until BAA is accepted
  const showComplianceBadge =
    vertical.id === 'dental' && complianceStatus && !complianceStatus.baaAccepted;

  // Platform-admin check — fetches /platform/whoami. Endpoint returns
  // 200 for every authenticated user, with an `ok: boolean` field that
  // reflects whether the caller is in ADMIN_EMAILS. We never let it
  // throw (would trigger the global 401-interceptor and bounce the
  // user to /login). Used to gate the "Platform" sidebar link.
  //
  // Shape matches the /platform page's SWR call so they share cache
  // cleanly under the same key — returning a different shape here
  // would cause "ok is undefined" on whichever component mounts second.
  const { data: platformAdmin } = useSWR(
    typeof window !== 'undefined' ? 'platform-whoami' : null,
    async () => {
      try {
        return await platformApi.whoami();
      } catch {
        return { ok: false, email: '' };
      }
    },
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 }
  );

  const isHighUsage = usagePercent >= 80;
  const showUpgradeCta = !loading && (plan === 'trial' || plan === 'starter');

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <>
      {/* Pro-feature upgrade modal triggered from locked nav items */}
      <UpgradeModal
        open={upgradeReason !== null}
        onClose={() => setUpgradeReason(null)}
        reason={upgradeReason ?? 'pro_analytics'}
      />

      {/* Mobile top bar — only visible below md breakpoint. Lives above the
          drawer so users can always access the menu. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-cream-100 border-b border-cream-200 flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-cream-200 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-cream-800" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">
            ar
          </div>
          <span className="font-serif text-base text-cream-900">{BRAND_NAME}</span>
        </div>
        <span className="text-xs flex items-center gap-1">
          <span>{vertical.emoji}</span>
        </span>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`bg-cream-100 border-r border-cream-200 flex flex-col h-screen sticky top-0
          w-64 shrink-0
          md:translate-x-0 md:static
          fixed top-0 left-0 z-50 transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-3 right-3 p-2 rounded-lg hover:bg-cream-200"
          aria-label="Close menu"
        >
          <X size={18} className="text-cream-700" />
        </button>
        {/* Logo + vertical badge */}
        <div className="px-6 py-5 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-serif text-lg">
              ar
            </div>
            <span className="font-serif text-lg text-cream-900">{BRAND_NAME}</span>
          </div>
          <Link
            href="/settings/voice-agent"
            className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream-200/60 hover:bg-cream-200 text-xs font-medium text-cream-700 transition-colors"
            title="Industry — change in Voice Agent settings"
          >
            <span>{vertical.emoji}</span>
            <span className="truncate max-w-[140px]">{vertical.label}</span>
          </Link>
        </div>

        {/* Search affordance — opens the cmd-K palette */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => {
              // Dispatch a synthetic ⌘K so the CommandPalette opens regardless of
              // platform. The palette's keydown listener catches both meta+K and ctrl+K.
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span className="flex-1 text-left">Search…</span>
            <kbd className="hidden sm:inline text-[10px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Platform-admin link — only visible to emails in ADMIN_EMAILS */}
          {platformAdmin?.ok && (
            <Link
              href="/platform"
              onClick={() => setMobileOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-2 border',
                pathname === '/platform' || pathname.startsWith('/platform/')
                  ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border-indigo-200'
                  : 'bg-gradient-to-r from-indigo-50/40 to-violet-50/40 text-indigo-700 border-indigo-100 hover:from-indigo-50 hover:to-violet-50'
              )}
            >
              <Shield size={18} />
              <span className="flex-1">Platform Admin</span>
              <Sparkles size={12} className="text-indigo-400" />
            </Link>
          )}
          {nav.map(({ href, label, icon: Icon, requires }) => {
            const locked = requires && !has(requires);
            if (locked) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => setUpgradeReason('sms_locked')}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-50 w-full text-left transition-colors"
                  title={`${label} — requires Growth plan`}
                >
                  <Icon size={18} className="opacity-50" />
                  <span className="flex-1">{label}</span>
                  <Lock size={13} className="opacity-40" />
                </button>
              );
            }
            const showLivePulse = href === '/calls' && liveCallCount > 0;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === href || pathname.startsWith(href + '/')
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {showLivePulse && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700"
                    title={`${liveCallCount} call${liveCallCount > 1 ? 's' : ''} in progress`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </Link>
            );
          })}

          {/* Pro-locked nav items. Analytics is a real page when the
              tenant is entitled (Scale plan); otherwise it stays a
              locked button that opens the upgrade modal. */}
          {proNavItems.map(({ label, icon: Icon, reason, href }) => {
            if (analyticsEnabled && href) {
              return (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname === href || pathname.startsWith(href + '/')
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            }
            // Locked (free/Starter/Growth) — show upgrade prompt
            if (analyticsEnabled) return null;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setUpgradeReason(reason)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-50 w-full text-left transition-colors"
                title={`${label} — requires Scale plan`}
              >
                <Icon size={18} className="opacity-50" />
                <span className="flex-1">{label}</span>
                <Lock size={13} className="opacity-40" />
              </button>
            );
          })}

          <div className="pt-4 pb-1">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</p>
          </div>
          {settingsNav.map(({ href, label, icon }) => {
            const isCompliance = icon === 'shield';
            const isAgent = icon === 'sparkles';
            const isSupport = icon === 'lifebuoy';
            const NavIcon = isCompliance ? Shield : isAgent ? Sparkles : isSupport ? LifeBuoy : Settings;
            const showBadge = isCompliance && showComplianceBadge;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <NavIcon size={16} className="opacity-60 shrink-0" />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                    title="Business Associate Agreement not yet signed"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Usage widget */}
        {!loading && (
          <div className="mx-3 mb-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', PLAN_COLORS[plan] ?? PLAN_COLORS['trial'])}>
                {PLAN_LABELS[plan] ?? plan}
              </span>
              {isHighUsage && (
                <Link href="/billing" className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Zap size={11} /> Upgrade
                </Link>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>AI Minutes</span>
              <span>{minutesUsed} / {minutesIncluded}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={clsx('h-1.5 rounded-full transition-all', isHighUsage ? 'bg-amber-500' : 'bg-brand-500')}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>

            {/* Persistent upgrade CTA for trial/starter */}
            {showUpgradeCta && (
              <Link
                href="/billing"
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
              >
                <Zap size={11} /> Upgrade plan →
              </Link>
            )}
          </div>
        )}

        {/* User / logout */}
        <div className="border-t border-gray-100 px-3 py-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
