// ============================================================
// Why Starter $20 / Growth $199+ beat a typical $29 answering
// service. Not a Telfin $29 plan. Free stays the demo signup.
// ============================================================
import Link from 'next/link';
import { CheckCircle, Minus, Phone, MessageSquare, Calendar, Sparkles } from 'lucide-react';

const ROWS: { feature: string; answering: string; starter: string; growth: string }[] = [
  {
    feature: 'Inbound',
    answering: 'Takes a message',
    starter: 'Answers and books the calendar',
    growth: 'Same, more minutes',
  },
  {
    feature: 'Outbound',
    answering: 'Usually none',
    starter: 'Campaigns + one-off calls',
    growth: 'Same, larger minute pack',
  },
  {
    feature: 'SMS',
    answering: 'Rare / extra fee',
    starter: 'Two-way + missed-call text-back',
    growth: 'Same inbox, more volume',
  },
  {
    feature: 'Ask Telfin',
    answering: 'No',
    starter: 'Chat to launch one call or text',
    growth: 'Same dashboard shortcut',
  },
  {
    feature: 'Booking page',
    answering: 'No',
    starter: 'Public page on the same calendar',
    growth: 'Same shared calendar',
  },
];

export function PricingVsAnswering({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'py-8' : 'py-16'}>
      <div className={compact ? '' : 'max-w-5xl mx-auto px-6'}>
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">
            Versus a $29 answering service
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-cream-900 tracking-tight">
            {compact ? (
              <>$20 does the job a $29 service won&apos;t.</>
            ) : (
              <>
                Why Starter $20 and Growth $199+
                <br className="hidden sm:block" /> beat a $29 answering service.
              </>
            )}
          </h2>
          <p className="text-cream-600 mt-3 max-w-2xl mx-auto leading-relaxed text-sm sm:text-base">
            A typical $29/mo answering service takes a message and emails you later.
            Telfin Starter is $20 and works the line — outbound, SMS, Ask Telfin, and a
            public booking page. Growth is $199 when you need more included minutes.
            Free is still how you explore the dashboard.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-white shadow-sm">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-cream-50 border-b border-cream-200">
                <th scope="col" className="text-left px-5 py-4 font-semibold text-cream-500 text-xs uppercase tracking-wider">
                  What you get
                </th>
                <th scope="col" className="px-4 py-4 text-center">
                  <p className="font-serif text-cream-800">$29 answering</p>
                  <p className="text-[11px] text-cream-400 mt-0.5">Typical message-taker</p>
                </th>
                <th scope="col" className="px-4 py-4 text-center bg-emerald-50/80">
                  <p className="font-serif text-emerald-800">Starter $20</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Go live</p>
                </th>
                <th scope="col" className="px-4 py-4 text-center bg-brand-50">
                  <p className="font-serif text-brand-800">Growth $199+</p>
                  <p className="text-[11px] text-brand-600 mt-0.5">More minutes</p>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.feature} className="border-b border-cream-100 last:border-b-0">
                  <th scope="row" className="text-left px-5 py-3.5 font-semibold text-cream-800">
                    {row.feature}
                  </th>
                  <td className="px-4 py-3.5 text-center text-cream-500">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Minus size={12} className="text-cream-300 shrink-0" aria-hidden />
                      {row.answering}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-cream-800 bg-emerald-50/40">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <CheckCircle size={13} className="text-emerald-500 shrink-0" aria-hidden />
                      {row.starter}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-cream-800 bg-brand-50/40">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <CheckCircle size={13} className="text-brand-500 shrink-0" aria-hidden />
                      {row.growth}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!compact && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Phone, label: 'Outbound', hint: 'Campaigns + Ask Telfin one-offs' },
              { icon: MessageSquare, label: 'SMS', hint: 'Inbox + missed-call text-back' },
              { icon: Sparkles, label: 'Ask Telfin', hint: 'Type a goal, it dials or texts' },
              { icon: Calendar, label: 'Booking page', hint: 'Same calendar as the phone' },
            ].map(({ icon: Icon, label, hint }) => (
              <div key={label} className="rounded-2xl border border-cream-200 bg-white px-4 py-4">
                <Icon size={16} className="text-brand-600 mb-2" aria-hidden />
                <p className="text-sm font-semibold text-cream-900">{label}</p>
                <p className="text-xs text-cream-500 mt-0.5">{hint}</p>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-cream-500 mt-6">
          Explore Free with no card.{' '}
          <Link href="/signup?plan=trial" className="text-brand-600 font-semibold hover:underline">
            Try Free →
          </Link>
          {compact && (
            <>
              {' · '}
              <Link href="/pricing" className="text-brand-600 font-semibold hover:underline">
                See full plans
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
