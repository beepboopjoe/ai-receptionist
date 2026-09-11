'use client';
// ============================================================
// UpgradeModal — shown when a user hits a locked feature or
// tries to go live from a Free / demo account.
// Prices and minute/number counts come from the shared catalog.
// ============================================================
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Zap, CheckCircle } from 'lucide-react';
import { getPlan } from '@ai-receptionist/shared';

export type UpgradeReason =
  | 'usage_limit'
  | 'outbound_locked'
  | 'sms_locked'
  | 'second_number'
  | 'pro_analytics'
  | 'multi_location'
  | 'knowledge_base'
  | 'go_live';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: UpgradeReason;
}

const growth = getPlan('growth')!;
const scale = getPlan('scale')!;
const business = getPlan('business')!;

function usdMo(price: number): string {
  return `$${price}/mo`;
}

const MODAL_CONTENT: Record<
  UpgradeReason,
  { icon: string; title: string; description: string; features: string[]; cta: string; targetPlan: string }
> = {
  usage_limit: {
    icon: '⚡',
    title: "You're running low on AI minutes",
    description: `You've used 80%+ of your monthly AI minutes. Upgrade to ${growth.name} for more included time before overage charges.`,
    features: [
      `${growth.monthlyMinutes.toLocaleString()} AI minutes/month`,
      `${growth.includedPhoneNumbers} local phone numbers included`,
      'Outbound campaigns and two-way SMS',
    ],
    cta: `Upgrade to ${growth.name} · ${usdMo(growth.monthlyPrice)}`,
    targetPlan: growth.name,
  },
  outbound_locked: {
    icon: '📣',
    title: `Outbound campaigns require ${growth.name}`,
    description: 'AI calling campaigns — dial lead lists, qualify prospects, and book appointments automatically — are available on paid plans.',
    features: [
      'Upload leads via CSV',
      'AI dials and qualifies automatically',
      'Books appointments from cold leads',
    ],
    cta: `Upgrade to ${growth.name} · ${usdMo(growth.monthlyPrice)}`,
    targetPlan: growth.name,
  },
  sms_locked: {
    icon: '💬',
    title: 'Two-way SMS requires a paid plan',
    description: `Upgrade to ${growth.name} (or any paid plan) to send and receive SMS with your contacts, plus automated 24h + 2h appointment reminders.`,
    features: [
      'Two-way SMS inbox with your contacts',
      'Automated appointment reminders (24h + 2h)',
      'Missed-call text-back replies under 10s',
    ],
    cta: `Upgrade to ${growth.name} · ${usdMo(growth.monthlyPrice)}`,
    targetPlan: growth.name,
  },
  second_number: {
    icon: '📱',
    title: `Additional phone numbers require ${scale.name}`,
    description: `${growth.name} includes ${growth.includedPhoneNumbers} numbers. ${scale.name} includes ${scale.includedPhoneNumbers} — plus extras at the add-on rate.`,
    features: [
      `${scale.includedPhoneNumbers} phone numbers included on ${scale.name}`,
      'Multi-location AI configurations',
      'Separate AI configurations per line',
    ],
    cta: `Upgrade to ${scale.name} · ${usdMo(scale.monthlyPrice)}`,
    targetPlan: scale.name,
  },
  pro_analytics: {
    icon: '📊',
    title: `Advanced analytics require ${scale.name}`,
    description: 'Call quality scores, conversion funnels, and custom reports — available on Scale and above.',
    features: [
      'Call quality scoring per conversation',
      'Conversion funnel analytics',
      'Custom report builder & CSV export',
    ],
    cta: `Upgrade to ${scale.name} · ${usdMo(scale.monthlyPrice)}`,
    targetPlan: scale.name,
  },
  multi_location: {
    icon: '🏢',
    title: `Multi-location management requires ${scale.name}`,
    description: 'Manage multiple locations, each with its own phone number and AI configuration.',
    features: [
      `${scale.includedPhoneNumbers} phone numbers included`,
      'Per-location AI configuration',
      'Unified analytics dashboard',
    ],
    cta: `Upgrade to ${scale.name} · ${usdMo(scale.monthlyPrice)}`,
    targetPlan: scale.name,
  },
  knowledge_base: {
    icon: '📚',
    title: `Knowledge Base is available on the ${business.name} plan`,
    description: 'Upload PDFs and Word docs so the AI answers from your fee schedules, FAQs, and policies. Most teams start with Curate-My-Agent — full document search is a Business feature.',
    features: [
      'Upload PDF, DOCX, TXT, and Markdown',
      '500 documents / 2 GB storage',
      'AI grounds every call in your docs',
    ],
    cta: `Upgrade to ${business.name} · ${usdMo(business.monthlyPrice)}`,
    targetPlan: business.name,
  },
  go_live: {
    icon: '📞',
    title: 'Upgrade to go live',
    description: `You're exploring the dashboard. A dedicated inbound number and AI receptionist activation unlock on ${growth.name} and above.`,
    features: [
      `${growth.includedPhoneNumbers} local phone numbers included`,
      `${growth.monthlyMinutes.toLocaleString()} AI call minutes every month`,
      'Activate your receptionist and forward your existing line',
    ],
    cta: `Upgrade to ${growth.name} · ${usdMo(growth.monthlyPrice)}`,
    targetPlan: growth.name,
  },
};

export function UpgradeModal({ open, onClose, reason = 'usage_limit' }: UpgradeModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const content = MODAL_CONTENT[reason] ?? MODAL_CONTENT.go_live;

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 pt-6 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="text-4xl mb-3">{content.icon}</div>
          <h2 className="text-xl font-serif font-normal text-white tracking-tight">{content.title}</h2>
          <p className="text-brand-100 text-sm mt-2">{content.description}</p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 border-b border-cream-200">
          <p className="text-xs font-semibold text-cream-600 uppercase tracking-wider mb-3">What you get on {content.targetPlan}</p>
          <ul className="space-y-2">
            {content.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-cream-800">
                <CheckCircle size={16} className="text-brand-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div className="px-6 py-5 flex flex-col gap-3">
          <Link
            href="/billing"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors"
          >
            <Zap size={16} />
            {content.cta}
          </Link>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl border border-cream-200 text-cream-700 text-sm font-medium hover:bg-cream-50 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
