'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Zap, Building2 } from 'lucide-react';

// ── Use-case option config ──────────────────────────────────────────────────
type UseCaseKey = 'inbound' | 'outbound' | 'both' | 'multi_location';

interface UseCase {
  key: UseCaseKey;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
  recommendedPlan: string;
  recommendedPrice: string;
  perks: string[];
}

// Megaphone SVG inline — lucide-react doesn't export Megaphone in all versions
function MegaphoneIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  );
}

const USE_CASES: UseCase[] = [
  {
    key: 'inbound',
    title: 'Answer My Calls',
    description:
      'AI handles inbound calls, books appointments, and escalates urgencies to your team.',
    icon: Phone,
    recommendedPlan: 'Starter Plan',
    recommendedPrice: '$199/mo',
    perks: ['1,000 AI minutes included', 'Inbound calls only', '1 phone number'],
  },
  {
    key: 'outbound',
    title: 'Call My Leads',
    description:
      'AI dials outbound campaigns, qualifies prospects, and books appointments automatically.',
    icon: MegaphoneIcon,
    recommendedPlan: 'Growth Plan',
    recommendedPrice: '$399/mo',
    perks: ['3,000 AI minutes included', 'Outbound campaigns included', '2 phone numbers'],
  },
  {
    key: 'both',
    title: 'Both — Inbound & Outbound',
    description:
      'Full AI operations — inbound receptionist plus outbound campaigns working together.',
    icon: Zap,
    badge: 'Most Popular',
    recommendedPlan: 'Growth Plan',
    recommendedPrice: '$399/mo',
    perks: ['3,000 AI minutes included', 'Outbound campaigns included', '2 phone numbers'],
  },
  {
    key: 'multi_location',
    title: 'Multiple Locations',
    description:
      'AI reception across up to 5 locations — each with its own phone number and AI configuration.',
    icon: Building2,
    recommendedPlan: 'Pro Plan',
    recommendedPrice: '$799/mo',
    perks: ['8,000 AI minutes included', 'Up to 5 locations', 'Outbound campaigns included'],
  },
];

// ── Recommended plan banner ─────────────────────────────────────────────────
function RecommendedBanner({
  useCase,
  onStart,
}: {
  useCase: UseCase;
  onStart: () => void;
}) {
  return (
    <div className="mt-6 rounded-xl border-2 border-brand-200 bg-brand-50 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-700">
            Recommended:{' '}
            <span className="font-bold">{useCase.recommendedPlan}</span>
            {' · '}
            <span>{useCase.recommendedPrice}</span>
          </p>
          <ul className="mt-1 space-y-0.5">
            {useCase.perks.map((perk) => (
              <li key={perk} className="text-sm text-brand-600">
                · {perk}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            onClick={onStart}
            className="btn-primary text-sm whitespace-nowrap"
          >
            Start with {useCase.recommendedPlan.split(' ')[0]} →
          </button>
          <a
            href="/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-brand-700 bg-white border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors whitespace-nowrap"
          >
            Compare all plans →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function OnboardingPlanPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<UseCaseKey | null>(null);

  const selectedUseCase = USE_CASES.find((u) => u.key === selected) ?? null;

  function handleStart() {
    if (!selected) return;
    try {
      localStorage.setItem('onboarding_use_case', selected);
    } catch {
      // localStorage unavailable — continue anyway
    }
    router.push('/onboarding');
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <p className="text-sm font-medium text-gray-400 mb-8 text-center tracking-wide uppercase">
          Step 1 of 6
        </p>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            What do you want your AI to do?
          </h1>
          <p className="mt-3 text-base text-gray-500">
            Choose your primary use case — you can change this later
          </p>
        </div>

        {/* Option cards */}
        <div className="space-y-3">
          {USE_CASES.map((useCase) => {
            const Icon = useCase.icon;
            const isSelected = selected === useCase.key;

            return (
              <button
                key={useCase.key}
                onClick={() => setSelected(useCase.key)}
                className={`w-full text-left rounded-xl border-2 p-5 transition-all focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Icon size={22} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{useCase.title}</span>
                      {useCase.badge && (
                        <span className="inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {useCase.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{useCase.description}</p>
                    <p className="text-xs text-brand-600 font-medium mt-1.5">
                      Recommended: {useCase.recommendedPlan} · {useCase.recommendedPrice}
                    </p>
                  </div>

                  {/* Radio indicator */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recommended plan banner — shown after selection */}
        {selectedUseCase && (
          <RecommendedBanner useCase={selectedUseCase} onStart={handleStart} />
        )}
      </div>
    </div>
  );
}
