"use client";

import Image from "next/image";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  XIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/website/reveal";
import { titleCase } from "@/lib/format/title-case";
import { cn } from "@/lib/utils";
import type { ProgramCard } from "@/features/programs/types";

/** Parses an ISO date as UTC so the displayed day never drifts across timezones. */
function formatProgramDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return {
    day,
    year,
    month: utc.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    weekday: utc.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
  };
}

/** Fallback title for poster-only programs so the modal header is never empty. */
function fallbackTitle(date: ReturnType<typeof formatProgramDate>) {
  return `MASOM Program — ${date.month} ${date.day}, ${date.year}`;
}

/**
 * Builds a reliable "Add to Google Calendar" link from the available program
 * data. The public card model exposes times only as a display label, so the
 * event is added as an all-day entry for its date rather than guessing a time
 * fragment.
 */
function buildGoogleCalendarUrl(program: ProgramCard): string {
  const date = program.startDate.replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: program.title ?? "MASOM Program",
    dates: `${date}/${date}`,
    details: program.description ?? "",
    location: program.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

type ProgramCardGridProps = {
  programs: ProgramCard[];
};

const AUTOPLAY_MS = 3000;

/**
 * Responsive auto-playing carousel of upcoming program cards. Shows one card
 * on phones, two on tablets and three on desktop; every program stays reachable
 * via the arrow buttons, pagination dots or a swipe. When everything already
 * fits on one page the carousel collapses to a plain row (no controls), so the
 * section never becomes an unnecessarily tall block no matter how many programs
 * are upcoming.
 *
 * When the programs overflow the viewport, autoplay advances one page every
 * AUTOPLAY_MS and loops seamlessly: the track then renders the programs twice,
 * and after the last page the carousel slides one extra page into the duplicate
 * copy (visually identical to the first page) and snaps its position back
 * invisibly. When everything fits on one page — one program on mobile, two on
 * tablets, up to three on desktop — the track renders each program exactly
 * once with no clones, no controls and no autoplay, so a small dataset can
 * never appear duplicated. Autoplay pauses while hovered, focused, dragged,
 * while the details modal is open, when the tab is hidden, and for
 * prefers-reduced-motion.
 */
export function ProgramCardGrid({ programs }: ProgramCardGridProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const measureCardRef = useRef<HTMLLIElement>(null);
  const reduceMotion = useReducedMotion();

  const [cardWidth, setCardWidth] = useState(0);
  const [gap, setGap] = useState(0);
  const [visibleCount, setVisibleCount] = useState(1);
  const [measured, setMeasured] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  // Index of the last committed render — lets the wrap-around snap back to
  // page 0 with a zero-duration transition (invisible, not a reverse sweep).
  const prevIndexRef = useRef(0);
  useEffect(() => {
    prevIndexRef.current = index;
  }, [index]);

  const count = programs.length;
  const maxIndex = Math.max(0, count - visibleCount);
  const maxOffset = -maxIndex * (cardWidth + gap);
  const offset = -index * (cardWidth + gap);
  const canPrev = index > 0;
  const canNext = index < maxIndex;
  const activeIndex = index > maxIndex ? 0 : index;

  // The track renders the programs twice ONLY while the dataset overflows the
  // viewport (maxIndex > 0) AND the viewport has actually been measured: the
  // second copy exists solely for the seamless wrap-around slide and stays
  // inert + off-screen. Rendering it earlier (server HTML / first paint, or
  // when everything already fits — a single program, or two programs on
  // desktop) would lay the clones inside the visible area as literal duplicate
  // cards, so only the real programs render — one CMS record, one card, ever.
  const items =
    count > 0 && measured && maxIndex > 0 ? [...programs, ...programs] : programs;

  // Measure the first card and the visible viewport width, then derive how many
  // cards fit per breakpoint so the slide offset tracks the real rendered width
  // (responsive by nature). The viewport (not the track) is measured because the
  // track is twice as wide with its duplicate copy. Card widths come from fixed
  // CSS classes, so a plain resize listener plus a next-frame double-check is
  // all that's needed.
  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    const measure = () => {
      const track = trackRef.current;
      const card = measureCardRef.current;
      const viewport = track?.parentElement;
      if (!track || !card || !viewport) return;
      const width = card.getBoundingClientRect().width;
      const viewportWidth = viewport.getBoundingClientRect().width;
      // Layout not ready yet (hidden tab, throttled webview, fonts still
      // loading) — retry for a bounded number of frames instead of giving up,
      // otherwise the carousel would never engage loop/controls.
      if (width <= 0 || viewportWidth <= 0) {
        if (attempts++ < 30) frame = requestAnimationFrame(measure);
        return;
      }
      setCardWidth(width);
      setGap(parseFloat(getComputedStyle(track).columnGap || "0") || 0);
      setVisibleCount(Math.max(1, Math.round(viewportWidth / width)));
      setMeasured(true);
    };

    const measureOnFrame = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    measureOnFrame();

    window.addEventListener("resize", measureOnFrame);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureOnFrame);
    };
  }, [count]);

  // Clamp the index when the visible count changes (resize/rotation).
  useEffect(() => {
    setIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  // After the final slide into the duplicate copy finishes (same content as
  // page 0), snap the position back to page 0 without a visible transition.
  useEffect(() => {
    if (index !== maxIndex + 1) return;
    const id = window.setTimeout(() => setIndex(0), 550);
    return () => window.clearTimeout(id);
  }, [index, maxIndex]);

  // Pause the timer while the browser tab is hidden.
  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Advance one page; the last page slides into the duplicate copy and the copy
  // snaps back to page 0. Manual navigation only ever reaches real pages.
  const advance = useCallback(() => {
    setIndex((i) => {
      if (i > maxIndex) return 0;
      if (i >= maxIndex) return maxIndex + 1;
      return i + 1;
    });
  }, [maxIndex]);

  // Single autoplay timer. Restarts on every index change, so a manual click,
  // swipe or dot press cleanly resets the countdown and never double-advances.
  useEffect(() => {
    if (
      reduceMotion ||
      paused ||
      modalOpen ||
      dragging ||
      !pageVisible ||
      !measured ||
      maxIndex <= 0
    ) {
      return;
    }
    const id = window.setInterval(advance, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [advance, reduceMotion, paused, modalOpen, dragging, pageVisible, index, measured, maxIndex]);

  // The final slide into the duplicate copy has the same content as page 0, so
  // snap the position back with zero duration the moment that animation ends.
  const transitionDuration =
    (prevIndexRef.current > maxIndex && index === 0) || reduceMotion ? 0 : 0.5;

  return (
    <div
      className="mt-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(next)) setPaused(false);
      }}
    >
      <div className="relative">
        <div className="overflow-hidden">
          <motion.ul
            ref={trackRef}
            aria-label="Upcoming MASOM programs"
            className="flex gap-4"
            drag={measured && maxIndex > 0 ? "x" : false}
            dragConstraints={{ left: maxOffset, right: 0 }}
            dragElastic={0.12}
            onDragStart={() => setDragging(true)}
            onDragEnd={(_, info) => {
              setDragging(false);
              // Swipe: advance a page once the gesture passes a quarter card.
              const threshold = cardWidth * 0.25;
              if (info.offset.x < -threshold) {
                setIndex((i) => Math.min(maxIndex, i + 1));
              } else if (info.offset.x > threshold) {
                setIndex((i) => Math.max(0, i - 1));
              }
            }}
            style={{ touchAction: "pan-y" }}
            animate={{ x: offset }}
            transition={{ duration: transitionDuration, ease: [0.22, 1, 0.36, 1] }}
          >
            {items.map((program, itemIndex) => (
              <li
                key={`${program.id}-${itemIndex < count ? "first" : "loop"}`}
                ref={itemIndex === 0 ? measureCardRef : undefined}
                inert={itemIndex >= count}
                className="w-full shrink-0 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.6667rem)]"
              >
                {itemIndex < count ? (
                  <Reveal className="h-full" delay={(itemIndex % 3) * 0.08}>
                    <ProgramDialog program={program} onOpenChange={setModalOpen} />
                  </Reveal>
                ) : (
                  <div className="h-full">
                    <ProgramDialog program={program} onOpenChange={setModalOpen} />
                  </div>
                )}
              </li>
            ))}
          </motion.ul>
        </div>

        {measured && maxIndex > 0 ? (
          <>
            <CarouselButton
              dir="prev"
              disabled={!canPrev}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            />
            <CarouselButton
              dir="next"
              disabled={!canNext}
              onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
            />
          </>
        ) : null}
      </div>

      {/* Pagination dots — only when there is more than one page of cards. */}
      {measured && maxIndex > 0 ? (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {Array.from({ length: maxIndex + 1 }, (_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              aria-label={`Go to slide ${dotIndex + 1}`}
              aria-current={dotIndex === activeIndex}
              onClick={() => setIndex(dotIndex)}
              className={cn(
                "h-1.5 cursor-pointer rounded-full transition-all duration-300 ease-brand focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-500",
                dotIndex === activeIndex
                  ? "w-5 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/70",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CarouselButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous programs" : "Next programs"}
      className={cn(
        "absolute top-1/2 z-10 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full",
        "border border-white/40 bg-white/15 text-white shadow-card backdrop-blur-sm",
        "transition-all duration-300 ease-brand hover:bg-white hover:text-brand-700",
        "disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white/15 disabled:hover:text-white",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-500",
        dir === "prev" ? "left-2" : "right-2",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

export function ProgramDialog({
  program,
  onOpenChange,
}: {
  program: ProgramCard;
  /** Optional listener so the carousel can pause autoplay while the dialog is open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const { day, month, weekday, year } = formatProgramDate(program.startDate);
  const displayTitle = program.title
    ? titleCase(program.title)
    : fallbackTitle({ day, month, weekday, year });

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card transition-all duration-300 outline-none hover:-translate-y-1 hover:shadow-elevated focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-500"
        >
          <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden">
            {program.posterSrc ? (
              <Image
                src={program.posterSrc}
                alt={displayTitle}
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                className="object-cover object-center transition-transform duration-[900ms] ease-brand group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-100 text-brand-500">
                <CalendarDaysIcon className="size-12" aria-hidden />
              </div>
            )}
            <div className="absolute top-3 left-3 flex flex-col items-center rounded-xl bg-white/95 px-3 py-1.5 text-center shadow-sm backdrop-blur-sm">
              <span className="text-lg leading-none font-extrabold text-ink-900">
                {day}
              </span>
              <span className="text-[0.6rem] font-bold tracking-widest text-brand-600 uppercase">
                {month}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-3.5 sm:p-4">
            <p className="text-[0.65rem] font-bold tracking-[0.16em] text-brand-600 uppercase sm:text-xs">
              {weekday}
            </p>
            {program.title ? (
              <span className="mt-1 line-clamp-2 text-sm font-bold text-foreground transition-colors duration-200 group-hover:text-brand-600 sm:text-base">
                {displayTitle}
              </span>
            ) : null}
            {program.timeLabel ? (
              <p className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground sm:text-sm">
                <ClockIcon className="size-3.5 text-brand-500 sm:size-4" />
                {program.timeLabel}
              </p>
            ) : null}
          </div>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl bg-white shadow-elevated ring-1 ring-ink-900/10 outline-none motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="sticky top-0 z-10 flex justify-end bg-gradient-to-b from-white/90 to-transparent px-3 pt-3 pb-4">
            <DialogPrimitive.Close
              aria-label="Close program details"
              className="grid size-9 place-items-center rounded-full bg-white/90 text-ink-600 shadow-sm backdrop-blur-sm transition-colors outline-none hover:bg-white hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-4 px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="relative flex h-[45vh] w-full items-center justify-center bg-sand-100/60 sm:h-[60vh]">
              {program.posterSrc ? (
                <Image
                  src={program.posterSrc}
                  alt={displayTitle}
                  fill
                  sizes="(min-width: 640px) 42rem, 90vw"
                  className="object-contain p-3"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-100 text-brand-500">
                  <CalendarDaysIcon className="size-16" aria-hidden />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <DialogPrimitive.Title className="font-heading text-xl font-bold text-ink-900 sm:text-2xl">
                {displayTitle}
              </DialogPrimitive.Title>

              <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">
                {weekday}, {month} {day}, {year}
              </p>

              <div className="flex flex-col gap-2 text-sm text-ink-600">
                {program.timeLabel ? (
                  <div className="flex items-center gap-2">
                    <ClockIcon className="size-4 shrink-0 text-brand-500" aria-hidden />
                    {program.timeLabel}
                  </div>
                ) : null}
                {program.location ? (
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="size-4 shrink-0 text-brand-500" aria-hidden />
                    {program.location}
                  </div>
                ) : null}
              </div>

              {program.description ? (
                <DialogPrimitive.Description className="mt-1 border-t border-sand-100 pt-4 text-sm leading-relaxed text-ink-600">
                  {program.description}
                </DialogPrimitive.Description>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                {program.linkUrl ? (
                  <a
                    href={program.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cta-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cta-600 focus-visible:ring-2 focus-visible:ring-cta-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    View Event Page
                    <ArrowUpRightIcon className="size-4" aria-hidden />
                  </a>
                ) : null}
                <a
                  href={buildGoogleCalendarUrl(program)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-700 inline-flex items-center gap-1.5 rounded-lg border border-sand-300 px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-400 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <CalendarPlusIcon className="size-4 text-brand-500" aria-hidden />
                  Add to Google Calendar
                </a>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
