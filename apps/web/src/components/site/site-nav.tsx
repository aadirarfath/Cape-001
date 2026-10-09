"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/provider";

/**
 * Floating pill navbar. Over the home hero video it is transparent and white, carrying only the account icon
 * and the booking pill; once the hero scrolls away (and on every other page) it turns into a
 * solid mint pill and the wordmark appears.
 */
export function SiteNav() {
  const m = useMessages();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setPastHero(window.scrollY > window.innerHeight * 0.7);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isHome]);

  const solid = !isHome || pastHero;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 rounded-full border px-2 transition-[background-color,border-color,backdrop-filter] duration-500",
          solid ? "border-ink/80 bg-mint/85 backdrop-blur-md" : "border-transparent bg-transparent",
        )}
      >
        <Link
          href="/"
          aria-label={m.site.nav.home}
          className={cn(
            "font-display inline-flex h-10 items-center rounded-full px-3 text-xs tracking-[0.02em] text-ink transition-opacity duration-500 sm:text-sm",
            solid ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          tabIndex={solid ? 0 : -1}
        >
          {m.landing.wordmark}
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            aria-label={m.site.nav.account}
            title={m.site.nav.account}
            className={cn(
              "grid size-10 place-items-center rounded-full border transition-colors",
              solid
                ? "border-ink/80 bg-paper text-ink hover:bg-ink hover:text-paper"
                : "border-paper/70 bg-transparent text-paper backdrop-blur-sm hover:bg-paper hover:text-ink",
            )}
          >
            <User className="size-4" aria-hidden />
          </Link>
          <Link
            href="/#book"
            className={cn(
              "group font-display flex h-10 items-center gap-2 rounded-full pl-5 pr-4 text-xs tracking-[0.04em] transition-colors",
              // White over the dark hero video, ink once the bar is solid.
              solid ? "bg-ink text-paper hover:bg-teal" : "bg-paper text-ink hover:bg-mint",
            )}
          >
            <span className="sm:hidden">{m.site.nav.bookShort}</span>
            <span className="hidden sm:inline">{m.site.nav.book}</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </nav>
    </header>
  );
}
