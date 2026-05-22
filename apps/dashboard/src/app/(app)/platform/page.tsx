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
} from 'lucide-react';
import { platformApi, type PlatformTenant } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const PLAN_OPTIONS = ['starter', 'growth', 'scale', 'enterprise'] as const;

export default function PlatformAdminPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'created_desc' | 'minutes_desc' | 'name_asc'>('created_desc');
  const [grantModalTenant, setGrantModalTenant] = useState<PlatformTenant | null>(null);

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
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
}: {
  tenant: PlatformTenant;
  onGrant: () => void;
  onRevoke: () => void;
}) {
  const created = new Date(tenant.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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
        {tenant.capReached ? (
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
