'use client';
// ============================================================
// Shared marketing site nav — cream theme.
// Used by every public marketing page (/, /inbound, /outbound,
// /pricing, /demo, /legal, /dental, etc.).
// Active link highlights in brand-600.
// Verticals are grouped in a dropdown (Phase 16) to keep the
// top-level nav compact as we add more vertical landings.
// Mobile drawer expands the verticals inline.
// ============================================================
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

type VerticalLink = { label: string; href: string };
type NavItem =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'dropdown'; label: string; items: VerticalLink[] };

const VERTICAL_LINKS: VerticalLink[] = [
  { label: 'Law Firms',        href: '/legal' },
  { label: 'Dental Practices', href: '/dental' },
  { label: 'Insurance',        href: '/insurance' },
  { label: 'Real Estate',      href: '/real-estate' },
  { label: 'Home Services',    href: '/home-services' },
];

const NAV_ITEMS: NavItem[] = [
  { kind: 'link',     label: 'Inbound',   href: '/inbound' },
  { kind: 'link',     label: 'Outbound',  href: '/outbound' },
  { kind: 'dropdown', label: 'Verticals', items: VERTICAL_LINKS },
  { kind: 'link',     label: 'Leads',     href: '/lead-discovery' },
  { kind: 'link',     label: 'Docs',      href: '/knowledge-base' },
  { kind: 'link',     label: 'Pricing',   href: '/pricing' },
  { kind: 'link',     label: 'Demo',      href: '/demo' },
  { kind: 'link',     label: 'Affiliate', href: '/resellers' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [verticalsOpen, setVerticalsOpen] = useState(false);
  const [mobileVerticalsOpen, setMobileVerticalsOpen] = useState(false);
  const verticalsRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }
  const isVerticalActive = VERTICAL_LINKS.some((v) => isActive(v.href));

  // Click-outside-to-close for the desktop Verticals dropdown.
  useEffect(() => {
    if (!verticalsOpen) return;
    function handler(e: MouseEvent) {
      if (verticalsRef.current && !verticalsRef.current.contains(e.target as Node)) {
        setVerticalsOpen(false);
      }
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [verticalsOpen]);

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
            {NAV_ITEMS.map((item) => {
              if (item.kind === 'link') {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'text-brand-600'
                        : 'text-cream-700 hover:text-cream-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }
              // dropdown
              return (
                <div
                  key={item.label}
                  ref={verticalsRef}
                  className="relative"
                  onMouseEnter={() => setVerticalsOpen(true)}
                  onMouseLeave={() => setVerticalsOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setVerticalsOpen((v) => !v)}
                    aria-haspopup="true"
                    aria-expanded={verticalsOpen}
                    className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${
                      isVerticalActive
                        ? 'text-brand-600'
                        : 'text-cream-700 hover:text-cream-900'
                    }`}
                  >
                    {item.label}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${verticalsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {verticalsOpen && (
                    <div className="absolute left-0 top-full pt-2">
                      <div className="bg-white border border-cream-200 rounded-xl shadow-lg py-2 min-w-[200px]">
                        {item.items.map((v) => (
                          <Link
                            key={v.href}
                            href={v.href}
                            onClick={() => setVerticalsOpen(false)}
                            className={`block px-4 py-2 text-sm transition-colors ${
                              isActive(v.href)
                                ? 'bg-brand-50 text-brand-700 font-medium'
                                : 'text-cream-700 hover:bg-cream-50 hover:text-cream-900'
                            }`}
                          >
                            {v.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
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
        className={`fixed top-0 right-0 bottom-0 z-50 w-72 bg-white border-l border-cream-200 shadow-xl transition-transform duration-200 md:hidden overflow-y-auto ${
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
          {NAV_ITEMS.map((item) => {
            if (item.kind === 'link') {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-cream-700 hover:bg-cream-50 hover:text-cream-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            }
            // dropdown — render as expandable section
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setMobileVerticalsOpen((v) => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isVerticalActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-cream-700 hover:bg-cream-50 hover:text-cream-900'
                  }`}
                  aria-expanded={mobileVerticalsOpen}
                >
                  {item.label}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${mobileVerticalsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {mobileVerticalsOpen && (
                  <div className="ml-3 mt-1 mb-2 border-l-2 border-cream-200 pl-3 space-y-1">
                    {item.items.map((v) => (
                      <Link
                        key={v.href}
                        href={v.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive(v.href)
                            ? 'bg-brand-50 text-brand-700 font-medium'
                            : 'text-cream-600 hover:bg-cream-50 hover:text-cream-900'
                        }`}
                      >
                        {v.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

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
