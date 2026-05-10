import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'HIPAA Compliance — AI Receptionist',
};

export default function HipaaPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <nav className="border-b border-cream-200 px-6 py-4 flex items-center justify-between bg-white">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">ar</div>
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
              <p className="text-sm font-semibold text-green-900 mb-1">HIPAA-Ready Platform</p>
              <p className="text-sm text-green-800">
                AI Receptionist is designed for healthcare practices. We sign Business Associate Agreements (BAAs)
                and implement safeguards required under HIPAA.
              </p>
            </div>
          </div>

          <p className="leading-relaxed">
            As a service provider to healthcare practices, AI Receptionist acts as a Business Associate under the
            Health Insurance Portability and Accountability Act (HIPAA) when we process Protected Health Information
            (PHI) on your behalf.
          </p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Business Associate Agreement</h2>
          <p className="leading-relaxed">We provide a signed BAA to all customers on Growth and Pro plans. The BAA outlines our obligations to protect PHI and the permitted uses of PHI in delivering our services.</p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Technical Safeguards</h2>
          <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
            <li>All data encrypted in transit (TLS 1.2+) and at rest (AES-256)</li>
            <li>Call recordings and transcripts stored with access controls and audit logging</li>
            <li>Automatic session timeouts and least-privilege access controls</li>
            <li>Regular security assessments and penetration testing</li>
          </ul>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Administrative Safeguards</h2>
          <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
            <li>Employee HIPAA training and confidentiality agreements</li>
            <li>Incident response plan for potential breaches</li>
            <li>Data retention and disposal policies</li>
          </ul>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Request a BAA</h2>
          <p className="leading-relaxed">
            To request a Business Associate Agreement or discuss compliance requirements, contact our compliance team at{' '}
            <a href="mailto:compliance@aireceptionist.ai" className="text-brand-600 hover:underline">
              compliance@aireceptionist.ai
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
