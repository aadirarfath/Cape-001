"use client";

import Script from "next/script";

// Google Analytics 4 — only loads when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
// Uses next/script with strategy="afterInteractive" so it never blocks render.
// The nonce is not needed here: next/script injects into <head> after hydration
// and is not subject to the same strict-dynamic nonce gate as inline scripts.

interface AnalyticsProps {
  measurementId: string;
}

export function Analytics({ measurementId }: AnalyticsProps) {
  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true,cookie_flags:'SameSite=None;Secure'});`}
      </Script>
    </>
  );
}
