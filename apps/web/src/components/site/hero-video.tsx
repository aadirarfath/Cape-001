"use client";

import { useEffect, useRef } from "react";

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** Data saver on, or a 2G-class connection: show the still poster instead of downloading video. */
function prefersLessData() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? "");
}

/**
 * Full-bleed looping hero video. Muted + playsInline so phones autoplay it. The poster shows
 * straight away; the video itself is only fetched once the page has loaded, so it never competes
 * with the page's own scripts and styles. People who ask for reduced motion or less data keep
 * the still poster and never download the video.
 */
export function HeroVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (prefersLessData()) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (reduce.matches) {
        video.pause();
        return;
      }
      if (!video.getAttribute("src")) video.src = src;
      video.play().catch(() => {}); // autoplay can be refused (e.g. low-power mode)
    };
    const start = () => apply();
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    reduce.addEventListener("change", apply);
    return () => {
      window.removeEventListener("load", start);
      reduce.removeEventListener("change", apply);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className="absolute inset-0 size-full object-cover"
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      disablePictureInPicture
    />
  );
}
