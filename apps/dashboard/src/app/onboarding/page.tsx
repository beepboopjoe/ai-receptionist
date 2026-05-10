'use client';
import useSWR from 'swr';
import { onboardingApi } from '@/lib/api';
import Link from 'next/link';
import { CheckCircle, Circle, ChevronRight } from 'lucide-react';

const STEPS = [
  { num: 1, label: 'Pick your industry', href: '/onboarding/step-0-industry' },
  { num: 2, label: 'Set up your AI phone line', href: '/onboarding/step-1-phone' },
  { num: 3, label: 'Connect your calendar', href: '/onboarding/step-2-calendar' },
  { num: 4, label: 'Import your contacts', href: '/onboarding/step-3-patients' },
  { num: 5, label: 'Configure office rules', href: '/onboarding/step-4-rules' },
  { num: 6, label: 'Activate AI receptionist', href: '/onboarding/step-5-activate' },
];

export default function OnboardingIndexPage() {
  const { data } = useSWR('onboarding-status', () => onboardingApi.getStatus());
  const status = data as any;
  const currentStep = status?.currentStep ?? 1;

  return (
    <div className="card divide-y divide-gray-50">
      {STEPS.map(({ num, label, href }) => {
        const isComplete = num < currentStep;
        const isCurrent = num === currentStep;

        return (
          <Link
            key={num}
            href={href}
            className="flex items-center gap-4 px-6 py-5 hover:bg-gray-50 transition-colors group"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              isComplete ? 'bg-green-100' : isCurrent ? 'bg-brand-100' : 'bg-gray-100'
            }`}>
              {isComplete ? (
                <CheckCircle size={20} className="text-green-600" />
              ) : (
                <span className={`text-sm font-bold ${isCurrent ? 'text-brand-700' : 'text-gray-400'}`}>
                  {num}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${isCurrent ? 'text-brand-700' : isComplete ? 'text-gray-500' : 'text-gray-700'}`}>
                {label}
              </p>
              {isCurrent && (
                <p className="text-xs text-brand-500 mt-0.5">← Start here</p>
              )}
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        );
      })}
    </div>
  );
}
