// ============================================================
// Shared marketing site footer — cream theme.
// Used by /, /inbound, /outbound, /pricing, /demo.
// ============================================================
import Link from 'next/link';
import { BRAND_NAME, BRAND_ICON_INITIALS } from '@/lib/brand';

const FOOTER_LINKS = [
  ['Home',           '/'],
  ['How it works',   '/#how-it-works'],
  ['Inbound',        '/inbound'],
  ['Outbound',       '/outbound'],
  ['Pricing',        '/pricing'],
  ['Hear it',        '/demo'],
  ['Knowledge base', '/knowledge-base'],
  ['Affiliate',      '/resellers'],
  ['Partners',       '/partners'],
  ['Privacy',        '/legal/privacy'],
  ['Terms',          '/legal/terms'],
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-cream-200 bg-cream-50 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 text-sm text-cream-500">

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">
              {BRAND_ICON_INITIALS}
            </div>
            <span className="font-serif text-cream-700">{BRAND_NAME}</span>
          </div>
          <p className="text-xs text-cream-400">© 2026 {BRAND_NAME}. All rights reserved.</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-cream-900 transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
