"use client";

import { useEffect, useRef } from "react";

/**
 * Full-bleed looping hero video. Muted + playsInline so phones autoplay it; the gradient behind
 * it shows while it loads. Paused for people who ask their device for reduced motion.
 */
export function HeroVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (reduce.matches) video.pause();
      else video.play().catch(() => {}); // autoplay can be refused (e.g. low-power mode)
    };
    apply();
    reduce.addEventListener("change", apply);
    return () => reduce.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 size-full object-cover"
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
      tabIndex={-1}
      disablePictureInPicture
    />
  );
}
