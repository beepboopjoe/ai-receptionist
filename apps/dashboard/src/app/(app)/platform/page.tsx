'use client';
// ============================================================
// /platform — Platform Admin dashboard.
//
// Reserved for emails in the API's ADMIN_EMAILS env var. Lets the
// founder reach across all tenants: search, view stats, grant
// promo trials, revoke them. The page itself doesn't enforce auth;
// every API call is gated server-side by requirePlatformAdmin.
// If the caller isn't allowed, the API returns 401 and we render
// an empty-state.
// ============================================================
import { useState } from 'react';
import useSWR from 'swr';
import {
  Sparkles,
  Search,
  Users,
  DollarSign,
  TrendingUp,
  Phone,
  Shield,
  X,
  CheckCircle,
  Loader2,
  LifeBuoy,
  Bug,
  MessageSquare,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Mail,
  Clock,
  RotateCcw,
  Ban,
  PlayCircle,
  Trash2,
  AlertTriangle,
  MoreVertical,
} from 'lucide-react';
import { platformApi, type PlatformTenant, type AdminSupportTicket, type SupportCategory, type SupportStatus } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const PLAN_OPTIONS = ['growth', 'scale', 'business', 'enterprise'] as const;

export default function PlatformAdminPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'created_desc' | 'minutes_desc' | 'name_asc'>('created_desc');
  const [grantModalTenant, setGrantModalTenant] = useState<PlatformTenant | null>(null);
  const [deleteModalTenant, setDeleteModalTenant] = useState<PlatformTenant | null>(null);

  const { data: whoamiData, isLoading: whoamiLoading } = useSWR('platform-whoami', () =>
    platformApi.whoami()
  );
  const isPlatformAdmin = Boolean(whoamiData?.ok);

  const { data: stats } = useSWR(
    isPlatformAdmin ? 'platform-stats' : null,
    () => platformApi.stats()
  );

  const { data: tenantsData, mutate: refetchTenants } = useSWR(
    isPlatformAdmin ? ['platform-tenants', search, sort] : null,
    () => platformApi.listTenants(search, sort)
  );

  if (whoamiLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <Shield size={40} className="mx-auto text-gray-400 mb-4" />
        <h1 className="font-serif text-2xl text-gray-900">Platform admin only</h1>
        <p className="text-gray-600 mt-2 text-sm">
          This page is reserved for the platform owner. If you should have access, ask
          for your email to be added to ADMIN_EMAILS on the API.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
          <Shield size={22} className="text-white" />
        </div>
        <div>
          <h1 className="font-serif text-3xl text-gray-900 tracking-tight">Platform Admin</h1>
          <p className="text-gray-600 mt-1">
            Every tenant on the platform. Grant promo trials, view usage, monitor signups.
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="MRR"
          value={stats ? `$${(stats.mrrCents / 100).toLocaleString()}` : '—'}
          sub={stats ? `${stats.activeTenants} active tenants` : ''}
        />
        <StatCard
          icon={Users}
          label="Total tenants"
          value={stats?.totalTenants ?? '—'}
          sub={stats ? `${stats.promoTenants} on promo trial` : ''}
        />
        <StatCard
          icon={TrendingUp}
          label="Signups · 7d / 30d"
          value={stats ? `${stats.signups7d} / ${stats.signups30d}` : '—'}
          sub={stats ? `${stats.churnedRecently} churned` : ''}
        />
        <StatCard
          icon={Phone}
          label="Minutes this month"
          value={stats?.platformMinutesThisMonth?.toLocaleString() ?? '—'}
          sub={stats ? `${stats.platformCallsThisMonth.toLocaleString()} calls` : ''}
        />
      </div>

      {/* Tenants table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-gray-900">Tenants</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, slug, or owner email"
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-brand-500 w-72"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-brand-500"
            >
              <option value="created_desc">Newest first</option>
              <option value="name_asc">Name A→Z</option>
              <option value="minutes_desc">Most minutes</option>
            </select>
          </div>
        </div>

        {!tenantsData ? (
          <div className="px-6 py-12 text-center">
            <Loader2 size={20} className="mx-auto animate-spin text-gray-400" />
          </div>
        ) : tenantsData.data.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {search ? `No tenants match "${search}"` : 'No tenants yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Tenant</th>
                  <th className="px-3 py-3 text-left font-semibold">Plan</th>
                  <th className="px-3 py-3 text-left font-semibold">Minutes</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenantsData.data.map((t) => (
                  <TenantRow
                    key={t.id}
                    tenant={t}
                    onGrant={() => setGrantModalTenant(t)}
                    onRevoke={async () => {
                      try {
                        await platformApi.revokePromoTrial(t.id);
                        toast.success(`Revoked promo trial for ${t.name}`);
                        await refetchTenants();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Revoke failed');
                      }
                    }}
                    onSuspend={async () => {
                      if (!window.confirm(
                        `Suspend "${t.name}"?\n\nThis blocks dashboard login and incoming calls. Their Stripe subscription will be canceled at period end. You can reactivate later.`
                      )) return;
                      try {
                        const res = await platformApi.suspendTenant(t.id);
                        if (res.stripeError) {
                          toast.info(`Suspended ${t.name} · Stripe cancel failed: ${res.stripeError}`);
                        } else {
                          toast.success(`Suspended ${t.name}${res.stripeCanceledAtPeriodEnd ? ' · Stripe canceled at period end' : ''}`);
                        }
                        await refetchTenants();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Suspend failed');
                      }
                    }}
                    onReactivate={async () => {
                      try {
                        await platformApi.reactivateTenant(t.id);
                        toast.success(`Reactivated ${t.name}`);
                        await refetchTenants();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Reactivate failed');
                      }
                    }}
                    onDelete={() => setDeleteModalTenant(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Support tickets queue */}
      <SupportTicketsSection />

      {/* Grant Promo Trial modal */}
      {grantModalTenant && (
        <GrantTrialModal
          tenant={grantModalTenant}
          onClose={() => setGrantModalTenant(null)}
          onGranted={async () => {
            setGrantModalTenant(null);
            await refetchTenants();
          }}
        />
      )}

      {/* Delete Tenant modal — typed-name confirmation guard */}
      {deleteModalTenant && (
        <DeleteTenantModal
          tenant={deleteModalTenant}
          onClose={() => setDeleteModalTenant(null)}
          onDeleted={async () => {
            setDeleteModalTenant(null);
            await refetchTenants();
          }}
        />
      )}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-gray-400" />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="font-serif text-3xl text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Tenant row ─────────────────────────────────────────────────────
function TenantRow({
  tenant,
  onGrant,
  onRevoke,
  onSuspend,
  onReactivate,
  onDelete,
}: {
  tenant: PlatformTenant;
  onGrant: () => void;
  onRevoke: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const created = new Date(tenant.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isSuspended = tenant.subscriptionStatus === 'suspended';
  const minutesPct = tenant.minutesIncluded > 0
    ? Math.min(100, Math.round((tenant.minutesUsed / tenant.minutesIncluded) * 100))
    : 0;
  const minutesColor =
    tenant.capReached
      ? 'bg-red-500'
      : minutesPct >= 80
        ? 'bg-amber-500'
        : 'bg-brand-500';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-3">
        <div className="font-medium text-gray-900">{tenant.name}</div>
        <div className="text-xs text-gray-500 truncate max-w-xs">
          {tenant.ownerEmail ?? `slug: ${tenant.slug}`} · created {created}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-900 capitalize">{tenant.plan}</span>
          {tenant.promoTrial && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
              <Sparkles size={9} /> Promo
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 capitalize">{tenant.vertical.replace('_', ' ')}</div>
      </td>
      <td className="px-3 py-3">
        <div className="text-sm text-gray-900">
          {tenant.minutesUsed} <span className="text-gray-400">/ {tenant.minutesIncluded}</span>
        </div>
        <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
          <div className={`h-full ${minutesColor}`} style={{ width: `${minutesPct}%` }} />
        </div>
      </td>
      <td className="px-3 py-3">
        {isSuspended ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
            <Ban size={10} /> Suspended
          </span>
        ) : tenant.capReached ? (
          <span className="inline-flex text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
            Cap reached
          </span>
        ) : tenant.subscriptionStatus === 'active' ? (
          <span className="inline-flex text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            Active
          </span>
        ) : tenant.subscriptionStatus === 'trialing' ? (
          <span className="inline-flex text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
            Trialing
          </span>
        ) : tenant.isActive ? (
          <span className="inline-flex text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
            {tenant.subscriptionStatus ?? 'no sub'}
          </span>
        ) : (
          <span className="inline-flex text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            Inactive
          </span>
        )}
      </td>
      <td className="px-6 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          {tenant.promoTrial ? (
            <button
              onClick={onRevoke}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              Revoke
            </button>
          ) : (
            <button
              onClick={onGrant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              <Sparkles size={11} /> Grant trial
            </button>
          )}

          {/* Account-lifecycle menu — suspend / reactivate / delete */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Account actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg z-20 overflow-hidden"
              >
                {isSuspended ? (
                  <button
                    role="menuitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      onReactivate();
                    }}
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 text-left"
                  >
                    <PlayCircle size={13} /> Reactivate account
                  </button>
                ) : (
                  <button
                    role="menuitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      onSuspend();
                    }}
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 text-left"
                  >
                    <Ban size={13} /> Suspend account
                  </button>
                )}
                <div className="border-t border-gray-100" />
                <button
                  role="menuitem"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 text-left"
                >
                  <Trash2 size={13} /> Delete account…
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Grant Trial modal ──────────────────────────────────────────────
function GrantTrialModal({
  tenant,
  onClose,
  onGranted,
}: {
  tenant: PlatformTenant;
  onClose: () => void;
  onGranted: () => void;
}) {
  const toast = useToast();
  const [plan, setPlan] = useState<(typeof PLAN_OPTIONS)[number]>('scale');
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);

  async function handleGrant() {
    setBusy(true);
    try {
      await platformApi.grantPromoTrial(tenant.id, plan, minutes);
      toast.success(`Granted ${minutes}-minute ${plan} trial to ${tenant.name}`);
      onGranted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Grant failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">Grant promo trial</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">{tenant.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {tenant.ownerEmail ?? `slug: ${tenant.slug}`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
              Plan tier (features unlocked)
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                    plan === p
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
              Minute cap
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={10000}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-sm text-gray-500">minutes total</span>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[30, 60, 120, 250].map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className="text-xs px-2 py-1 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-xs text-indigo-800">
            They&apos;ll see a promo-trial banner on their dashboard. Calls hard-stop when
            they hit the cap. You can revoke at any time.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleGrant}
            disabled={busy || !minutes}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Granting…
              </>
            ) : (
              <>
                <CheckCircle size={13} /> Grant trial
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Tenant modal — typed-name confirmation guard ──────────
// Hard delete cascades all tenant data via FK constraints and cancels
// the Stripe subscription immediately. The typed-name guard mirrors
// GitHub/Stripe's "type X to confirm" deletion UX.
function DeleteTenantModal({
  tenant,
  onClose,
  onDeleted,
}: {
  tenant: PlatformTenant;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = confirmName.trim() === tenant.name;

  async function handleDelete() {
    if (!matches) return;
    setBusy(true);
    try {
      const res = await platformApi.deleteTenant(tenant.id, confirmName.trim());
      if (res.stripeError) {
        toast.info(`Deleted ${tenant.name} · Stripe cancel failed: ${res.stripeError}. Cancel manually in Stripe Dashboard.`);
      } else {
        toast.success(`Deleted ${tenant.name}${res.stripeCanceled ? ' · Stripe subscription canceled' : ''}`);
      }
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle size={15} className="text-red-700" />
            </div>
            <h3 className="font-semibold text-gray-900">Delete tenant</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900 space-y-2">
            <p className="font-semibold">This cannot be undone.</p>
            <p>
              All calls, contacts, appointments, campaigns, knowledge-base
              documents, phone numbers, and API keys for{' '}
              <span className="font-semibold">{tenant.name}</span> will be
              permanently deleted. The Stripe subscription will be canceled
              immediately (no refund).
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">Tenant</p>
            <p className="font-medium text-gray-900">{tenant.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {tenant.ownerEmail ?? `slug: ${tenant.slug}`} · plan: {tenant.plan}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
              Type the tenant name to confirm
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={tenant.name}
              autoFocus
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none ${
                matches
                  ? 'border-red-500 bg-red-50/50'
                  : 'border-gray-200 focus:border-red-500'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Must match exactly: <code className="font-mono text-gray-700">{tenant.name}</code>
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={busy || !matches}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 size={13} /> Permanently delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Support tickets section (cross-tenant queue for platform admin) ──
const CAT_META: Record<SupportCategory, { label: string; color: string; icon: React.ElementType }> = {
  bug:             { label: 'Bug',             color: 'bg-red-50 text-red-700 border-red-200',     icon: Bug },
  question:        { label: 'Question',        color: 'bg-blue-50 text-blue-700 border-blue-200',  icon: MessageSquare },
  billing:         { label: 'Billing',         color: 'bg-amber-50 text-amber-800 border-amber-200', icon: CreditCard },
  feature_request: { label: 'Feature Request', color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Sparkles },
};

function SupportTicketsSection() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<SupportStatus | 'all'>('open');
  const [categoryFilter, setCategoryFilter] = useState<SupportCategory | 'all'>('all');

  const { data, mutate: refetch, isLoading } = useSWR(
    ['platform-tickets', statusFilter, categoryFilter],
    () =>
      platformApi.listTickets({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      })
  );
  const tickets = data?.data ?? [];

  async function handleResolve(id: string, subject: string) {
    try {
      await platformApi.resolveTicket(id);
      toast.success(`Marked resolved: ${subject}`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resolve');
    }
  }

  async function handleReopen(id: string, subject: string) {
    try {
      await platformApi.reopenTicket(id);
      toast.info(`Reopened: ${subject}`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reopen');
    }
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LifeBuoy size={16} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900">Support tickets</h2>
          <span className="text-xs text-gray-400">· last {tickets.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status pills */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-200 p-0.5">
            {(['open', 'all', 'resolved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                  statusFilter === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Category dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as SupportCategory | 'all')}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All categories</option>
            <option value="bug">Bug</option>
            <option value="question">Question</option>
            <option value="billing">Billing</option>
            <option value="feature_request">Feature Request</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-12 text-center">
          <Loader2 size={20} className="mx-auto animate-spin text-gray-400" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-500">
          {statusFilter === 'open' ? "No open tickets — you're all caught up." : 'No tickets match these filters.'}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {tickets.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              onResolve={() => handleResolve(t.id, t.subject)}
              onReopen={() => handleReopen(t.id, t.subject)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  onResolve,
  onReopen,
}: {
  ticket: AdminSupportTicket;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CAT_META[ticket.category];
  const CatIcon = cat.icon;
  const created = new Date(ticket.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const mailto = `mailto:${ticket.submitterEmail}?subject=Re:%20${encodeURIComponent(ticket.subject)}`;

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-gray-400 hover:text-gray-700"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-full ${cat.color}`}>
              <CatIcon size={9} /> {cat.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              ticket.status === 'resolved'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-indigo-50 text-indigo-700'
            }`}>
              {ticket.status === 'resolved' ? <CheckCircle size={9} /> : <Clock size={9} />}
              {ticket.status}
            </span>
            <span className="text-[10px] text-gray-400">{created}</span>
          </div>
          <p
            className="text-sm font-semibold text-gray-900 truncate cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
          >
            {ticket.subject}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-medium text-gray-700">{ticket.tenantName}</span>
            {' · '}
            {ticket.submitterName ? `${ticket.submitterName} ` : ''}
            <span className="text-gray-400">&lt;{ticket.submitterEmail}&gt;</span>
          </p>
          {!expanded && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">{ticket.message}</p>
          )}
          {expanded && (
            <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ticket.message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={mailto}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors"
            title="Reply via email"
          >
            <Mail size={12} /> Reply
          </a>
          {ticket.status === 'open' ? (
            <button
              onClick={onResolve}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              <CheckCircle size={12} /> Resolve
            </button>
          ) : (
            <button
              onClick={onReopen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 text-xs font-semibold transition-colors"
              title="Reopen"
            >
              <RotateCcw size={12} /> Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
