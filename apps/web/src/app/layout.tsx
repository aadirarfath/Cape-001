import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import { preconnect } from "react-dom";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { SITE_URL, SUPABASE_URL } from "@/lib/env";
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
  openGraph: { siteName: m.site.name, locale: "en_IN", type: "website" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

// Every page renders per request: the CSP nonce (src/middleware.ts) changes on each request, and
// Next.js can only attach it to its scripts when rendering dynamically. Reading the header opts in.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await headers();
  // Shop photos, free-slot lookups and login all talk to Supabase from the browser; open the
  // connection early so the first of those requests doesn't pay for DNS and TLS.
  preconnect(SUPABASE_URL, { crossOrigin: "anonymous" });

  return (
    <html lang={m.meta.htmlLang} className={`${archivo.variable} ${newsreader.variable} ${geistMono.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <MessagesProvider messages={m}>
          <div className="flex min-h-dvh flex-col">
            <SiteNav />
            {children}
            <SiteFooter />
          </div>
        </MessagesProvider>
      </body>
    </html>
  );
}
