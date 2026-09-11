'use client';
// ============================================================
// /test-call — calm practice-call entry.
//
// Replaces the heavy browser-mic "Try your AI" widget. Paid and
// promo-trial tenants use the existing TestCallCard (Telnyx
// /calls/test-call). Free / demo accounts browse only — same
// upgrade gate as Home (#43).
// ============================================================
import { TestCallCard } from '@/components/dashboard/go-live-checklist';
import { DemoUpgradeCard } from '@/components/dashboard/demo-upgrade-card';
import { usePlan } from '@/lib/usePlan';
import { Phone } from 'lucide-react';

export default function TestCallPage() {
  const { isDemoAccount, loading } = usePlan();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Test call</h1>
        <p className="text-gray-500 mt-1">
          Hear your receptionist the way a customer would — we ring your staff number.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-cream-200 bg-white h-28 animate-pulse" />
      ) : isDemoAccount ? (
        <DemoUpgradeCard
          title="Test calls go live after upgrade"
          body="Browse the dashboard now. After you upgrade we can ring your phone so you can talk to your AI — the same path paying customers use."
        />
      ) : (
        <div className="space-y-4">
          <TestCallCard />
          <p className="text-xs text-gray-500 leading-relaxed px-1">
            This places a real phone call to your staff transfer number. Test calls are marked
            separately and do not count toward billed minutes. Set the number under Settings → My
            AI Receptionist.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 flex items-start gap-3">
        <Phone size={16} className="text-brand-600 shrink-0 mt-0.5" />
        <p className="text-sm text-cream-700 leading-relaxed">
          No browser microphone. When you are live, pick up the phone — your AI answers.
        </p>
      </div>
    </div>
  );
}
