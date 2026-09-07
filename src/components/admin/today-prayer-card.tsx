import {
  CloudSunIcon,
  LandmarkIcon,
  MoonIcon,
  MoonStarIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type {
  DailyPrayerTimings,
  NextPrayerCandidate,
  PrayerTimeSlot,
} from "@/features/prayer-calendar/types";

import { AdminNextPrayerLive } from "./admin-next-prayer-live";

const SLOT_ICONS: Record<PrayerTimeSlot["key"], ComponentType<SVGProps<SVGSVGElement>>> = {
  fajr: SunriseIcon,
  sunrise: SunIcon,
  zohar: CloudSunIcon,
  sunset: SunsetIcon,
  maghrib: MoonIcon,
  midnight: MoonStarIcon,
};

/** Lightweight decorative mosque skyline — pure SVG, aria-hidden, no image. */
function MosqueSkyline() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 420 110"
      preserveAspectRatio="xMidYMax meet"
      className="pointer-events-none absolute right-0 bottom-0 h-28 w-64 text-white opacity-[0.07] sm:h-32 sm:w-80"
    >
      <path d="M0 110 V62 Q26 28 52 62 V110 Z" fill="currentColor" />
      <path d="M64 110 V70 Q94 44 124 70 V110 Z" fill="currentColor" />
      <path d="M136 110 V58 Q168 22 200 58 V110 Z" fill="currentColor" />
      <path d="M212 110 V72 Q238 48 264 72 V110 Z" fill="currentColor" />
      <path d="M276 110 V64 Q298 40 320 64 V110 Z" fill="currentColor" />
      <path d="M332 110 V78 Q352 60 372 78 V110 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * "Today's Prayer & Hijri" — the dashboard hero card. Consumes the same live
 * calendar data as the public site (timings + next-prayer candidates are
 * fetched once by the dashboard page and passed in; nothing is hardcoded).
 */
export function TodayPrayerCard({
  timings,
  candidates,
}: {
  timings: DailyPrayerTimings;
  candidates: NextPrayerCandidate[];
}) {
  const unavailable = timings.gregorianDate === null && timings.hijriDate === null;
  const serverNow = Date.now();

  return (
    <section
      aria-labelledby="today-prayer-heading"
      className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f4c3a] via-[#0d5f4d] to-[#09382c] text-white shadow-elevated"
    >
      <MosqueSkyline />

      <div className="relative flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h2
              id="today-prayer-heading"
              className="inline-flex items-center gap-2 text-sm font-bold"
            >
              <LandmarkIcon aria-hidden="true" className="size-4 text-brand-200" />
              Today&apos;s Prayer &amp; Hijri
            </h2>
            {!unavailable ? (
              <div className="mt-2.5">
                <p className="text-lg leading-snug font-bold">{timings.gregorianDate}</p>
                {timings.hijriDate ? (
                  <p className="mt-0.5 text-sm font-semibold text-brand-200">
                    {timings.hijriDate}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <blockquote className="hidden max-w-[250px] shrink-0 rounded-xl bg-black/20 px-4 py-3 ring-1 ring-white/10 lg:block">
            <p className="text-[0.8125rem] leading-snug text-white/90 italic">
              &ldquo;And remind, for indeed the reminder benefits the believers.&rdquo;
            </p>
            <footer className="mt-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] text-white/70 uppercase">
              Qur&apos;an 51:55
            </footer>
          </blockquote>
        </div>

        {unavailable ? (
          <p className="mt-6 text-sm text-white/80">
            Today&apos;s calendar data is temporarily unavailable.
          </p>
        ) : (
          <>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {timings.slots.map((slot) => {
                const Icon = SLOT_ICONS[slot.key];
                return (
                  <li
                    key={slot.key}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-3.5 py-3 ring-1 ring-white/10"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10">
                      <Icon aria-hidden="true" className="size-4 text-brand-100" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/70">{slot.label}</p>
                      <p className="text-sm font-bold tabular-nums">
                        {slot.time ?? <span className="font-normal text-white/60">&mdash;</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {candidates.length > 0 ? (
              <div className="mt-6">
                <AdminNextPrayerLive candidates={candidates} serverNow={serverNow} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}