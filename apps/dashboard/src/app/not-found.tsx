// ============================================================
// Global 404 — used by Next.js whenever a route can't be matched.
// Lives at the app-router root so it covers every public and
// authenticated path. The (app)/layout.tsx ErrorBoundary catches
// render errors; this page covers missing-route 404s.
// ============================================================
import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-100 border border-cream-200 mb-6">
          <Search size={26} className="text-cream-600" />
        </div>
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-2">404</p>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight mb-3">Page not found</h1>
        <p className="text-cream-700 leading-relaxed mb-8">
          We couldn&apos;t find what you were looking for. It may have moved, been deleted, or the URL might have a typo.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-secondary text-sm">
            <Home size={14} /> {BRAND_NAME} home
          </Link>
          <Link href="/dashboard" className="btn-primary text-sm">
            Go to dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
