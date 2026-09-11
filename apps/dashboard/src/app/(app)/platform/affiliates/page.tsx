'use client';
// ============================================================
// /platform/affiliates — Affiliate v1 (lean referrals).
//
// Create partners, copy tracked links, see attributed tenants and
// paid conversions, mark payouts paid. Gated by ADMIN_EMAILS.
// White-label / partner portal is out of scope for this page.
// ============================================================
import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Shield,
  Loader2,
  Plus,
  Copy,
  CheckCircle,
  DollarSign,
  Users,
  Link2,
  Handshake,
} from 'lucide-react';
import {
  platformApi,
  type PlatformAffiliate,
  type PlatformAffiliateDetail,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PlatformAffiliatesPage() {
  const toast = useToast();
  const { data: whoamiData, isLoading: whoamiLoading } = useSWR('platform-whoami', () =>
    platformApi.whoami()
  );
  const isPlatformAdmin = Boolean(whoamiData?.ok);

  const { data, error, isLoading, mutate } = useSWR(
    isPlatformAdmin ? 'platform-affiliates' : null,
    () => platformApi.listAffiliates()
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const rows = data?.data ?? [];
  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId]
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
      <EmptyState
        icon={Shield}
        label="Platform admin only"
        hint="This page is reserved for the platform owner. Add your email to ADMIN_EMAILS on the API."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
            <Handshake size={22} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-600 mb-1">
              <Link href="/platform" className="hover:underline">
                Platform Admin
              </Link>
              <span className="text-gray-400"> / </span>
              Affiliates
            </p>
            <h1 className="font-serif text-3xl text-gray-900 tracking-tight">Affiliates</h1>
            <p className="text-gray-600 mt-1 max-w-xl">
              Lean referral tracking — unique codes, attributed signups, commissions on paid
              Stripe invoices. Default is 20% of the first 12 months. Not a partner portal.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5"
        >
          <Plus size={16} /> New affiliate
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Couldn&apos;t load affiliates. {error instanceof Error ? error.message : ''}
        </div>
      ) : null}

      {showCreate && (
        <CreateAffiliateForm
          onCancel={() => setShowCreate(false)}
          onCreated={async (created) => {
            setShowCreate(false);
            await mutate();
            setSelectedId(created.id);
            toast.success(`Created ${created.name} (${created.code})`);
          }}
        />
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
        <div className="card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Partners</h2>
            <p className="text-xs text-gray-500 mt-0.5">Codes, links, referred tenants, pending payout.</p>
          </div>
          {isLoading && !data ? (
            <div className="divide-y divide-gray-50">
              <ListRowSkeleton />
              <ListRowSkeleton />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              icon={Handshake}
              label="No affiliates yet"
              hint="Create a partner, copy /?ref=CODE or /r/CODE, and send it."
            />
          ) : (
            <ul className="divide-y divide-gray-50">
              {rows.map((row) => {
                const active = (selected?.id ?? null) === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full text-left px-4 sm:px-6 py-4 transition-colors ${
                        active ? 'bg-indigo-50/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{row.name}</p>
                          <p className="text-xs text-gray-500 truncate">{row.email}</p>
                          <p className="mt-1 font-mono text-xs text-indigo-700">{row.code}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {dollars(row.pendingCommissionCents)}
                          </p>
                          <p className="text-[11px] text-gray-500">pending</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {row.referredTenants} referred
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <AffiliateDetail
            key={selected.id}
            affiliate={selected}
            onPaid={async () => {
              await mutate();
              toast.success('Marked paid');
            }}
          />
        ) : (
          <div className="card">
            <EmptyState compact icon={Link2} label="Select an affiliate" hint="Or create one to get a tracked link." />
          </div>
        )}
      </div>
    </div>
  );
}

function CreateAffiliateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (row: PlatformAffiliate) => void | Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [commissionPct, setCommissionPct] = useState('20');
  const [commissionMonths, setCommissionMonths] = useState('12');
  const [bounty, setBounty] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const pct = Number(commissionPct);
      const months = Number(commissionMonths);
      const bountyDollars = bounty.trim() === '' ? null : Number(bounty);
      const created = await platformApi.createAffiliate({
        name,
        email,
        ...(code.trim() ? { code: code.trim() } : {}),
        commissionPct: Number.isFinite(pct) ? pct : 20,
        commissionMonths: Number.isFinite(months) ? months : 12,
        ...(bountyDollars !== null && Number.isFinite(bountyDollars)
          ? { flatBountyCents: Math.round(bountyDollars * 100) }
          : {}),
      });
      await onCreated(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create affiliate');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6 space-y-4">
      <h2 className="font-semibold text-gray-900">New affiliate</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
            placeholder="Acme Agency"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
            placeholder="partner@example.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Referral code (optional)</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm font-mono uppercase"
            placeholder="Auto-generated if blank"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Commission %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={commissionPct}
            onChange={(e) => setCommissionPct(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Months (0 = lifetime)</span>
          <input
            type="number"
            min={0}
            max={120}
            step={1}
            value={commissionMonths}
            onChange={(e) => setCommissionMonths(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Flat bounty $ (optional)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={bounty}
            onChange={(e) => setBounty(e.target.value)}
            className="mt-1 w-full rounded-lg border-gray-300 text-sm"
            placeholder="First paid conversion only"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 px-3 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

function AffiliateDetail({
  affiliate,
  onPaid,
}: {
  affiliate: PlatformAffiliate;
  onPaid: () => void | Promise<void>;
}) {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR(['platform-affiliate', affiliate.id], () =>
    platformApi.getAffiliate(affiliate.id)
  );

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  }

  const detail: PlatformAffiliateDetail | undefined = data;
  const payoutLabel =
    affiliate.flatBountyCents && affiliate.flatBountyCents > 0
      ? `${dollars(affiliate.flatBountyCents)} first paid + ${affiliate.commissionPct}% after`
      : `${affiliate.commissionPct}% of paid invoices`;
  const windowLabel =
    affiliate.commissionMonths === 0 ? 'lifetime' : `first ${affiliate.commissionMonths} months`;

  return (
    <div className="space-y-4">
      <div className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">{affiliate.name}</h2>
          <p className="text-sm text-gray-500">{affiliate.email}</p>
          <p className="text-xs text-gray-500 mt-1">
            {payoutLabel} · {windowLabel}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <CopyRow label="Tracked link" value={affiliate.refUrl} onCopy={() => copy(affiliate.refUrl, 'Link')} />
          <CopyRow label="Short link" value={affiliate.shortUrl} onCopy={() => copy(affiliate.shortUrl, 'Short link')} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <StatChip icon={Users} label="Referred" value={String(detail?.stats.referredTenants ?? affiliate.referredTenants)} />
          <StatChip icon={DollarSign} label="Pending" value={dollars(detail?.stats.pendingCommissionCents ?? affiliate.pendingCommissionCents)} />
          <StatChip icon={CheckCircle} label="Paid out" value={dollars(detail?.stats.paidOutCommissionCents ?? affiliate.paidOutCommissionCents)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Referred tenants</h3>
        </div>
        {isLoading && !detail ? (
          <ListRowSkeleton />
        ) : (detail?.referredTenants.length ?? 0) === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">No attributed signups yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {detail!.referredTenants.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-500 truncate">{t.ownerEmail ?? t.id}</p>
                </div>
                <p className="text-xs text-gray-500 shrink-0">{t.plan}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Conversions</h3>
          <p className="text-[11px] text-gray-500">
            Recorded on Stripe invoice.paid when amount_paid &gt; 0 (not $0 trial invoices).
          </p>
        </div>
        {isLoading && !detail ? (
          <ListRowSkeleton />
        ) : (detail?.events.length ?? 0) === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">No paid conversions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {detail!.events.map((ev) => (
              <li key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{dollars(ev.commissionCents)}</p>
                  <p className="text-xs text-gray-500 truncate">
                    Invoice {ev.stripeInvoiceId} · {dollars(ev.invoiceAmountCents)} paid
                  </p>
                </div>
                {ev.payoutStatus === 'paid_out' ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                    Paid
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-700 hover:underline"
                    onClick={async () => {
                      try {
                        await platformApi.markCommissionPaid(ev.id);
                        await mutate();
                        await onPaid();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Could not mark paid');
                      }
                    }}
                  >
                    Mark paid
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <p className="text-xs font-mono text-gray-800 truncate flex-1">{value}</p>
        <button type="button" onClick={onCopy} className="text-gray-500 hover:text-gray-800" aria-label={`Copy ${label}`}>
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-2">
      <Icon size={14} className="mx-auto text-indigo-500 mb-1" />
      <p className="text-sm font-semibold text-gray-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
