"use client";

import { ClockIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { formatRemaining } from "@/features/prayer-calendar/components/next-prayer-live";
import type { NextPrayerCandidate } from "@/features/prayer-calendar/types";

type AdminNextPrayerLiveProps = {
  /** Upcoming prayer candidates (same data the public card uses). */
  candidates: NextPrayerCandidate[];
  /** Server-computed "now" (epoch ms) so the initial render matches the server. */
  serverNow: number;
};

/**
 * "Next prayer" strip at the bottom of the dashboard hero card. Consumes the
 * exact same candidates + ticking logic as the public card — no second prayer
 * calculation system.
 */
export function AdminNextPrayerLive({ candidates, serverNow }: AdminNextPrayerLiveProps) {
  const [now, setNow] = useState<number>(serverNow);

  useEffect(() => {
    // Keep the ticking clock aligned with server time despite client skew.
    const skew = Date.now() - serverNow;
    const tick = () => setNow(Date.now() - skew);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  if (candidates.length === 0) return null;

  const active =
    candidates.find((candidate) => candidate.target > now) ??
    candidates[candidates.length - 1];
  const remaining = Math.max(0, active.target - now);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-[#e6f4f1] px-4 py-3 text-[#0f4c3a] dark:bg-brand-500/15 dark:text-brand-100">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/70 dark:bg-brand-500/20">
          <ClockIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold tracking-[0.16em] uppercase opacity-70">
            Next prayer
          </p>
          <p className="truncate text-sm font-bold">
            {active.name} · {active.time}
          </p>
        </div>
      </div>
      <p
        role="timer"
        className="rounded-full bg-[#0f4c3a] px-3 py-1 text-xs font-bold text-white tabular-nums dark:bg-brand-500/90 dark:text-ink-900"
      >
        in {formatRemaining(remaining)}
      </p>
    </div>
  );
}