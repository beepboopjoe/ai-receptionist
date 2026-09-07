// ============================================================
// Shared marketing site footer — cream theme.
// Used by /, /inbound, /outbound, /pricing, /demo, legal docs.
// ============================================================
'use client';

import Link from 'next/link';
import {
  BRAND_ADDRESS_CITY_LINE,
  BRAND_ADDRESS_LINE1,
  BRAND_ICON_INITIALS,
  BRAND_NAME,
  BRAND_SUPPORT_EMAIL,
} from '@/lib/brand';
import { LEGAL_NOT_ADVICE } from '@/lib/legal';
import { openCookieSettings } from '@/lib/cookie-consent';

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
] as const;

const LEGAL_LINKS = [
  ['Privacy',  '/privacy'],
  ['Terms',    '/terms'],
  ['Cookies',  '/cookies'],
  ['Refunds',  '/refunds'],
  ['HIPAA/BAA', '/legal/hipaa'],
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-cream-200 bg-cream-50 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 text-sm text-cream-700">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm shrink-0" aria-hidden>
              {BRAND_ICON_INITIALS}
            </div>
            <div>
              <p className="font-serif text-cream-900">{BRAND_NAME}</p>
              <p className="text-sm text-cream-700 mt-1 leading-relaxed">
                {BRAND_ADDRESS_LINE1}<br />
                {BRAND_ADDRESS_CITY_LINE}<br />
                <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-cream-900">
                  {BRAND_SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </div>
          <p className="text-sm text-cream-700">© 2026 {BRAND_NAME}. All rights reserved.</p>
        </div>

        <nav aria-label="Marketing" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-cream-900 transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LEGAL_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-cream-900 transition-colors underline underline-offset-2">
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => openCookieSettings()}
            className="hover:text-cream-900 transition-colors underline underline-offset-2 bg-transparent p-0 text-sm font-inherit"
          >
            Cookie settings
          </button>
        </nav>

        <p className="text-xs text-cream-600 leading-relaxed max-w-4xl mx-auto text-center">
          {LEGAL_NOT_ADVICE} Registered legal entity name and EIN are not listed here yet —
          confirm with the operator before relying on these pages.
        </p>
      </div>
    </footer>
  );
}
