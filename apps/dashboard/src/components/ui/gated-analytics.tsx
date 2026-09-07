'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import {
  COOKIE_CONSENT_EVENT,
  hasAnalyticsConsent,
  readCookieConsent,
  type CookieConsentState,
} from '@/lib/cookie-consent';

/**
 * Loads optional analytics / pixels only after cookie consent.
 * IDs are read from NEXT_PUBLIC_* env vars. If unset (current production),
 * nothing is injected — the banner still records the visitor's choice.
 */
export function GatedAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    function sync(state?: CookieConsentState) {
      setAllowed(hasAnalyticsConsent(state ?? readCookieConsent()));
    }
    sync();
    function onChange(e: Event) {
      sync((e as CustomEvent<CookieConsentState>).detail);
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
  }, []);

  if (!allowed) return null;

  const gaId = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID']?.trim();
  const gtmId = process.env['NEXT_PUBLIC_GTM_ID']?.trim();
  const metaId = process.env['NEXT_PUBLIC_META_PIXEL_ID']?.trim();

  return (
    <>
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="telfin-ga" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {gtmId && (
        <Script id="telfin-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':Date.now(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      {metaId && (
        <Script id="telfin-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
