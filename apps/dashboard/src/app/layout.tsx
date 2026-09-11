import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { MARKETING_VIEW_BOOT_SCRIPT } from '@/lib/marketing-view-mode';
import { CookieConsentBanner } from '@/components/ui/cookie-consent-banner';
import { GatedAnalytics } from '@/components/ui/gated-analytics';
import { ReferralCapture } from '@/components/ui/referral-capture';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: BRAND_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className={inter.className}>
        <Script id="telfin-marketing-view" strategy="beforeInteractive">
          {MARKETING_VIEW_BOOT_SCRIPT}
        </Script>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
        <ReferralCapture />
        <CookieConsentBanner />
        <GatedAnalytics />
      </body>
    </html>
  );
}
