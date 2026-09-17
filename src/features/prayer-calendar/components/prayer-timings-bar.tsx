import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import {
  emptyPrayerTimeSlots,
  prayerCalendarHref,
  prayerTimingsHeading,
} from "@/features/prayer-calendar/config";
import type { DailyPrayerTimings } from "@/features/prayer-calendar/types";
import { cn } from "@/lib/utils";

const emptyTimings: DailyPrayerTimings = {
  gregorianDate: null,
  hijriDate: null,
  slots: emptyPrayerTimeSlots,
};

type PrayerTimingsBarProps = {
  timings?: DailyPrayerTimings;
  className?: string;
};

export function PrayerTimingsBar({
  timings = emptyTimings,
  className,
}: PrayerTimingsBarProps) {
  const { gregorianDate, hijriDate, slots } = timings;
  const hasDate = Boolean(gregorianDate ?? hijriDate);

  // Header-only display choice: Sunset is still published in the calendar,
  // admin, PDFs and data layer — it is just not shown in this header strip.
  // (Client request: Fajr, Sunrise, Zohar, Maghrib, Midnight.)
  const displaySlots = slots.filter((slot) => slot.key !== "sunset");

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          {prayerTimingsHeading}
        </h2>
        {hasDate ? (
          <p className="text-sm font-bold text-foreground tabular-nums sm:text-base">
            {gregorianDate}
            {hijriDate ? (
              <span className="font-normal text-muted-foreground"> ({hijriDate})</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-y-4 sm:grid-cols-5 sm:gap-y-0">
        {displaySlots.map((slot, index) => (
          <li
            key={slot.key}
            className={cn(
              "group px-2 text-center sm:px-3",
              index % 3 !== 0 && "border-l-[5px] border-sand-400",
              index % 3 === 0 && "sm:border-l-0",
              index !== 0 && "sm:border-l-[5px] sm:border-sand-400",
            )}
          >
            <p className="text-[1.0625rem] leading-tight font-bold text-primary transition-colors duration-200 group-hover:text-brand-600 sm:text-lg">
              {slot.label}
            </p>
            <p className="mt-0.5 text-base font-bold text-foreground tabular-nums sm:text-[1.0625rem]">
              {slot.time ?? <span className="text-muted-foreground">&mdash;</span>}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex justify-end">
        <Link
          href={prayerCalendarHref}
          className="group inline-flex items-center gap-1 text-sm font-bold text-link transition-colors duration-200 hover:underline hover:underline-offset-4"
        >
          Hijri Calendar
          <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
