import { Suspense } from "react";
import { ArrowDown } from "lucide-react";
import { LocationPicker } from "@/components/shops/location-picker";
import { HeroVideo } from "@/components/site/hero-video";
import { getMessages } from "@/i18n";

export default function Home() {
  const m = getMessages();
  const t = m.landing;

  return (
    <main className="flex-1">
      {/* Hero: full-bleed video (the gradient shows while it loads); the wordmark is the only content. */}
      <section className="bg-solar-bloom relative grid min-h-svh place-items-center overflow-hidden bg-ink px-3">
        <HeroVideo src="/hero.mp4" />
        {/* A soft scrim keeps the white type readable over any frame, plus film grain. */}
        <div className="pointer-events-none absolute inset-0 bg-ink/20" aria-hidden />
        <div className="grain pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light" aria-hidden />
        <div className="hero-recede relative text-center">
          <h1
            className="font-display whitespace-nowrap text-[clamp(3rem,15vw,13.5rem)] leading-[0.9] text-paper"
            aria-label={t.wordmark}
          >
            {Array.from(t.wordmark).map((char, i) => (
              <span key={i} className="hero-letter" style={{ animationDelay: `${120 + i * 70}ms` }} aria-hidden>
                {char}
              </span>
            ))}
          </h1>
          <p className="hero-fade font-display mt-5 text-[10px] tracking-[0.3em] text-paper sm:text-[11px]">
            {t.tagline}
          </p>
        </div>
        <a
          href="#book"
          className="hero-fade font-display absolute bottom-7 left-1/2 flex min-h-11 -translate-x-1/2 flex-col items-center justify-end gap-2 px-4 text-[11px] tracking-[0.3em] text-paper/80"
        >
          {t.scroll}
          <ArrowDown className="scroll-nudge size-4" aria-hidden />
        </a>
      </section>

      {/* 01 — Book */}
      <section id="book" className="mx-auto grid max-w-[1200px] scroll-mt-24 gap-12 px-5 py-28 md:grid-cols-12 md:py-44">
        <div className="space-y-6 md:col-span-5">
          <p className="font-display text-xs tracking-[0.12em] text-graphite">{t.book.eyebrow}</p>
          <h2 className="text-5xl font-medium leading-[1.05] sm:text-6xl">{t.book.title}</h2>
          <p className="max-w-md text-xl leading-relaxed text-graphite">{t.book.body}</p>
        </div>
        <div className="md:col-span-7">
          <Suspense>
            <LocationPicker />
          </Suspense>
        </div>
      </section>

      {/* 02 — How it works */}
      <section className="px-3 sm:px-5">
        <div className="mx-auto max-w-[1200px] rounded-[40px] bg-mint px-6 py-20 sm:px-12 md:py-28">
          <p className="font-display text-xs tracking-[0.12em] text-graphite">{t.how.eyebrow}</p>
          <h2 className="mt-6 max-w-2xl text-5xl font-medium leading-[1.05] sm:text-6xl">{t.how.title}</h2>
          <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            {t.how.steps.map((step, i) => (
              <li key={step.title} className="space-y-4 border-t border-ink pt-6">
                <span className="font-display block text-6xl leading-none text-ink">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-2xl font-medium">{step.title}</h3>
                <p className="text-lg leading-relaxed text-graphite">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pull quote */}
      <section className="mx-auto max-w-[1200px] px-5 py-28 md:py-44">
        <blockquote className="max-w-4xl text-4xl font-medium leading-[1.2] sm:text-6xl sm:leading-[1.15]">
          {t.quote}
        </blockquote>
      </section>

      {/* 03 — For shops */}
      <section id="partners" className="scroll-mt-24 px-3 pb-28 sm:px-5 md:pb-44">
        <div className="mx-auto grid max-w-[1200px] overflow-hidden rounded-[40px] bg-teal text-paper md:grid-cols-12">
          <div className="space-y-8 px-6 py-16 sm:px-12 md:col-span-7 md:py-24">
            <p className="font-display text-xs tracking-[0.12em] text-paper/60">{t.partners.eyebrow}</p>
            <h2 className="text-5xl font-medium leading-[1.05] sm:text-6xl">{t.partners.title}</h2>
            <p className="max-w-xl text-xl leading-relaxed text-paper/75">{t.partners.body}</p>
            <ol className="space-y-0 border-t border-paper/20">
              {t.partners.steps.map((step, i) => (
                <li key={step} className="flex gap-5 border-b border-paper/20 py-4 text-lg">
                  <span className="font-display w-8 shrink-0 pt-1 text-xs text-paper/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="font-display inline-flex min-h-11 items-center rounded-full border border-paper/40 px-6 py-3 text-center text-xs leading-snug tracking-[0.06em] text-paper/80">
              {t.partners.cta}
            </p>
          </div>
          {/* Vertical mark on a textured panel, as in the reference's case-study blocks. */}
          <div className="relative hidden min-h-[28rem] items-center justify-center bg-ink md:col-span-5 md:flex" aria-hidden>
            <div className="grain absolute inset-0 opacity-30 mix-blend-overlay" />
            <span className="font-display relative -rotate-90 whitespace-nowrap text-6xl text-paper/90">
              {t.partners.mark}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
