import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Telfin',
};

export default function PrivacyPage() {
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
        <h1 className="font-serif text-4xl text-cream-900 tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-cream-500 text-sm mb-10">Last updated: January 1, 2026</p>

        <div className="prose prose-sm max-w-none text-cream-700 space-y-6">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
            <p className="text-sm font-semibold text-amber-900 mb-1">Document in preparation</p>
            <p className="text-sm text-amber-800">
              Our full Privacy Policy is being prepared by our legal counsel and will be published here shortly.
              For privacy-related questions, please contact us directly.
            </p>
          </div>

          <p className="leading-relaxed">
            Telfin (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting the privacy and security of your
            personal information and the protected health information of patients your practice serves.
          </p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Information We Collect</h2>
          <p className="leading-relaxed">We collect information you provide when you create an account, configure your AI receptionist, or contact us for support. This may include practice name, contact information, phone numbers, and appointment data.</p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">How We Use Your Information</h2>
          <p className="leading-relaxed">We use your information to provide and improve our services, respond to your inquiries, send service-related communications, and comply with legal obligations.</p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">HIPAA Compliance</h2>
          <p className="leading-relaxed">We act as a Business Associate under HIPAA when processing Protected Health Information on your behalf. We maintain appropriate technical, physical, and administrative safeguards.</p>

          <h2 className="font-serif text-xl text-cream-900 mt-8 mb-3">Contact Us</h2>
          <p className="leading-relaxed">
            For privacy questions or to exercise your rights, contact us at{' '}
            <a href="mailto:privacy@aireceptionist.ai" className="text-brand-600 hover:underline">
              privacy@aireceptionist.ai
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
