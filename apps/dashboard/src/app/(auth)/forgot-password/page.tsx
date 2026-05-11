'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4">
            <span className="text-3xl">🦷</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{BRAND_NAME}</h1>
          <p className="text-gray-500 mt-1">Reset your password</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                <span className="text-2xl">✉️</span>
              </div>
              <p className="text-sm text-gray-700">
                Check your email — if an account exists, we sent a reset link.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
                  {error}
                </div>
              )}

              <p className="text-sm text-gray-500">
                Enter the email address associated with your account and we&apos;ll send you a reset link.
              </p>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@practice.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="text-center text-sm text-gray-500">
                <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                  ← Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
