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
import { phoneNumbersApi, type AvailableNumber, type OwnedNumber } from '@/lib/api';
import { Phone, Search, Trash2, Star, X } from 'lucide-react';
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
        <button
          onClick={() => setSearchOpen(true)}
          className="btn-primary shrink-0 inline-flex items-center gap-2 text-sm"
        >
          <Phone size={14} /> Buy a number
        </button>
      </div>

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
    </div>
  );
}
