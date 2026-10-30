import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import { preconnect } from "react-dom";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { Analytics } from "@/components/site/analytics";
import { GA_MEASUREMENT_ID, GSC_SITE_VERIFICATION, SITE_URL, SUPABASE_URL } from "@/lib/env";
import { getMessages } from "@/i18n";
import { MessagesProvider } from "@/i18n/provider";
import "./globals.css";

// Archivo at full width (wdth 125) stands in for the expanded display face of the design
// reference; Newsreader is the editorial serif for everything else. Both are self-hosted by
// next/font, so the CSP's font-src 'self' still holds.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const m = getMessages();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${m.site.name} — ${m.site.tagline}`, template: `%s · ${m.site.name}` },
  description: m.site.description,
  applicationName: m.site.name,
  openGraph: {
    siteName: m.site.name,
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: `${m.site.name} — ${m.site.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: { default: `${m.site.name} — ${m.site.tagline}`, template: `%s · ${m.site.name}` },
    description: m.site.description,
    images: ["/opengraph-image.png"],
  },
  formatDetection: { telephone: false },
  // Google Search Console verification (set NEXT_PUBLIC_GSC_SITE_VERIFICATION in .env)
  ...(GSC_SITE_VERIFICATION
    ? { verification: { google: GSC_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

// Organization JSON-LD — tells Google who Cape 001 is.
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: m.site.name,
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image.png`,
  description: m.site.description,
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@cape001.com",
    contactType: "customer support",
    areaServed: "IN",
    availableLanguage: ["English", "Malayalam"],
  },
  sameAs: [],
};

// Every page renders per request: the CSP nonce (src/middleware.ts) changes on each request, and
// Next.js can only attach it to its scripts when rendering dynamically. Reading the header opts in.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hdrs = await headers();
  const nonce = hdrs.get("x-nonce") ?? undefined;
  // Shop photos, free-slot lookups and login all talk to Supabase from the browser; open the
  // connection early so the first of those requests doesn't pay for DNS and TLS.
  preconnect(SUPABASE_URL, { crossOrigin: "anonymous" });

  const orgJsonLd = JSON.stringify(organizationSchema).replace(/</g, "\\u003c");

  return (
    <html lang={m.meta.htmlLang} className={`${archivo.variable} ${newsreader.variable} ${geistMono.variable}`}>
      <body className="bg-paper text-ink antialiased">
        {/* Organization structured data */}
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: orgJsonLd }}
        />
        <MessagesProvider messages={m}>
          <div className="flex min-h-dvh flex-col">
            <SiteNav />
            {children}
            <SiteFooter />
          </div>
        </MessagesProvider>
        {/* Google Analytics 4 — only active when NEXT_PUBLIC_GA_MEASUREMENT_ID is set */}
        <Analytics measurementId={GA_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
