'use client';
// ============================================================
// /partners/login — Partner Portal Login Page
// ============================================================
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export default function PartnerLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/partners/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? 'Invalid email or password');
        setStatus('error');
        return;
      }
      localStorage.setItem('partner_token', data.token);
      router.push('/partners/dashboard');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      {/* Nav */}
      <header className="border-b border-cream-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-serif text-base">
              ar
            </div>
            <span className="text-sm font-semibold text-cream-900">Telfin</span>
          </Link>
          <Link href="/partners" className="text-xs text-cream-500 hover:text-cream-800 transition-colors">
            Partner program →
          </Link>
        </div>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
                <LogIn size={22} className="text-brand-600" />
              </div>
              <h1 className="text-xl font-semibold text-cream-900">Partner sign in</h1>
              <p className="text-sm text-cream-500 mt-1">Access your commission dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cream-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
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
                  autoComplete="current-password"
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
                className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-xs text-cream-500 mt-5">
              Not a partner yet?{' '}
              <Link href="/partners" className="text-brand-600 hover:underline font-medium">Apply now</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
