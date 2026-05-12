'use client';
// ============================================================
// Settings → Phone Numbers.
//
// Lets owners + admins:
//   - See the numbers their tenant owns
//   - Buy a new local or toll-free number via Telnyx (charges the
//     monthly cost to the tenant's Stripe customer)
//   - Release a number (deletes from Telnyx + soft-deletes locally)
// ============================================================
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { phoneNumbersApi, type AvailableNumber, type OwnedNumber, type PortRequestRow } from '@/lib/api';
import { Phone, Search, Trash2, Star, X, ArrowRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton as UiSkeleton } from '@/components/ui/skeleton';

function formatNumber(e164: string): string {
  // +14155551234 → +1 (415) 555-1234
  const m = /^\+(\d{1,3})(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PhoneNumbersPage() {
  const toast = useToast();
  const { data, isLoading } = useSWR('phone-numbers', () => phoneNumbersApi.list());
  const owned = data?.data ?? [];

  const [searchOpen, setSearchOpen] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [type, setType] = useState<'local' | 'toll_free'>('local');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [purchasingE164, setPurchasingE164] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  // Port-in flow
  const { data: portsData } = useSWR('phone-port-requests', () => phoneNumbersApi.listPortRequests());
  const portRequests = portsData?.data ?? [];
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
        accountPin: portForm.accountPin || undefined,
        authorizedName: portForm.authorizedName,
        authorizedTitle: portForm.authorizedTitle || undefined,
        serviceAddress: portForm.serviceAddress,
        serviceCity: portForm.serviceCity,
        serviceState: portForm.serviceState,
        serviceZip: portForm.serviceZip,
        desiredCompleteDate: portForm.desiredCompleteDate || undefined,
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
        areaCode: type === 'local' ? (areaCode || undefined) : undefined,
        type,
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
    if (!confirm(`Buy ${formatNumber(number.phoneE164)} for ${dollars(number.numberType === 'toll_free' ? 1000 : 500)}/mo?`)) return;
    setPurchasingE164(number.phoneE164);
    try {
      const res = await phoneNumbersApi.purchase(number.phoneE164, number.numberType);
      toast.success(
        res.charged
          ? `Purchased ${formatNumber(number.phoneE164)} — added to your next invoice`
          : `Purchased ${formatNumber(number.phoneE164)} (Stripe not configured — billed manually)`
      );
      setSearchOpen(false);
      setResults([]);
      await mutate('phone-numbers');
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Release failed');
    } finally {
      setReleasingId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Phone numbers</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Numbers your AI receptionist answers on. Each plan includes 1 local number; extras are $5/mo (local) or $10/mo (toll-free).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPortOpen(true)}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
            title="Move an existing business number from another carrier"
          >
            <ArrowRight size={14} /> Port my number
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Phone size={14} /> Buy a number
          </button>
        </div>
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
          title="No numbers yet"
          description="Buy your first local or toll-free number to start taking calls."
          actionLabel="Buy a number"
          onAction={() => setSearchOpen(true)}
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
                    {n.region ? ` · ${n.region}` : ''} · {dollars(n.monthlyCostCents)}/mo
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {n.isPrimary && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-1 rounded-full">
                    <Star size={11} /> Primary
                  </span>
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

      {/* ── Search/purchase modal ───────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-cream-900">Buy a phone number</h2>
                <p className="text-xs text-gray-500 mt-0.5">Local = $5/mo · Toll-free = $10/mo</p>
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
                  {searching ? 'Searching Telnyx…' : 'Pick a type and area code, then search.'}
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
                        {purchasingE164 === r.phoneE164 ? 'Purchasing…' : `Buy ${dollars(r.numberType === 'toll_free' ? 1000 : 500)}/mo`}
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
                <p className="text-xs text-gray-500 mt-0.5">Keep your current business number. Free porting — typically 5–14 business days.</p>
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
                By submitting, you authorize us to act as your agent for the purpose of porting {portForm.phoneE164 || 'this number'} from {portForm.currentCarrier || 'your current carrier'} to our Telnyx account on your behalf (LOA).
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
