'use client';
// ============================================================
// Settings → Phone Numbers.
//
// Lets owners + admins:
//   - See the numbers their tenant owns
//   - Buy a new local or toll-free number via Telnyx (included plan
//     slots are free; extras are a recurring Stripe add-on)
//   - Release a number (deletes from Telnyx + soft-deletes locally)
// ============================================================
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { phoneNumbersApi, outboundPoolApi, type AvailableNumber, type OwnedNumber, type PortRequestRow } from '@/lib/api';
import { Phone, Search, Trash2, Star, X, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Zap, Shield, BarChart2, MapPin, Layers } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton as UiSkeleton } from '@/components/ui/skeleton';
import { ForwardYourLineCard } from '@/components/settings/forward-your-line-card';
import { InboundRoutingCard } from '@/components/settings/inbound-routing-card';
import { BRAND_NAME } from '@/lib/brand';

function formatNumber(e164: string): string {
  if (!e164 || e164 === 'pending') return 'Number pending';
  // +14155551234 → +1 (415) 555-1234
  const m = /^\+(\d{1,3})(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function dollarsShort(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : dollars(cents);
}

function ProvisionBadge({ status }: { status: 'provisioning' | 'active' | 'failed' }) {
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
        Failed
      </span>
    );
  }
  if (status === 'provisioning') {
    return (
      <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
        Provisioning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
      Active
    </span>
  );
}

export default function PhoneNumbersPage() {
  const toast = useToast();
  const { data, isLoading } = useSWR('phone-numbers', () => phoneNumbersApi.list());
  const owned = data?.data ?? [];

  // Auto-managed rotating outbound campaign numbers (read-only).
  const { data: poolData, isLoading: poolLoading } = useSWR('outbound-pool-numbers', () =>
    outboundPoolApi.list()
  );
  const poolNumbers = poolData?.data ?? [];

  // Active per-month rates. Promo-trial tenants get wholesale Telnyx
  // rates ($1 / $2); everyone else gets the retail $5 / $10.
  const { data: pricing } = useSWR('phone-numbers-pricing', () =>
    phoneNumbersApi.pricing()
  );
  const localCents = pricing?.localCents ?? 500;
  const tollFreeCents = pricing?.tollFreeCents ?? 1000;
  const isPromoPricing = pricing?.isPromoPricing ?? false;
  const includedPhoneNumbers = pricing?.includedPhoneNumbers;
  const usedCount = pricing?.usedCount ?? owned.length;
  const planName = pricing?.planName ?? 'your plan';
  const extrasLabel = `${dollarsShort(localCents)}/${dollarsShort(tollFreeCents)}/mo`;
  const allotmentLabel = !pricing
    ? 'Checking your plan allotment…'
    : includedPhoneNumbers! < 0
      ? `Unlimited included on ${planName} · extras ${extrasLabel}`
      : `${usedCount} of ${includedPhoneNumbers} included on ${planName} · extras ${extrasLabel}`;
  // Optimistic: don't confirm a charge until we know the slot is extra.
  const nextIsIncluded =
    !pricing || includedPhoneNumbers! < 0 || usedCount < includedPhoneNumbers!;
  const costFor = (t: 'local' | 'toll_free') =>
    t === 'toll_free' ? tollFreeCents : localCents;
  const buyLabelFor = (t: 'local' | 'toll_free') =>
    nextIsIncluded ? 'Add (included)' : `Buy ${dollars(costFor(t))}/mo`;
  const addNumberCta = nextIsIncluded ? 'Add a number' : 'Buy a number';
  const addNumberTitle = nextIsIncluded
    ? `Your next number is included on ${planName} — no extra charge`
    : `Extra numbers bill at ${extrasLabel}`;

  const [searchOpen, setSearchOpen] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [type, setType] = useState<'local' | 'toll_free'>('local');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [purchasingE164, setPurchasingE164] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [autoProvisioning, setAutoProvisioning] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingPool, setRetryingPool] = useState(false);

  // Port-in flow
  const { data: portsData } = useSWR('phone-port-requests', () => phoneNumbersApi.listPortRequests());
  const portRequests = portsData?.data ?? [];
  const [whyOpen, setWhyOpen] = useState(false);
  const [portOpen, setPortOpen] = useState(false);
  const [portSubmitting, setPortSubmitting] = useState(false);
  const [portForm, setPortForm] = useState({
    phoneE164: '',
    currentCarrier: '',
    accountNumber: '',
    accountPin: '',
    authorizedName: '',
    authorizedTitle: '',
    serviceAddress: '',
    serviceCity: '',
    serviceState: '',
    serviceZip: '',
    desiredCompleteDate: '',
  });

  async function handleSubmitPort() {
    setPortSubmitting(true);
    try {
      await phoneNumbersApi.port({
        phoneE164: portForm.phoneE164,
        currentCarrier: portForm.currentCarrier,
        accountNumber: portForm.accountNumber,
        authorizedName: portForm.authorizedName,
        serviceAddress: portForm.serviceAddress,
        serviceCity: portForm.serviceCity,
        serviceState: portForm.serviceState,
        serviceZip: portForm.serviceZip,
        ...(portForm.accountPin && { accountPin: portForm.accountPin }),
        ...(portForm.authorizedTitle && { authorizedTitle: portForm.authorizedTitle }),
        ...(portForm.desiredCompleteDate && { desiredCompleteDate: portForm.desiredCompleteDate }),
      });
      toast.success("Port request submitted — we'll start the process within 1 business day. Ports typically complete in 5-14 business days.");
      setPortOpen(false);
      setPortForm({
        phoneE164: '',
        currentCarrier: '',
        accountNumber: '',
        accountPin: '',
        authorizedName: '',
        authorizedTitle: '',
        serviceAddress: '',
        serviceCity: '',
        serviceState: '',
        serviceZip: '',
        desiredCompleteDate: '',
      });
      await mutate('phone-port-requests');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Port request failed');
    } finally {
      setPortSubmitting(false);
    }
  }

  async function handleCancelPort(p: PortRequestRow) {
    if (!confirm(`Cancel port request for ${formatNumber(p.phoneE164)}? Once cancelled you'll need to start a new request to port it in.`)) return;
    try {
      await phoneNumbersApi.cancelPortRequest(p.id);
      toast.success('Port request cancelled');
      await mutate('phone-port-requests');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  async function handleSearch() {
    if (type === 'local' && areaCode && !/^\d{3}$/.test(areaCode)) {
      toast.error('Area code must be 3 digits');
      return;
    }
    setSearching(true);
    setResults([]);
    try {
      const res = await phoneNumbersApi.search({
        type,
        ...(type === 'local' && areaCode && { areaCode }),
      });
      setResults(res.data);
      if (res.data.length === 0) {
        toast.info('No numbers available for that filter. Try a different area code.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(number: AvailableNumber) {
    const confirmMsg = nextIsIncluded
      ? `Add ${formatNumber(number.phoneE164)}? Included on ${planName} — no extra charge.`
      : `Buy ${formatNumber(number.phoneE164)} for ${dollars(costFor(number.numberType))}/mo? Extra beyond your ${planName} allotment.`;
    if (!confirm(confirmMsg)) return;
    setPurchasingE164(number.phoneE164);
    try {
      const res = await phoneNumbersApi.purchase(number.phoneE164, number.numberType);
      toast.success(
        res.included
          ? `Purchased ${formatNumber(number.phoneE164)} — included on your plan`
          : res.charged
            ? `Purchased ${formatNumber(number.phoneE164)} — added as a recurring extra`
            : `Purchased ${formatNumber(number.phoneE164)} (billing not attached — we'll add it to your subscription shortly)`
      );
      setSearchOpen(false);
      setResults([]);
      await mutate('phone-numbers');
      await mutate('phone-numbers-pricing');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasingE164(null);
    }
  }

  async function handleRelease(n: OwnedNumber) {
    if (!confirm(`Release ${formatNumber(n.phoneE164)}? This stops billing immediately and you'll lose this number.`)) return;
    setReleasingId(n.id);
    try {
      await phoneNumbersApi.release(n.id);
      toast.success(`Released ${formatNumber(n.phoneE164)}`);
      await mutate('phone-numbers');
      await mutate('phone-numbers-pricing');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Release failed');
    } finally {
      setReleasingId(null);
    }
  }

  async function handleAutoProvision() {
    setAutoProvisioning(true);
    try {
      const result = await phoneNumbersApi.autoProvision();
      if (result.status === 'active' && result.number) {
        toast.success(`Your number is ready: ${formatNumber(result.number.phoneE164)}`);
      } else if (result.status === 'skipped') {
        toast.info('This plan does not include a dedicated inbound number. Subscribe to Growth or higher, or buy a number below.');
      } else {
        toast.error(result.reason ?? 'Telnyx order failed — tap Retry');
      }
      await mutate('phone-numbers');
      await mutate('phone-numbers-pricing');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-provision failed');
    } finally {
      setAutoProvisioning(false);
    }
  }

  async function handleRetry(n: OwnedNumber) {
    setRetryingId(n.id);
    try {
      const result = await phoneNumbersApi.retry(n.id);
      if (result.status === 'active' && result.number) {
        toast.success(`Number ready: ${formatNumber(result.number.phoneE164)}`);
      } else {
        toast.error(result.reason ?? 'Retry failed');
      }
      await mutate('phone-numbers');
      await mutate('phone-numbers-pricing');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  }

  async function handleRetryPool() {
    setRetryingPool(true);
    try {
      await outboundPoolApi.retry();
      toast.success('Outbound pool refreshed');
      await mutate('outbound-pool-numbers');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pool retry failed');
    } finally {
      setRetryingPool(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Your numbers</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Paid go-live auto-assigns a {BRAND_NAME} inbound DID. Forward your existing business
            line to it. {allotmentLabel} Outbound campaign numbers stay auto-managed.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSearchOpen(true)}
            className={`${nextIsIncluded ? 'btn-secondary' : 'btn-primary'} inline-flex items-center gap-2 text-sm`}
            title={addNumberTitle}
          >
            <Phone size={14} /> {addNumberCta}
          </button>
          <button
            onClick={handleAutoProvision}
            disabled={autoProvisioning}
            className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-60"
            title="Order a US inbound DID via Telnyx and assign it to this tenant"
          >
            <Zap size={14} /> {autoProvisioning ? 'Provisioning…' : 'Get my number'}
          </button>
        </div>
      </div>

      {/* ── Plan allotment (included slots first) ─────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">{allotmentLabel}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {nextIsIncluded
            ? `Your next number is included on ${planName} — no extra charge.`
            : `Your next number is an extra (${dollars(localCents)} local / ${dollars(tollFreeCents)} toll-free per month).`}
          {' '}Outbound campaign numbers are auto-managed and do not use these slots.
        </p>
      </div>

      <ForwardYourLineCard
        did={
          owned.find((n) => (n.provisionStatus ?? 'active') === 'active' && n.phoneE164?.startsWith('+'))
            ?.phoneE164 ?? null
        }
      />
      <InboundRoutingCard />

      {/* ── Promo-trial at-cost pricing banner ─────────────────── */}
      {isPromoPricing && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Zap size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                Promo trial · numbers at cost
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                You&apos;re paying our wholesale carrier rate during the trial — {dollars(localCents)}/mo
                local, {dollars(tollFreeCents)}/mo toll-free. Standard rates ({dollars(500)} / {dollars(1000)})
                apply once you subscribe.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Why multiple numbers? education panel ─────────────── */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setWhyOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <Zap size={14} className="text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Why get more than one number?</p>
              <p className="text-xs text-gray-500 mt-0.5">More numbers = local presence, SMS, and callbacks — not extra seats</p>
            </div>
          </div>
          {whyOpen
            ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
            : <ChevronDown size={16} className="text-gray-400 shrink-0" />
          }
        </button>

        {whyOpen && (
          <div className="border-t border-gray-100 px-5 py-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Layers,
                title: 'Cover busy periods without extra seats',
                body: 'Your plan is AI minutes and included numbers — not concurrent seats. Extra local numbers give you local presence, SMS, and callbacks. Busy-period volume is billed in AI minutes.',
                highlight: 'Usage billed in AI minutes',
              },
              {
                icon: Shield,
                title: 'Your main number stays protected',
                body: 'Outbound campaigns never dial from your inbound number. The platform automatically provisions and rotates a separate pool of campaign numbers (see below), so your primary number stays clean and trusted with carriers.',
                highlight: 'Campaign numbers are auto-managed — free',
              },
              {
                icon: MapPin,
                title: 'Match local area codes',
                body: 'Calls from a local area code have a 68% higher answer rate than unknown or out-of-state numbers. Add a local number for each market you serve.',
                highlight: '68% higher pickup rate with matching area code',
              },
              {
                icon: BarChart2,
                title: 'Track performance by number',
                body: 'Assign different numbers to different channels (Google Ads, Facebook, website). Your call log shows exactly which source drove each call so you can measure real ROI.',
                highlight: 'Call-tracking without any extra tool',
              },
              {
                icon: Phone,
                title: 'Route by department',
                body: 'One number for scheduling, one for billing inquiries, one for emergencies. The AI handles each with its own script and escalation rules — without needing a full phone tree.',
                highlight: 'Per-number voice agent configuration',
              },
              {
                icon: Star,
                title: 'Toll-free builds credibility',
                body: 'An 800 or 888 number signals an established business. Use it for marketing materials and leave local numbers for patient callbacks — combining reach with personal touch.',
                highlight: `${dollars(tollFreeCents)}/mo — no per-minute extra`,
              },
            ].map(({ icon: Icon, title, body, highlight }) => (
              <div key={title} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-brand-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                  <Zap size={9} /> {highlight}
                </div>
              </div>
            ))}

            <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-xl border border-brand-100 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{allotmentLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">Included slots are free. Extras are added as a recurring line on your subscription — cancel any time from this page.</p>
              </div>
              <button
                onClick={() => { setWhyOpen(false); setSearchOpen(true); }}
                className={`${nextIsIncluded ? 'btn-secondary' : 'btn-primary'} inline-flex items-center gap-2 text-sm shrink-0`}
                title={addNumberTitle}
              >
                <Phone size={14} /> {addNumberCta}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Port requests in progress */}
      {portRequests.length > 0 && (
        <div className="card divide-y divide-gray-100">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Port requests</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ports typically complete in 5-14 business days. Your existing carrier keeps the number active until the port finishes.</p>
          </div>
          {portRequests.map((p) => {
            const statusColor =
              p.status === 'completed' ? 'text-green-700 bg-green-50 border-green-200'
              : p.status === 'failed' ? 'text-red-700 bg-red-50 border-red-200'
              : p.status === 'cancelled' ? 'text-gray-600 bg-gray-50 border-gray-200'
              : 'text-amber-700 bg-amber-50 border-amber-200';
            const Icon =
              p.status === 'completed' ? CheckCircle
              : p.status === 'failed' ? AlertCircle
              : Clock;
            return (
              <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={18} className="text-brand-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{formatNumber(p.phoneE164)}</p>
                    <p className="text-xs text-gray-500">
                      From {p.currentCarrier} · Submitted {new Date(p.createdAt).toLocaleDateString()}
                      {p.rejectionReason ? ` · ${p.rejectionReason}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full border ${statusColor}`}>
                    {p.status.replace(/_/g, ' ')}
                  </span>
                  {(p.status === 'pending' || p.status === 'submitted') && (
                    <button
                      onClick={() => handleCancelPort(p)}
                      className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Cancel port request"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="card p-6 space-y-3">
          <UiSkeleton width="w-full" height="h-12" />
          <UiSkeleton width="w-full" height="h-12" />
        </div>
      ) : owned.length === 0 ? (
        <EmptyState
          icon={Phone}
          label="No numbers yet"
          hint="Paid plans auto-assign an included inbound DID on go-live. Trial does not include one — subscribe or buy a number here. Forward your existing line to the DID; porting is optional later."
          cta={{ label: autoProvisioning ? 'Provisioning…' : 'Get my number', onClick: handleAutoProvision }}
        />
      ) : (
        <div className="card divide-y divide-gray-100">
          {owned.map((n) => (
            <div key={n.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-brand-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{formatNumber(n.phoneE164)}</p>
                  <p className="text-xs text-gray-500">
                    {n.numberType === 'toll_free' ? 'Toll-free' : 'Local'}
                    {n.region ? ` · ${n.region}` : ''}
                    {n.monthlyCostCents > 0 ? ` · ${dollars(n.monthlyCostCents)}/mo` : ' · Included'}
                  </p>
                  {n.provisionStatus === 'failed' && n.provisionError && (
                    <p className="text-xs text-red-600 mt-0.5 truncate">{n.provisionError}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ProvisionBadge status={n.provisionStatus ?? 'active'} />
                {n.isPrimary && n.provisionStatus !== 'failed' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-1 rounded-full">
                    <Star size={11} /> Primary
                  </span>
                )}
                {n.provisionStatus === 'failed' && (
                  <button
                    onClick={() => handleRetry(n)}
                    disabled={retryingId === n.id}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-900 px-2 py-1 rounded-lg hover:bg-brand-50 disabled:opacity-50"
                  >
                    {retryingId === n.id ? 'Retrying…' : 'Retry'}
                  </button>
                )}
                <button
                  onClick={() => handleRelease(n)}
                  disabled={releasingId === n.id}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-40 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title="Release number"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-2">
        <p className="text-sm font-semibold text-gray-900">Later · optional — port your existing number</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Porting is not a day-one blocker. Forwarding gets you live today. When you are ready
          (typically 5–14 business days, LOA required), we can move the old number onto {BRAND_NAME}
          so callers see that caller ID on the DID itself.
        </p>
        <button
          type="button"
          onClick={() => setPortOpen(true)}
          className="btn-secondary text-sm"
        >
          Start a port request
        </button>
      </div>

      {/* ── Outbound campaign number pool (auto-managed, read-only) ── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-brand-600 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-900">Outbound campaign numbers</h2>
            </div>
            <button
              type="button"
              onClick={handleRetryPool}
              disabled={retryingPool}
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 disabled:opacity-50"
            >
              {retryingPool ? 'Retrying…' : 'Retry pool'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatically provisioned and rotated by the platform so your campaigns never
            get spam-flagged. Sized automatically, then grown with dial volume (pool max 15).
            Billed through per-minute usage — no separate monthly fee.
          </p>
        </div>
        {poolLoading ? (
          <div className="p-4 space-y-3">
            <UiSkeleton width="w-full" height="h-10" />
            <UiSkeleton width="w-full" height="h-10" />
          </div>
        ) : poolNumbers.length === 0 ? (
          <p className="px-4 py-5 text-sm text-gray-500">
            No campaigns have run yet — numbers are provisioned automatically when you create
            your first outbound campaign.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {poolNumbers.map((n) => (
              <div key={n.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{formatNumber(n.phoneE164)}</p>
                    <p className="text-xs text-gray-500">
                      Local{n.region ? ` · ${n.region}` : ''}
                      {n.lastDialedAt
                        ? ` · Last used ${new Date(n.lastDialedAt).toLocaleDateString()}`
                        : ' · Not used yet'}
                    </p>
                    {n.provisionStatus === 'failed' && n.provisionError && (
                      <p className="text-xs text-red-600 mt-0.5 truncate">{n.provisionError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ProvisionBadge status={n.provisionStatus ?? 'active'} />
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full">
                    <Zap size={11} /> Auto-managed
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search/purchase modal ───────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-cream-900">
                  {nextIsIncluded ? 'Add a phone number' : 'Buy a phone number'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {nextIsIncluded
                    ? `Included on ${planName} — pick a number, no extra charge.`
                    : allotmentLabel}
                </p>
              </div>
              <button onClick={() => setSearchOpen(false)} className="p-1.5 rounded hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 border-b border-gray-200 space-y-3">
              <div className="flex gap-2">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'local' | 'toll_free')}
                  className="form-input text-sm"
                >
                  <option value="local">Local</option>
                  <option value="toll_free">Toll-free</option>
                </select>
                {type === 'local' && (
                  <input
                    type="text"
                    placeholder="Area code (e.g. 415)"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="form-input flex-1 text-sm"
                  />
                )}
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
                >
                  <Search size={14} />
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">
                  {searching ? 'Searching available numbers…' : 'Pick a type and area code, then search.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {results.map((r) => (
                    <li key={r.phoneE164} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{formatNumber(r.phoneE164)}</p>
                        <p className="text-xs text-gray-500">
                          {r.numberType === 'toll_free' ? 'Toll-free' : 'Local'}
                          {r.locality ? ` · ${r.locality}` : ''}{r.region ? `, ${r.region}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handlePurchase(r)}
                        disabled={purchasingE164 === r.phoneE164}
                        className="btn-primary text-sm disabled:opacity-60"
                      >
                        {purchasingE164 === r.phoneE164 ? 'Purchasing…' : buyLabelFor(r.numberType)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Port-in (LOA form) modal ─────────────────────── */}
      {portOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-cream-900">Port your existing number</h2>
                <p className="text-xs text-gray-500 mt-0.5">Optional — not required to go live. Free porting, typically 5–14 business days. Forwarding works today.</p>
              </div>
              <button onClick={() => setPortOpen(false)} className="p-1.5 rounded hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Before submitting:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Your account at the current carrier must be <strong>active</strong> (not in the middle of a cancellation).</li>
                    <li>The authorized name + service address must <strong>match what's on file</strong> with the current carrier.</li>
                    <li>Don't cancel your current carrier — the port itself handles cancellation when it completes.</li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone number to port</label>
                  <input
                    type="tel"
                    value={portForm.phoneE164}
                    onChange={(e) => setPortForm({ ...portForm, phoneE164: e.target.value })}
                    placeholder="+14155551234"
                    className="form-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Current carrier</label>
                  <input
                    type="text"
                    value={portForm.currentCarrier}
                    onChange={(e) => setPortForm({ ...portForm, currentCarrier: e.target.value })}
                    placeholder="e.g. Verizon, AT&T, RingCentral"
                    className="form-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account # at carrier</label>
                  <input
                    type="text"
                    value={portForm.accountNumber}
                    onChange={(e) => setPortForm({ ...portForm, accountNumber: e.target.value })}
                    className="form-input w-full text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account PIN / passcode <span className="text-gray-400 font-normal">(if any)</span></label>
                  <input
                    type="text"
                    value={portForm.accountPin}
                    onChange={(e) => setPortForm({ ...portForm, accountPin: e.target.value })}
                    className="form-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Authorized name</label>
                  <input
                    type="text"
                    value={portForm.authorizedName}
                    onChange={(e) => setPortForm({ ...portForm, authorizedName: e.target.value })}
                    placeholder="Name on file with current carrier"
                    className="form-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={portForm.authorizedTitle}
                    onChange={(e) => setPortForm({ ...portForm, authorizedTitle: e.target.value })}
                    placeholder="Owner, Office Manager, etc."
                    className="form-input w-full text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service address</label>
                  <input
                    type="text"
                    value={portForm.serviceAddress}
                    onChange={(e) => setPortForm({ ...portForm, serviceAddress: e.target.value })}
                    placeholder="Street address registered with the current carrier"
                    className="form-input w-full text-sm"
                  />
                </div>
                <div className="col-span-2 grid grid-cols-[1fr_80px_120px] gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={portForm.serviceCity}
                      onChange={(e) => setPortForm({ ...portForm, serviceCity: e.target.value })}
                      className="form-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={portForm.serviceState}
                      onChange={(e) => setPortForm({ ...portForm, serviceState: e.target.value.toUpperCase().slice(0, 2) })}
                      maxLength={2}
                      placeholder="CA"
                      className="form-input w-full text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={portForm.serviceZip}
                      onChange={(e) => setPortForm({ ...portForm, serviceZip: e.target.value })}
                      placeholder="94103"
                      className="form-input w-full text-sm"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Desired completion date <span className="text-gray-400 font-normal">(best-effort)</span></label>
                  <input
                    type="date"
                    value={portForm.desiredCompleteDate}
                    onChange={(e) => setPortForm({ ...portForm, desiredCompleteDate: e.target.value })}
                    className="form-input w-full text-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                By submitting, you authorize us to act as your agent for the purpose of porting {portForm.phoneE164 || 'this number'} from {portForm.currentCarrier || 'your current carrier'} to our voice infrastructure on your behalf (LOA).
              </p>
            </div>
            <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={() => setPortOpen(false)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={handleSubmitPort}
                disabled={portSubmitting}
                className="btn-primary text-sm disabled:opacity-60"
              >
                {portSubmitting ? 'Submitting…' : 'Submit port request →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
