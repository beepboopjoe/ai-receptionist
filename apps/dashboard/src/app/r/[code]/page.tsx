'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeReferralCode, persistReferralCode } from '@/lib/referral';
import { BRAND_NAME } from '@/lib/brand';

export default function ReferralShortLinkPage({ params }: { params: { code: string } }) {
  const router = useRouter();

  useEffect(() => {
    const code = normalizeReferralCode(params.code);
    if (code) persistReferralCode(code);
    router.replace(code ? `/?ref=${encodeURIComponent(code)}` : '/');
  }, [params.code, router]);

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <p className="text-sm text-cream-700">Taking you to {BRAND_NAME}…</p>
    </div>
  );
}
