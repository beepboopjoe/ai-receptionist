import Link from 'next/link';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { BRAND_ICON_INITIALS, BRAND_NAME } from '@/lib/brand';
import { LEGAL_LAST_UPDATED, LEGAL_NAV, LEGAL_NOT_ADVICE } from '@/lib/legal';

export function LegalNotAdviceBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      }`}
      role="note"
    >
      <p className={compact ? 'leading-relaxed' : 'leading-relaxed'}>
        <strong className="font-semibold">Not legal advice.</strong> {LEGAL_NOT_ADVICE}
      </p>
    </div>
  );
}

export function LegalDocument({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-50">
      <MarketingHeader />

      <main id="legal-main" className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Legal</p>
        <h1 className="font-serif text-4xl text-cream-900 tracking-tight mb-3">{title}</h1>
        <p className="text-cream-600 text-sm mb-6">Last updated: {LEGAL_LAST_UPDATED}</p>

        <LegalNotAdviceBanner />

        {description && (
          <p className="mt-6 text-cream-700 leading-relaxed">{description}</p>
        )}

        <nav aria-label="Legal documents" className="mt-8 mb-10 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-8 text-cream-800 text-[15px] leading-relaxed [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-cream-900 [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:font-semibold [&_h3]:text-cream-900 [&_h3]:mt-5 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-cream-900">
          {children}
        </div>

        <p className="mt-12 text-sm text-cream-600">
          Questions?{' '}
          <Link href={`mailto:hello@telfin.ai`} className="text-brand-700 underline underline-offset-2">
            hello@telfin.ai
          </Link>
          {' · '}
          <Link href="/" className="text-brand-700 underline underline-offset-2">
            Back to {BRAND_NAME}
          </Link>
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}

/** Compact chrome for pages that already had a thin legal nav. */
export function LegalSimpleNav() {
  return (
    <nav className="border-b border-cream-200 px-6 py-4 flex items-center justify-between bg-white">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">
          {BRAND_ICON_INITIALS}
        </div>
        <span className="font-serif text-cream-900 font-semibold">{BRAND_NAME}</span>
      </Link>
      <Link href="/" className="text-sm text-cream-700 hover:text-cream-900 transition-colors">
        ← Back to home
      </Link>
    </nav>
  );
}
