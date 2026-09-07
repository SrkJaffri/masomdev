"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Delay so instantly-cached navigations never flash the bar. Aligned with the
 * route-loading fallback (see admin/(dashboard)/loading.tsx): for the first
 * ~200ms only the clicked nav item shows pending feedback; the bar fades in
 * for slower round-trips.
 */
const SHOW_DELAY_MS = 180;
/** Safety cap so the bar can never get stuck after a cancelled navigation. */
const MAX_VISIBLE_MS = 8000;

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  const href = anchor.getAttribute("href") ?? "";
  if (!href.startsWith("/") || href.startsWith("//")) return false; // external
  if (href.startsWith("#")) return false; // same-page anchor
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  return true;
}

/**
 * MASOM teal progress bar pinned to the top of the viewport. It shows the
 * instant a client-side admin navigation starts and hides as soon as the new
 * path renders — so slow server round-trips never look like a dead click.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const showTimer = useRef<number | null>(null);

  // Destination rendered → complete.
  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || !isInternalNavigation(anchor, event)) return;
      if (showTimer.current) window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => setActive(true), SHOW_DELAY_MS);
    };
    // Browser back/forward — show immediately, hide on pathname change.
    const onPopState = () => {
      if (showTimer.current) window.clearTimeout(showTimer.current);
      setActive(true);
    };

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
      if (showTimer.current) window.clearTimeout(showTimer.current);
    };
  }, []);

  // Never leave the bar stuck (e.g. navigation cancelled by an error).
  useEffect(() => {
    if (!active) return;
    const safety = window.setTimeout(() => setActive(false), MAX_VISIBLE_MS);
    return () => window.clearTimeout(safety);
  }, [active]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-2/5 rounded-full bg-brand-500 animate-progress",
          "shadow-[0_0_8px_rgba(92,184,178,0.8)] transition-opacity duration-200 ease-brand motion-reduce:hidden",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
