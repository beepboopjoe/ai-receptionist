import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { LegalNotAdviceBanner } from '@/components/legal/legal-document';
import { MarketingHeader } from '@/components/ui/marketing-header';
import { MarketingFooter } from '@/components/ui/marketing-footer';
import { LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata = {
  title: 'HIPAA / BAA — Telfin',
};

export default function HipaaPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <MarketingHeader />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Legal</p>
        <h1 className="font-serif text-4xl text-cream-900 tracking-tight mb-4">HIPAA / Business Associate Agreement</h1>
        <p className="text-cream-600 text-sm mb-6">Last updated: {LEGAL_LAST_UPDATED}</p>

        <LegalNotAdviceBanner />

        <div className="space-y-6 text-cream-700 mt-8">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 flex gap-4">
            <ShieldCheck size={22} className="text-amber-800 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-950 mb-1">Not a HIPAA certification</p>
              <p className="text-sm text-amber-900">
                {BRAND_NAME} is not HIPAA-certified and does not claim a third-party HIPAA audit
                on this site. We offer a Business Associate Agreement and in-product controls
                (idle timeout, audit log, retention) for customers who need them. Do not process
                PHI until a BAA is executed.
              </p>
            </div>
          </div>

          <p className="leading-relaxed">
            If we process Protected Health Information on a covered entity’s behalf after a BAA
            is signed, we intend to act as a Business Associate. Voice audio and transcripts go
            to our voice and telephony subprocessors. Review the{' '}
            <Link href="/legal/subprocessors" className="text-brand-700 underline underline-offset-2">
              subprocessor list
            </Link>{' '}
            before enabling PHI.
          </p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Business Associate Agreement</h2>
          <p className="leading-relaxed">
            A BAA is available in the dashboard under <strong>Settings → Compliance</strong>, or
            by emailing{' '}
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="text-brand-700 underline underline-offset-2">
              {BRAND_SUPPORT_EMAIL}
            </a>
            . A countersigned copy may be requested from our team. The BAA—not this marketing
            page—is the contract that governs PHI.
          </p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Controls we offer</h2>
          <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
            <li>TLS in transit; encryption at rest at the database/infrastructure layer</li>
            <li>Role-based access and an audit log of compliance events</li>
            <li>Optional HIPAA mode idle timeout</li>
            <li>Configurable retention and on-request contact erasure where enabled</li>
          </ul>
          <p className="text-sm">
            These are product features, not a warranty that your practice is HIPAA-compliant
            by using {BRAND_NAME}.
          </p>

          <p className="leading-relaxed">
            <Link href="/privacy" className="text-brand-700 underline underline-offset-2">Privacy Policy</Link>
            {' · '}
            <Link href="/terms" className="text-brand-700 underline underline-offset-2">Terms</Link>
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
