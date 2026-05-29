'use client';
// ============================================================
// /partners — Partner Program Self-Signup Page (public)
// Cream theme, matches /pricing and /inbound style.
// ============================================================
import { useState } from 'react';
import Link from 'next/link';
import { Users, TrendingUp, DollarSign, Zap, CheckCircle, ArrowRight, Phone } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

const BENEFITS = [
  {
    icon: DollarSign,
    title: '20% recurring commission',
    desc: 'Earn 20% on every invoice paid by customers you refer — for the life of their subscription.',
  },
  {
    icon: TrendingUp,
    title: 'Real-time dashboard',
    desc: 'See your referred customers, earned commissions, and payout history in one place.',
  },
  {
    icon: Users,
    title: 'No cap on earnings',
    desc: "There's no limit to how many clients you can refer or how much you can earn.",
  },
  {
    icon: Zap,
    title: 'Instant attribution',
    desc: 'Share your unique link. Any signup through it is automatically attributed to you.',
  },
];

export default function PartnersPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/partners/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-nav border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-serif text-lg shadow-sm">
              ar
            </div>
            <span className="font-semibold text-cream-900 text-sm hidden sm:inline">Telfin</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <Link href="/inbound" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Inbound</Link>
            <Link href="/outbound" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Outbound</Link>
            <Link href="/pricing" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">Pricing</Link>
            <Link href="/partners" className="text-sm font-medium text-brand-600">Partners</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/partners/login" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">
              Partner login
            </Link>
            <Link href="/signup" className="glow-btn inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors">
              Try free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-12 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 mb-6">
            <Users size={12} /> Partner Program
          </div>
          <h1 className="font-serif text-5xl font-bold text-cream-900 leading-tight mb-4">
            Earn recurring revenue<br />
            <span className="text-brand-600">by referring clients</span>
          </h1>
          <p className="text-lg text-cream-600 mb-8 max-w-lg">
            Refer businesses to Telfin and earn 20% of every invoice they pay — forever. No cap, no expiry.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-cream-600">
            {['Free to join', 'Instant ref link', 'Monthly payouts', 'No minimums'].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-brand-500" /> {t}
              </div>
            ))}
          </div>
        </div>

        {/* ── Signup form ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-8">
          {status === 'success' ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600" size={28} />
              </div>
              <h2 className="text-xl font-semibold text-cream-900 mb-2">Application received!</h2>
              <p className="text-cream-600 text-sm mb-6">
                We'll review your application and activate your account within 24 hours. You'll receive a confirmation email.
              </p>
              <Link
                href="/partners/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Go to partner login <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-cream-900 mb-1">Apply to become a partner</h2>
              <p className="text-sm text-cream-500 mb-6">Free to join · No commitments</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-cream-700 mb-1">Full name</label>
                  <input
                    type="text"
                    required
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-2.5 text-sm text-cream-900 placeholder-cream-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cream-700 mb-1">Work email</label>
                  <input
                    type="email"
                    required
                    placeholder="jane@agency.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-2.5 text-sm text-cream-900 placeholder-cream-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cream-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-2.5 text-sm text-cream-900 placeholder-cream-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full glow-btn rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? 'Submitting…' : (
                    <><ArrowRight size={15} /> Apply now — it's free</>
                  )}
                </button>

                <p className="text-center text-xs text-cream-500">
                  Already have an account?{' '}
                  <Link href="/partners/login" className="text-brand-600 hover:underline font-medium">Sign in</Link>
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center font-serif text-3xl font-bold text-cream-900 mb-10">
          Why partners choose us
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-cream-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                <Icon size={20} className="text-brand-600" />
              </div>
              <h3 className="font-semibold text-cream-900 mb-2 text-sm">{title}</h3>
              <p className="text-xs text-cream-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="bg-white border-y border-cream-200 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-center font-serif text-3xl font-bold text-cream-900 mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Apply & get approved', desc: 'Submit your application above. We review and activate accounts within 24 hours.' },
              { step: '02', title: 'Share your link', desc: 'Log into your partner dashboard and copy your unique referral link.' },
              { step: '03', title: 'Earn every month', desc: 'You earn 20% of every invoice your referrals pay — automatically tracked in your dashboard.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="text-4xl font-serif font-bold text-cream-200 mb-3">{step}</div>
                <h3 className="font-semibold text-cream-900 mb-2">{title}</h3>
                <p className="text-sm text-cream-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto text-center px-6 py-20">
        <h2 className="font-serif text-3xl font-bold text-cream-900 mb-4">Ready to start earning?</h2>
        <p className="text-cream-600 mb-8">Join our partner program today and start earning recurring commissions.</p>
        <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="glow-btn inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-8 py-4 text-base font-bold text-white transition-colors">
          <Phone size={16} /> Apply now
        </a>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-cream-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-cream-400">
          <span>© 2026 Telfin</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-cream-900 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-cream-900 transition-colors">Pricing</Link>
            <Link href="/partners/login" className="hover:text-cream-900 transition-colors">Partner login</Link>
            <a href="mailto:hello@aireceptionist.ai" className="hover:text-cream-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
