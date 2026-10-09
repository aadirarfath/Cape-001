import Link from "next/link";
import { getMessages } from "@/i18n";

/** Obsidian footer with an edge-to-edge wordmark. */
export function SiteFooter() {
  const m = getMessages();

  return (
    <footer className="relative overflow-hidden bg-ink text-paper">
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay" aria-hidden />
      <div className="relative mx-auto max-w-[1200px] px-5 pb-8 pt-20 sm:pt-28">
        <nav className="flex flex-wrap gap-2 text-sm">
          {[
            { href: "/#book", label: m.site.nav.book },
            { href: "/bookings", label: m.site.nav.myBookings },
            { href: "/#partners", label: m.site.nav.partners },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex h-11 items-center rounded-full border border-paper/25 px-5 transition-colors hover:border-paper hover:bg-paper hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p
          className="font-display mt-16 select-none whitespace-nowrap text-center text-[clamp(2.5rem,13.6vw,12.5rem)] leading-[0.9] text-paper"
          aria-hidden
        >
          {m.landing.wordmark}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-paper/15 pt-6 text-xs text-paper/60">
          <span>{m.site.footer}</span>
          <span className="font-display text-xs tracking-[0.2em]">{m.site.footerMade}</span>
        </div>
      </div>
    </footer>
  );
}
