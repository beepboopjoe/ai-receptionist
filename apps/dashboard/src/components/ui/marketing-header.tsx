'use client';
// ============================================================
// Shared marketing site nav — cream theme.
// Used by /, /inbound, /outbound, /pricing, /demo.
// Active link is highlighted in brand-600.
// Includes a mobile hamburger drawer.
// ============================================================
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

const NAV_LINKS = [
  { label: 'Inbound',   href: '/inbound' },
  { label: 'Outbound',  href: '/outbound' },
  { label: 'Leads',     href: '/lead-discovery' },
  { label: 'Pricing',   href: '/pricing' },
  { label: 'Demo',      href: '/demo' },
  { label: 'Affiliate', href: '/resellers' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      <header className="sticky top-0 z-50 glass-nav border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-serif text-lg shadow-sm">
              ar
            </div>
            <span className="font-serif text-lg text-cream-900">{BRAND_NAME}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'text-brand-600'
                    : 'text-cream-700 hover:text-cream-900'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs — Try Free leads the conversion path; plans link
              stays available as the outline secondary. */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-cream-700 hover:text-cream-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/pricing#plans"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3.5 py-2 text-sm font-medium text-cream-800 hover:bg-cream-50 transition-colors"
            >
              See plans
            </Link>
            <Link
              href="/signup?plan=trial"
              className="glow-btn inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              Try Free →
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -mr-1 rounded-lg hover:bg-cream-200 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} className="text-cream-800" />
          </button>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-72 bg-white border-l border-cream-200 shadow-xl transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-cream-200">
          <span className="font-serif text-lg text-cream-900">{BRAND_NAME}</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg hover:bg-cream-100"
            aria-label="Close menu"
          >
            <X size={18} className="text-cream-700" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 pt-4">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-cream-700 hover:bg-cream-50 hover:text-cream-900'
              }`}
            >
              {label}
            </Link>
          ))}

          <div className="pt-4 mt-2 border-t border-cream-100 space-y-2 px-1">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center py-2.5 px-4 rounded-xl text-sm font-medium text-cream-700 border border-cream-200 hover:bg-cream-50 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/pricing#plans"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center py-2.5 px-4 rounded-xl text-sm font-medium text-cream-800 border border-cream-300 hover:bg-cream-50 transition-colors"
            >
              See plans
            </Link>
            <Link
              href="/signup?plan=trial"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
            >
              Try Free →
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
