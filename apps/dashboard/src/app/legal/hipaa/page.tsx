import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'HIPAA Compliance — Telfin',
};

export default function HipaaPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <nav className="border-b border-cream-200 px-6 py-4 flex items-center justify-between bg-white">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">TF</div>
          <span className="font-serif text-cream-900 font-semibold">{BRAND_NAME}</span>
        </Link>
        <Link href="/" className="text-sm text-cream-600 hover:text-cream-900 transition-colors">← Back to home</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Legal</p>
        <h1 className="font-serif text-4xl text-cream-900 tracking-tight mb-4">HIPAA Compliance</h1>
        <p className="text-cream-500 text-sm mb-10">Last updated: January 1, 2026</p>

        <div className="space-y-6 text-cream-700">
          <div className="rounded-xl bg-green-50 border border-green-200 p-5 flex gap-4">
            <ShieldCheck size={22} className="text-green-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-900 mb-1">Built for healthcare practices</p>
              <p className="text-sm text-green-800">
                Telfin offers a Business Associate Agreement and implements the technical and
                administrative safeguards described below for practices that process PHI.
              </p>
            </div>
          </div>

          <p className="leading-relaxed">
            As a service provider to healthcare practices, Telfin acts as a Business Associate under the
            Health Insurance Portability and Accountability Act (HIPAA) when we process Protected Health Information
            (PHI) on your behalf. Because delivering the service involves sending call audio and transcripts to
            our voice and telephony providers, any practice processing PHI should complete a BAA with us and review
            our <Link href="/legal/subprocessors" className="text-brand-600 hover:underline">subprocessor list</Link> before
            enabling PHI processing.
          </p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Business Associate Agreement</h2>
          <p className="leading-relaxed">
            A Business Associate Agreement is available to customers processing PHI. You can review and accept
            the BAA directly in your dashboard under <strong>Settings → Compliance</strong>; a countersigned copy
            is available from our compliance team on request. The BAA outlines our obligations to protect PHI and
            the permitted uses of PHI in delivering our services.
          </p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Technical Safeguards</h2>
          <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
            <li>Data encrypted in transit (TLS 1.2+) and at rest at the database/infrastructure layer (AES-256)</li>
            <li>Call transcripts stored with role-based access controls and complete audit logging</li>
            <li>Optional per-account control to disable verbatim transcript storage (PHI minimization)</li>
            <li>Automatic session timeouts (HIPAA mode) and least-privilege, tenant-isolated access</li>
          </ul>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Administrative Safeguards</h2>
          <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
            <li>Configurable data retention with automatic deletion of records past the retention window</li>
            <li>Immutable compliance event log (BAA acceptance, setting changes, data purges, erasures)</li>
            <li>On-request data-subject erasure of a contact and all of their calls, messages, and appointments</li>
            <li>
              Subprocessor management — see our{' '}
              <Link href="/legal/subprocessors" className="text-brand-600 hover:underline">subprocessor list</Link>
            </li>
          </ul>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Request a BAA</h2>
          <p className="leading-relaxed">
            To request a countersigned Business Associate Agreement or discuss compliance requirements, contact our compliance team at{' '}
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="text-brand-600 hover:underline">
              {BRAND_SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
