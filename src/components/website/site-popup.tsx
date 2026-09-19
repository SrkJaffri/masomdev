"use client";

import { XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * CMS-controlled promotional popup for public pages.
 *
 * Configuration arrives fully resolved from the server via the cached public
 * Site Settings read (one fetch per request, shared with the WhatsApp button
 * and homepage CTAs) — this component performs NO Supabase calls and makes NO
 * dynamic-rendering tradeoffs. Everything time-sensitive happens after mount:
 *
 *   - render gate: enabled + artwork + current pathname ∈ popup_display_pages
 *   - delay:      popup_delay_seconds (1–10, default 3) after mount, cleaned
 *                 up on unmount/navigation so no timer leaks across routes
 *   - frequency:  "session" → sessionStorage key versioned by settings
 *                 updated_at (seen once → hidden on every selected page this
 *                 session; a CMS config/image change re-arms it), "always" →
 *                 every fresh page load
 *
 * Accessibility/behavior: built on the existing Radix Dialog primitives
 * (Escape, backdrop click, focus trap, scroll lock, focus restoration) with a
 * darker, tasteful translucent overlay. Layering z-[60] sits above the header
 * (z-40), the WhatsApp/Assistant floating widgets (z-40) and standard dialogs
 * (z-50), so the popup never fights them for attention while open.
 *
 * Sizing: the artwork stays perfectly square (object-contain, no stretching),
 * desktop caps at 650×650, and small/short viewports shrink it via
 * max-width/max-height so nothing overflows, scrolls horizontally or clips
 * the close button. The image only mounts after the delay with
 * loading="lazy" + decoding="async", so it never becomes the page's LCP
 * element or blocks rendering.
 */

/** Meaningful default alt — the approved artwork carries its own message. */
const POPUP_IMAGE_ALT =
  "MASOM website services including prayer timings, Hijri calendar, programs and community updates";

export type SitePopupConfig = {
  enabled: boolean;
  imageUrl: string;
  delaySeconds: number;
  displayPages: string[];
  frequency: "session" | "always";
  linkUrl: string;
  /** Settings row version — versioning key for the session "seen" marker. */
  version: string;
};

/** Safe click-through: internal routes and https only — mirrors the CMS validation. */
function isSafePopupHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\/(?!\/)/.test(trimmed)) return true;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

export function SitePopup({ config }: { config: SitePopupConfig }) {
  const pathname = usePathname();
  /**
   * idle   → undecided/not eligible (SSR + first paint render NOTHING, so
   *          there is no hydration mismatch and no layout shift),
   * hidden → eligible but suppressed this session (session frequency, seen),
   * ready  → delay elapsed — the dialog mounts open.
   */
  const [phase, setPhase] = useState<"idle" | "hidden" | "ready">("idle");
  const [open, setOpen] = useState(false);

  const eligible =
    config.enabled &&
    Boolean(config.imageUrl) &&
    Array.isArray(config.displayPages) &&
    config.displayPages.includes(pathname ?? "");

  // Frequency check + delayed open. Runs only when all gates pass; the timer
  // is cleaned up on unmount/effect re-run (page change), so nothing leaks.
  useEffect(() => {
    if (!eligible) {
      setPhase("idle");
      setOpen(false);
      return;
    }

    if (config.frequency === "session") {
      try {
        if (window.sessionStorage.getItem(seenKey(config.version))) {
          setPhase("hidden");
          return;
        }
      } catch {
        // sessionStorage unavailable (privacy mode) — treat as not seen.
      }
    }

    const delayMs = Math.min(Math.max(config.delaySeconds, 1), 10) * 1000;
    const timer = window.setTimeout(() => {
      if (config.frequency === "session") {
        try {
          // Mark as seen when it opens so navigating to another selected
          // page mid-display cannot trigger a second popup this session.
          window.sessionStorage.setItem(seenKey(config.version), "1");
        } catch {
          // Ignore — worst case the popup may show once more this session.
        }
      }
      setPhase("ready");
      setOpen(true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [eligible, config.frequency, config.delaySeconds, config.version, pathname]);

  const close = useCallback(() => setOpen(false), []);
  // Radix calls onOpenChange(false) for Escape, backdrop click and focus-out.
  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setOpen(false);
  }, []);

  // Not eligible, suppressed, or not yet due → render nothing at all.
  if (phase !== "ready" || !eligible) return null;

  const href = isSafePopupHref(config.linkUrl) ? config.linkUrl.trim() : null;
  const isExternal = Boolean(href && /^https?:\/\//i.test(href));

  // Fully deterministic square sizing via inline style (Tailwind arbitrary
  // calc() values proved unreliable here): the artwork box is exactly
  // min(650px, viewport-width − 2rem, viewport-height − 56px) — 650px on a
  // desktop, proportionally smaller on narrow or short viewports, always 1:1
  // (height follows the intrinsic ratio), never stretched, never overflowing.
  const artwork = (
    <Image
      src={config.imageUrl}
      alt={POPUP_IMAGE_ALT}
      width={650}
      height={650}
      loading="lazy"
      decoding="async"
      sizes="(min-width: 682px) 650px, calc(100vw - 32px)"
      style={{ width: "min(650px, calc(100vw - 2rem), calc(100dvh - 56px))" }}
      // max-w-none: preflight's img { max-width: 100% } resolves against the
      // grid track (a self-referential percentage) and clamps the artwork to
      // whatever the track settled on; the width above is already fully
      // viewport-safe, so the percentage clamp is wrong here.
      className="h-auto max-w-none rounded-xl object-contain"
    />
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay
          overlayClassName="z-[60] bg-black/70 supports-backdrop-filter:backdrop-blur-[2px] motion-reduce:animate-none"
        />
        <DialogContent
          showCloseButton={false}
          className={cn(
            // sm:max-w-[...] overrides the base sm:max-w-sm (same variant, so
            // twMerge keeps ours) — desktop caps at 650px, small screens at
            // 100vw - 2rem. The artwork itself scales proportionally.
            "z-[60] w-auto max-w-[min(650px,calc(100vw-2rem))] sm:max-w-[min(650px,calc(100vw-2rem))] gap-0",
            "rounded-xl bg-transparent p-0 shadow-none ring-0",
            "motion-reduce:animate-none",
          )}
        >
          {/* Required dialog name for assistive tech; visually the approved
              artwork IS the content, so the title is screen-reader-only. */}
          <DialogTitle className="sr-only">MASOM announcement</DialogTitle>

          {href ? (
            <Link
              href={href}
              {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-label={POPUP_IMAGE_ALT}
              className="block rounded-xl focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none"
            >
              {artwork}
            </Link>
          ) : (
            artwork
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close popup"
            className={cn(
              "absolute -top-3 -right-3 grid size-9 place-items-center rounded-full",
              "bg-white text-ink-900 shadow-elevated ring-1 ring-black/10",
              "hover:scale-105 hover:bg-white active:scale-95 motion-reduce:transition-none",
            )}
          >
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

/** Versioned sessionStorage key — a CMS config/image change re-arms the popup. */
function seenKey(version: string): string {
  return `masom-site-popup-seen:${version || "0"}`;
}
