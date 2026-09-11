import { OnboardingHubHeader } from '@/components/layout/onboarding-hub-header';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-4">
        <OnboardingHubHeader />
        {children}
      </div>
    </div>
  );
}
