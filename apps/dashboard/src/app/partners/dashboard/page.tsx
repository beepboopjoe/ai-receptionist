'use client';
// ============================================================
// /partners/dashboard — Partner Commission Dashboard
//
// Auth: partner_token in localStorage (partner JWT).
// Shows: stats, ref link, commission history, payout requests.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Users, TrendingUp, Clock, Copy, CheckCircle,
  LogOut, ExternalLink, AlertCircle, ChevronDown,
} from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
const DASHBOARD_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://ai-receptionist-dashboard-sigma.vercel.app';

function getPartnerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('partner_token');
}

async function partnerFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getPartnerToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('partner_token');
    window.location.replace('/partners/login');
    return Promise.reject(new Error('Unauthorized'));
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartnerProfile {
  id: string;
  name: string;
  email: string;
  code: string;
  status: string;
  commissionPct: string;
  payoutEmail: string | null;
  payoutMethod: string;
  referredTenants: number;
  totalCommissionCents: number;
  pendingCommissionCents: number;
  paidOutCommissionCents: number;
}

interface CommissionEvent {
  id: string;
  tenantId: string;
  invoiceAmountCents: number;
  commissionCents: number;
  commissionPct: string;
  payoutStatus: string;
  createdAt: string;
}

interface PayoutRequest {
  id: string;
  requestedAmountCents: number;
  status: string;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid_out: 'bg-green-100 text-green-800',
    pending_review: 'bg-orange-100 text-orange-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-red-100 text-red-800',
  };
  return map[s] ?? 'bg-gray-100 text-gray-700';
}

// ── Payout Request Modal ──────────────────────────────────────────────────────

function PayoutModal({
  pendingCents,
  defaultEmail,
  defaultMethod,
  onClose,
  onSuccess,
}: {
  pendingCents: number;
  defaultEmail: string;
  defaultMethod: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amountDollars, setAmountDollars] = useState((pendingCents / 100).toFixed(2));
  const [payoutEmail, setPayoutEmail] = useState(defaultEmail);
  const [payoutMethod, setPayoutMethod] = useState(defaultMethod || 'paypal');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amountDollars) * 100);
    if (!amountCents || amountCents <= 0) {
      setErrorMsg('Enter a valid amount');
      return;
    }
    setStatus('loading');
    try {
      await partnerFetch('/partners/payout-requests', {
        method: 'POST',
        body: JSON.stringify({ amountCents, payoutEmail, payoutMethod, note: note || undefined }),
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit request');
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Request payout</h2>
        <p className="text-sm text-gray-500 mb-5">
          Available: <span className="font-semibold text-gray-800">{fmt(pendingCents)}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              max={(pendingCents / 100).toFixed(2)}
              required
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Payout method</label>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none"
            >
              <option value="paypal">PayPal</option>
              <option value="venmo">Venmo</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {payoutMethod === 'bank_transfer' ? 'Bank details' : `${payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1)} email / handle`}
            </label>
            <input
              type="text"
              required
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Note (optional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any message for the admin…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none resize-none"
            />
          </div>

          {status === 'error' && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={status === 'loading'}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60">
              {status === 'loading' ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [commissions, setCommissions] = useState<CommissionEvent[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!getPartnerToken()) {
      router.replace('/partners/login');
      return;
    }
    try {
      const [p, c, pr] = await Promise.all([
        partnerFetch<PartnerProfile>('/partners/me'),
        partnerFetch<{ data: CommissionEvent[] }>('/partners/commissions'),
        partnerFetch<{ data: PayoutRequest[] }>('/partners/payout-requests'),
      ]);
      setProfile(p);
      setCommissions(c.data);
      setPayouts(pr.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadData(); }, [loadData]);

  function copyRefLink() {
    if (!profile) return;
    const link = `${DASHBOARD_URL}/signup?ref=${profile.code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function logout() {
    localStorage.removeItem('partner_token');
    router.replace('/partners/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500 animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-sm text-gray-600 mb-4">{error || 'Something went wrong'}</p>
          <button onClick={() => void loadData()} className="text-sm text-brand-600 font-medium hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const refLink = `${DASHBOARD_URL}/signup?ref=${profile.code}`;
  const isPendingReview = profile.status === 'pending_review';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-serif text-base">
              ar
            </Link>
            <span className="text-sm font-semibold text-gray-900">Partner Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 hidden sm:inline">{profile.email}</span>
            <button onClick={logout}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Pending review banner ──────────────────────────────── */}
        {isPendingReview && (
          <div className="rounded-xl bg-orange-50 border border-orange-200 px-5 py-4 flex items-start gap-3">
            <Clock size={18} className="text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Application under review</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Your partner account is pending approval. We'll activate it within 24 hours and notify you by email.
              </p>
            </div>
          </div>
        )}

        {/* ── Welcome + ref link ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Welcome back, {profile.name.split(' ')[0]}</h1>
              <p className="text-sm text-gray-500">
                Commission rate: <span className="font-semibold text-gray-700">{profile.commissionPct}%</span> recurring
              </p>
            </div>
            <span className={`self-start sm:self-center text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(profile.status)}`}>
              {profile.status.replace('_', ' ')}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Your referral link</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 font-mono truncate">
                {refLink}
              </div>
              <button
                onClick={copyRefLink}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? <><CheckCircle size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
              <a href={refLink} target="_blank" rel="noreferrer"
                className="shrink-0 p-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-gray-500">
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total earned', value: fmt(profile.totalCommissionCents), icon: TrendingUp, color: 'text-green-600' },
            { label: 'Pending payout', value: fmt(profile.pendingCommissionCents), icon: Clock, color: 'text-yellow-600' },
            { label: 'Paid out', value: fmt(profile.paidOutCommissionCents), icon: DollarSign, color: 'text-blue-600' },
            { label: 'Referred customers', value: String(profile.referredTenants), icon: Users, color: 'text-purple-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`mb-2 ${color}`}><Icon size={18} /></div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Payout request ────────────────────────────────────── */}
        {!isPendingReview && profile.pendingCommissionCents >= 100 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Ready to withdraw?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                You have <span className="font-semibold text-gray-700">{fmt(profile.pendingCommissionCents)}</span> available for payout.
              </p>
            </div>
            <button
              onClick={() => setShowPayoutModal(true)}
              className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Request payout
            </button>
          </div>
        )}

        {/* ── Commission history ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Commission history</h2>
          </div>
          {commissions.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">
              No commissions yet — share your referral link to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="px-6 py-3 text-left font-medium">Date</th>
                    <th className="px-6 py-3 text-right font-medium">Invoice</th>
                    <th className="px-6 py-3 text-right font-medium">Your commission</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-600">
                        {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700 font-medium">{fmt(c.invoiceAmountCents)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-green-700">{fmt(c.commissionCents)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge(c.payoutStatus)}`}>
                          {c.payoutStatus.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Payout requests ──────────────────────────────────── */}
        {payouts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Payout requests</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="px-6 py-3 text-left font-medium">Requested</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium">Admin note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payouts.map((pr) => (
                    <tr key={pr.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-600">
                        {new Date(pr.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-800">{fmt(pr.requestedAmountCents)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge(pr.status)}`}>
                          {pr.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 italic">{pr.adminNote ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Payout modal ─────────────────────────────────────────── */}
      {showPayoutModal && (
        <PayoutModal
          pendingCents={profile.pendingCommissionCents}
          defaultEmail={profile.payoutEmail ?? ''}
          defaultMethod={profile.payoutMethod}
          onClose={() => setShowPayoutModal(false)}
          onSuccess={() => {
            setShowPayoutModal(false);
            void loadData();
          }}
        />
      )}
    </div>
  );
}
