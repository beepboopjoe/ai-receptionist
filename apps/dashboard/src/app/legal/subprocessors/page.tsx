import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';
import { Network } from 'lucide-react';

export const metadata = {
  title: 'Subprocessors — Telfin',
};

// Vendors that may process customer data (including PHI, where a practice
// enables it). "PHI" flags those that can receive call audio / transcripts /
// contact records. BAA status is maintained by our compliance team and shown
// here for transparency; contact compliance@aireceptionist.ai for executed copies.
const SUBPROCESSORS: {
  name: string;
  purpose: string;
  data: string;
  phi: boolean;
}[] = [
  { name: 'xAI (Grok)', purpose: 'Real-time voice AI — speech recognition, conversation, and response', data: 'Call audio, transcript', phi: true },
  { name: 'Telnyx', purpose: 'Telephony + SMS carrier (inbound/outbound call and message transport)', data: 'Call audio, phone numbers, SMS content', phi: true },
  { name: 'Railway', purpose: 'Application + database (PostgreSQL) and cache (Redis) hosting', data: 'All stored tenant data', phi: true },
  { name: 'Resend', purpose: 'Transactional email (call summaries, notifications)', data: 'Recipient email, call summary content', phi: true },
  { name: 'Stripe', purpose: 'Payment processing + subscription billing', data: 'Billing contact + subscription metadata (no call PHI)', phi: false },
  { name: 'Vercel', purpose: 'Dashboard (web application) hosting', data: 'Web session data (no PHI at rest)', phi: false },
  { name: 'Connected CRMs (HubSpot, Salesforce, Zoho, Clio, Filevine — optional)', purpose: 'Two-way contact / activity sync, only when a customer connects them', data: 'Contact records, call activity', phi: true },
];

export default function SubprocessorsPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <nav className="border-b border-cream-200 px-6 py-4 flex items-center justify-between bg-white">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-serif text-sm">TF</div>
          <span className="font-serif text-cream-900 font-semibold">{BRAND_NAME}</span>
        </Link>
        <Link href="/legal/hipaa" className="text-sm text-cream-600 hover:text-cream-900 transition-colors">← HIPAA</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Legal</p>
        <h1 className="font-serif text-4xl text-cream-900 tracking-tight mb-4">Subprocessors</h1>
        <p className="text-cream-500 text-sm mb-8">Last updated: July 4, 2026</p>

        <div className="space-y-6 text-cream-700">
          <div className="rounded-xl bg-brand-50 border border-brand-100 p-5 flex gap-4">
            <Network size={22} className="text-brand-700 shrink-0 mt-0.5" />
            <p className="text-sm text-brand-900">
              To deliver the service, {BRAND_NAME} uses the third-party subprocessors below. Those marked
              <strong> “PHI”</strong> may process Protected Health Information when a healthcare practice enables it.
              If you are a covered entity, contact{' '}
              <a href="mailto:compliance@aireceptionist.ai" className="underline">compliance@aireceptionist.ai</a>{' '}
              for the current Business Associate Agreement status of any subprocessor before enabling PHI processing.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-cream-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-cream-500">
                  <th className="px-4 py-3 font-semibold">Subprocessor</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">PHI</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name} className="border-b border-cream-100 last:border-0 align-top">
                    <td className="px-4 py-3 font-semibold text-cream-900">{s.name}</td>
                    <td className="px-4 py-3 text-cream-600">{s.purpose}</td>
                    <td className="px-4 py-3 text-cream-600">{s.data}</td>
                    <td className="px-4 py-3">
                      {s.phi ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">PHI</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-cream-100 border border-cream-200 px-2 py-0.5 text-xs font-medium text-cream-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm leading-relaxed text-cream-600">
            We will provide notice of material changes to this list. Optional integrations only receive
            data if you explicitly connect them.
          </p>
        </div>
      </main>
    </div>
  );
}
