export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 mb-4">
            <span className="text-3xl">🦷</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set Up Your Telfin</h1>
          <p className="text-gray-500 mt-1">Complete these 5 steps to go live</p>
        </div>
        {children}
      </div>
    </div>
  );
}
