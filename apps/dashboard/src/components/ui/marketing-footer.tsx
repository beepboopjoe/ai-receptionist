// ============================================================
// Shared marketing site footer — cream theme.
// Used by /, /inbound, /outbound, /pricing, /demo.
// ============================================================
import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';

export function MarketingFooter() {
  return (
    <footer className="border-t border-cream-200 bg-cream-50 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-cream-500">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">
            ar
          </div>
          <span className="font-serif text-cream-700">{BRAND_NAME}</span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {[
            ['Home',     '/'],
            ['Inbound',  '/inbound'],
            ['Outbound', '/outbound'],
            ['Pricing',  '/pricing'],
            ['Demo',     '/demo'],
            ['Privacy',  '/legal/privacy'],
            ['Terms',    '/legal/terms'],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-cream-900 transition-colors">
              {label}
            </Link>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-xs text-cream-400">© 2026 {BRAND_NAME}. All rights reserved.</p>
      </div>
    </footer>
  );
}
