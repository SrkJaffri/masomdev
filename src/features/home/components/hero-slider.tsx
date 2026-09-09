"use client";

import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

import type { HeroBanner } from "@/features/banners/types";
import { DEFAULT_HERO_DESCRIPTION, HERO_DEFAULTS } from "@/features/home/data/hero-slides";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 7000;

type HeroSliderProps = {
  slides: HeroBanner[];
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function HeroSlider({ slides }: HeroSliderProps) {
  const shouldReduceMotion = useReducedMotion();
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  // Slides whose image failed to load (e.g. a broken external CDN URL) fall
  // back to a branded placeholder instead of breaking the slider.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  const markFailed = useCallback((id: string) => {
    setFailed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const goTo = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );
  const goNext = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const goPrev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);

  const autoplayActive = isPlaying && !isInteracting && !shouldReduceMotion && count > 1;

  useEffect(() => {
    if (!autoplayActive) return;
    const timer = window.setTimeout(goNext, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplayActive, index, goNext]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  };

  // Banner-driven headline for the ACTIVE slide when the CMS provides a title;
  // otherwise the institution's name keeps the hero stable and branded. The
  // heading element itself stays persistent (never re-animates with slides),
  // and each banner's own Show Heading setting controls whether it renders.
  const activeSlide = slides[index] ?? slides[0];
  const headline =
    activeSlide?.title?.trim() || "Midwest Association of Shia Organized Muslims";
  const showHeading = activeSlide?.showTitle !== false;
  // Per-banner visible description. Empty/null (an intentionally blank CMS
  // value) renders no paragraph at all — no empty gap. The approved default
  // copy applies only when no CMS slide data exists at all.
  const description =
    activeSlide == null
      ? DEFAULT_HERO_DESCRIPTION
      : (activeSlide.description?.trim() || null);
  // Per-banner eyebrow and CTA buttons. Null (intentionally empty/hidden)
  // renders nothing — no element, no decorative line, no wrapper gap. The
  // approved defaults apply only when no CMS slide data exists at all.
  const eyebrow =
    activeSlide == null
      ? HERO_DEFAULTS.eyebrow
      : (activeSlide.eyebrow?.trim() || null);
  const primaryCta =
    activeSlide == null ? HERO_DEFAULTS.primaryCta : activeSlide.primaryCta;
  const secondaryCta =
    activeSlide == null ? HERO_DEFAULTS.secondaryCta : activeSlide.secondaryCta;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="MASOM highlights"
      className="relative isolate overflow-hidden bg-ink-900"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={() => setIsInteracting(false)}
      onKeyDown={handleKeyDown}
    >
      <div className="relative h-[58vh] min-h-[400px] w-full sm:h-[64vh] lg:h-[600px] xl:h-[640px]">
        {slides.map((slide, i) => {
          const isActive = i === index;
          return (
            <motion.div
              key={slide.id}
              className="absolute inset-0"
              aria-hidden={!isActive}
              initial={false}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.9,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ pointerEvents: isActive ? "auto" : "none" }}
            >
              <motion.div
                className="absolute inset-0"
                animate={{ scale: isActive && !shouldReduceMotion ? 1.06 : 1 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : AUTOPLAY_MS / 1000 + 1,
                  ease: "linear",
                }}
              >
                {failed.has(slide.id) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900">
                    <p className="max-w-md px-6 text-center text-lg font-medium text-white/90 sm:text-xl">
                      {slide.alt || "MASOM"}
                    </p>
                  </div>
                ) : slide.external ? (
                  // External https images come from arbitrary validated hosts,
                  // so they are rendered with a responsive <img> instead of
                  // next/image (no remotePatterns entry per domain).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    onError={() => markFailed(slide.id)}
                  />
                ) : (
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    priority={i === 0}
                    sizes="100vw"
                    className="object-cover object-center"
                    onError={() => markFailed(slide.id)}
                  />
                )}
              </motion.div>
              {slide.href ? (
                <a
                  href={slide.href}
                  className="absolute inset-0 z-[1] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                  aria-label={slide.alt || "Open banner"}
                  tabIndex={isActive ? 0 : -1}
                  {...(isExternal(slide.href)
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                />
              ) : null}
            </motion.div>
          );
        })}

        {/* Static scrims — readable text on the left, legible controls below.
            Kept outside the slide loop so they never re-animate with slides. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-ink-900/85 via-ink-900/40 to-ink-900/5 sm:via-ink-900/30"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/20 to-ink-900/30"
        />

        {/* Persistent hero content — never shifts between slides. The wrapper
            is click-through so a CMS-provided banner link still works on the
            image; only the CTA buttons capture their own clicks. */}
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center">
          <motion.div
            className="container-page w-full"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="max-w-xl pb-16 sm:max-w-2xl sm:pb-20">
              {eyebrow ? (
                <p className="flex items-center gap-3 text-[0.7rem] font-bold tracking-[0.22em] text-sand-400 uppercase sm:text-sm">
                  <span
                    aria-hidden="true"
                    className="h-px w-8 bg-sand-400/80 sm:w-10"
                  />
                  {eyebrow}
                </p>
              ) : null}
              {showHeading ? (
                <h1 className="mt-4 text-balance text-3xl leading-[1.12] font-bold text-white sm:text-4xl lg:text-5xl xl:text-[3.35rem]">
                  {headline}
                </h1>
              ) : null}
              {description ? (
                <p className="mt-4 hidden max-w-md text-sm leading-relaxed text-white/85 sm:block sm:text-base">
                  {description}
                </p>
              ) : null}
              {primaryCta || secondaryCta ? (
                <div className="pointer-events-auto mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
                  {primaryCta ? (
                    <Link
                      href={primaryCta.href}
                      className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-bold text-white shadow-card transition-colors duration-200 hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none active:scale-[0.98] sm:text-base"
                    >
                      {primaryCta.label}
                      <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  ) : null}
                  {secondaryCta ? (
                    <Link
                      href={secondaryCta.href}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/50 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none active:scale-[0.98] sm:text-base"
                    >
                      <CalendarDaysIcon className="size-4" />
                      {secondaryCta.label}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>

        {/* Previous / next controls */}
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="absolute top-1/2 left-3 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:border-white/30 hover:bg-white/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:left-6 sm:size-11"
            >
              <ChevronLeftIcon className="size-5 sm:size-6" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="absolute top-1/2 right-3 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:border-white/30 hover:bg-white/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:right-6 sm:size-11"
            >
              <ChevronRightIcon className="size-5 sm:size-6" />
            </button>
          </>
        ) : null}

        {/* Pagination + play/pause */}
        {count > 1 ? (
          <div className="absolute inset-x-0 bottom-5 z-10 flex items-center justify-center gap-4 sm:bottom-7">
            <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
              {slides.map((slide, i) => {
                const isActive = i === index;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => goTo(i)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none",
                      isActive
                        ? "w-9 bg-brand-400 shadow-[0_0_12px_rgba(96,185,183,0.55)]"
                        : "w-2 bg-white/40 hover:bg-white/70",
                    )}
                  />
                );
              })}
            </div>

            {!shouldReduceMotion ? (
              <button
                type="button"
                onClick={() => setIsPlaying((prev) => !prev)}
                aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
                className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-colors duration-200 hover:border-white/30 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              >
                {isPlaying ? (
                  <PauseIcon className="size-3.5" />
                ) : (
                  <PlayIcon className="size-3.5" />
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        Slide {index + 1} of {count}
      </p>
    </section>
  );
}
