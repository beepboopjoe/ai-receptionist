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
  CreditCard,
  Zap,
  BarChart2,
  Building2,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { logout } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { usePlan } from '@/lib/usePlan';
import { useFeatureFlags } from '@/lib/featureFlags';
import { useVertical } from '@/lib/useVertical';
import { BRAND_NAME } from '@/lib/brand';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import type { UpgradeReason } from '@/components/ui/upgrade-modal';

function buildNav(contactsLabel: string, appointmentsLabel: string) {
  return [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/calls', label: 'Call Log', icon: Phone },
    { href: '/appointments', label: appointmentsLabel, icon: Calendar },
    { href: '/patients', label: contactsLabel, icon: Users },
    { href: '/missed-calls', label: 'Missed Calls', icon: PhoneMissed },
    { href: '/reminders', label: 'Reminders', icon: Bell },
    { href: '/escalations', label: 'Escalations', icon: AlertCircle },
    { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { href: '/billing', label: 'Billing', icon: CreditCard },
  ];
}

// Pro-locked nav entries (rendered greyed out with lock icon)
const proNavItems: { label: string; icon: React.ElementType; reason: UpgradeReason }[] = [
  { label: 'Analytics', icon: BarChart2, reason: 'pro_analytics' },
  { label: 'Multi-location', icon: Building2, reason: 'multi_location' },
];

const settingsNav = [
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/office-hours', label: 'Office Hours' },
  { href: '/settings/voice-agent', label: 'Voice Agent' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/webhooks', label: 'Webhooks' },
  { href: '/settings/api-keys', label: 'API Keys' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/audit-log', label: 'Audit Log' },
];

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
};

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-50 text-blue-700',
  growth: 'bg-brand-50 text-brand-700',
  pro: 'bg-purple-50 text-purple-700',
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
            <kbd className="text-[10px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => (
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
              {label}
            </Link>
          ))}

          {/* Pro-locked nav items */}
          {proNavItems.map(({ label, icon: Icon, reason }) =>
            analyticsEnabled ? null : (
              <button
                key={label}
                type="button"
                onClick={() => setUpgradeReason(reason)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-50 w-full text-left transition-colors"
                title={`${label} — requires Pro plan`}
              >
                <Icon size={18} className="opacity-50" />
                <span className="flex-1">{label}</span>
                <Lock size={13} className="opacity-40" />
              </button>
            )
          )}

          <div className="pt-4 pb-1">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</p>
          </div>
          {settingsNav.map(({ href, label }) => (
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
              <Settings size={16} className="opacity-60" />
              {label}
            </Link>
          ))}
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
