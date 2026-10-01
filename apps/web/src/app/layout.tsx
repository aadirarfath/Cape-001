import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import { CalendarDays, Scissors } from "lucide-react";
import { SITE_URL } from "@/lib/env";
import { getMessages } from "@/i18n";
import { MessagesProvider } from "@/i18n/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

  return (
    <html lang={m.meta.htmlLang} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <MessagesProvider messages={m}>
          <div className="flex min-h-dvh flex-col">
            <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
              <nav className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold" aria-label={m.site.nav.home}>
                  <Scissors className="size-5" aria-hidden />
                  {m.site.name}
                </Link>
                <Link
                  href="/bookings"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  <CalendarDays className="size-4" aria-hidden />
                  {m.site.nav.myBookings}
                </Link>
              </nav>
            </header>
            <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">{children}</main>
            <footer className="border-t py-6 text-center text-xs text-muted-foreground">{m.site.footer}</footer>
          </div>
        </MessagesProvider>
      </body>
    </html>
  );
}
