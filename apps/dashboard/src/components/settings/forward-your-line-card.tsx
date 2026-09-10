'use client';

import { PhoneForwarded, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { BRAND_NAME } from '@/lib/brand';

function formatNumber(e164: string): string {
  if (!e164 || e164 === 'pending') return 'your Telfin number';
  const m = /^\+(\d{1,3})(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

export function ForwardYourLineCard({ did }: { did: string | null }) {
  const [copied, setCopied] = useState(false);
  const display = did ? formatNumber(did) : 'your Telfin number (assigned on go-live)';

  async function copyDid() {
    if (!did) return;
    try {
      await navigator.clipboard.writeText(did);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-amber-50 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <PhoneForwarded size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-cream-900">
            Day one: keep your existing number — forward it here
          </p>
          <p className="text-xs text-cream-700 mt-1 leading-relaxed">
            Paid go-live auto-assigns a {BRAND_NAME} inbound DID. Callers can keep dialing your
            current business line. Turn on <strong>always forward</strong> (unconditional — not
            busy/no-answer only) to this number. Porting is optional later if you want the old
            number to live on {BRAND_NAME}.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-12">
        <code className="text-sm font-semibold text-cream-900 bg-white/80 border border-cream-200 rounded-lg px-3 py-1.5">
          {display}
        </code>
        {did && (
          <button
            type="button"
            onClick={copyDid}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      <ol className="pl-12 text-xs text-cream-700 space-y-1.5 list-decimal list-inside">
        <li>Open your current carrier&apos;s app, or call their support / business desk.</li>
        <li>
          Enable <strong>always / unconditional call forwarding</strong> — every ring should move,
          not just busy or no-answer.
        </li>
        <li>Set the forward-to number to {display}.</li>
        <li>Call your old number from a different phone and confirm {BRAND_NAME} answers.</li>
        <li>Leave the old line active. Forwarding is not a cancel or a port.</li>
      </ol>
    </div>
  );
}
