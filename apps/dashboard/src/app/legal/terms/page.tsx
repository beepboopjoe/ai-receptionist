import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — AI Receptionist',
};

export default function TermsPage() {
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
        <h1 className="font-serif text-4xl text-cream-900 tracking-tight mb-4">Terms of Service</h1>
        <p className="text-cream-500 text-sm mb-10">Last updated: January 1, 2026</p>

        <div className="space-y-6 text-cream-700">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
            <p className="text-sm font-semibold text-amber-900 mb-1">Document in preparation</p>
            <p className="text-sm text-amber-800">
              Our full Terms of Service are being prepared by our legal counsel and will be published here shortly.
              For questions about acceptable use, please contact us directly.
            </p>
          </div>

          <p className="leading-relaxed">
            By accessing or using AI Receptionist services, you agree to be bound by these Terms of Service.
            Please read them carefully before using our platform.
          </p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Use of Services</h2>
          <p className="leading-relaxed">You may use our services only as permitted by law and these Terms. You must not use our services to violate any applicable regulations including those governing patient communications and healthcare marketing.</p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Subscription and Billing</h2>
          <p className="leading-relaxed">Subscriptions are billed monthly. You may cancel at any time. Cancellation takes effect at the end of the current billing period. We do not offer refunds for partial months.</p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Acceptable Use</h2>
          <p className="leading-relaxed">You agree to use the platform in compliance with TCPA, HIPAA, and all other applicable laws governing automated calling, patient privacy, and healthcare communications.</p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Contact Us</h2>
          <p className="leading-relaxed">
            For legal inquiries, contact us at{' '}
            <a href="mailto:legal@aireceptionist.ai" className="text-brand-600 hover:underline">
              legal@aireceptionist.ai
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
