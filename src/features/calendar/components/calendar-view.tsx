import { DownloadIcon, FileTextIcon, MapPinIcon } from "lucide-react";

import { Container } from "@/components/layout/container";
import {
  calendarYear,
  hasProvisionalTimings,
  publicTimingOrder,
} from "@/features/calendar/config";
import { NextPrayerCard } from "@/features/prayer-calendar/components/next-prayer-card";
import { prayerTimeLabels } from "@/features/prayer-calendar/config";
import type { CalendarMonthView } from "@/features/calendar/types";
import { cn } from "@/lib/utils";

import { MonthSelector } from "./month-selector";
import { YearSelector } from "./year-selector";

/** Tailwind classes for an event badge, chosen by its category. */
function categoryClass(category: string | null): string {
  const value = (category ?? "").toLowerCase();
  if (value.includes("wiladat") || value.includes("eid") || value.includes("bes")) {
    return "bg-success/12 text-success";
  }
  if (
    value.includes("martyr") ||
    value.includes("shahadat") ||
    value.includes("wafat") ||
    value.includes("shab")
  ) {
    return "bg-danger/10 text-danger";
  }
  return "bg-sand-100 text-ink-800";
}

function hijriRangeLabel(month: CalendarMonthView): string | null {
  const withHijri = month.days.filter((day) => day.hijri);
  if (withHijri.length === 0) return null;
  const first = withHijri[0].hijri!;
  const last = withHijri[withHijri.length - 1].hijri!;
  if (first.monthName === last.monthName && first.year === last.year) {
    return `${first.monthName} ${first.year} AH`;
  }
  return `${first.monthName} – ${last.monthName} ${last.year} AH`;
}

function MonthSection({
  month,
  todayISO,
}: {
  month: CalendarMonthView;
  todayISO: string;
}) {
  const hijriRange = hijriRangeLabel(month);

  return (
    <section
      id={`month-${month.month}`}
      aria-labelledby={`month-heading-${month.month}`}
      className="scroll-mt-24"
    >
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/60 bg-brand-50 px-5 py-4">
          <h2
            id={`month-heading-${month.month}`}
            className="text-lg font-bold text-foreground sm:text-xl"
          >
            {month.monthLabel}
          </h2>
          {hijriRange ? (
            <p className="text-sm font-semibold text-brand-700">{hijriRange}</p>
          ) : null}
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="sr-only">
              {month.monthLabel} — prayer timings, Hijri dates and Islamic events
            </caption>
            <thead>
              <tr className="border-b border-border/60 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Hijri</th>
                {publicTimingOrder.map((key) => (
                  <th key={key} className="px-3 py-2.5 text-center whitespace-nowrap">
                    {prayerTimeLabels[key]}
                  </th>
                ))}
                <th className="px-3 py-2.5">Events</th>
              </tr>
            </thead>
            <tbody>
              {month.days.map((day) => {
                const isToday = day.date === todayISO;
                const isFriday = day.weekday === 5;
                const hasEvents = day.events.length > 0;
                return (
                  <tr
                    key={day.date}
                    className={cn(
                      "border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40",
                      isFriday && "bg-brand-50/40",
                      hasEvents && "bg-sand-100/40",
                      isToday && "bg-brand-100/70 font-bold ring-1 ring-inset ring-brand-500/40",
                    )}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-bold text-foreground tabular-nums">
                        {day.gregorianDay}
                      </span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", {
                          weekday: "short",
                          timeZone: "UTC",
                        })}
                      </span>
                      {isToday ? (
                        <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">
                          Today
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-foreground">
                      {day.hijri ? (
                        <span className="tabular-nums">
                          <span className={isToday ? "font-bold" : "font-semibold"}>
                            {day.hijri.day}
                          </span>{" "}
                          <span className="text-muted-foreground">{day.hijri.monthName}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {day.timings.map((slot) => (
                      <td
                        key={slot.key}
                        className="px-3 py-2.5 text-center tabular-nums whitespace-nowrap text-foreground"
                      >
                        {slot.time ?? <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      {hasEvents ? (
                        <ul className="flex min-w-0 flex-col gap-1">
                          {day.events.map((event) => (
                            <li key={event.id} className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                                  categoryClass(event.category),
                                )}
                              >
                                {event.category ?? "Event"}
                              </span>
                              <span className="min-w-0 text-sm text-foreground">
                                {event.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** Subtle, single informational note under the month table for the baseline
 * years whose prayer timings are the provisional 2026-template copy. */
function ProvisionalTimingsNote({ year }: { year: number }) {
  return (
    <p
      role="note"
      className="rounded-xl border border-border/60 bg-card px-4 py-2.5 text-xs text-muted-foreground"
    >
      Prayer timings for {year} are based on the current MASOM schedule and may be
      updated when year-specific timings are published.
    </p>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <p className="text-sm text-muted-foreground">
        This month&apos;s calendar has not been published yet. Please check back soon.
      </p>
    </div>
  );
}

export function CalendarView({
  year,
  month,
  todayISO,
  pdfUrl,
}: {
  year: number;
  /** The single Gregorian month to display. */
  month: CalendarMonthView;
  todayISO: string;
  /** Stable URL of the official yearly PDF. */
  pdfUrl: string;
}) {
  const hasData = month.days.some(
    (day) => day.hijri || day.events.length > 0 || day.timings.some((slot) => slot.time),
  );
  // The official annual PDF is published per shipped year (2026 today); past
  // pilot years rely on the monthly export instead.
  const isShippedYear = year === calendarYear;
  // "Today" highlighting is inherently year-safe: todayISO is a full
  // YYYY-MM-DD of the real current date, which can never equal a historical
  // year's day (no same month/day false matches).

  return (
    <div className="bg-background pb-16">
      <div className="bg-gradient-to-b from-brand-50 to-background">
        <Container className="py-10 sm:py-14">
          <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
            Chicagoland
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Hijri Calendar {year}
            </h1>
            {isShippedYear ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <FileTextIcon aria-hidden="true" className="size-4" />
                View Official {year} Calendar PDF
              </a>
            ) : null}
          </div>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Daily prayer timings, Hijri dates and Islamic events for the MASOM community.
            Timings are maintained by MASOM and shown exactly as published.
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinIcon className="size-4 text-brand-600" />
            4353 W Lawrence Ave, Chicago, IL 60630 · Qibla 48.42° East of North
          </p>
        </Container>
      </div>

      <Container className="space-y-6">
        {/* Live upcoming-prayer card (uses only today's + tomorrow's rows). */}
        <NextPrayerCard />

        {/* Month selector toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <MonthSelector selectedMonth={month.month} selectedYear={year} />
            <YearSelector selectedYear={year} selectedMonth={month.month} />
            <a
              href={`/api/calendar/export?year=${year}&month=${month.month}&v=2`}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-500/40 bg-card px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-card transition-colors hover:border-brand-500 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <DownloadIcon aria-hidden="true" className="size-4" />
              Export {month.monthLabel} PDF
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {month.monthLabel} — use the selector to browse the {year} calendar.
          </p>
        </div>

        {hasData ? <MonthSection month={month} todayISO={todayISO} /> : <EmptyState />}

        {hasProvisionalTimings(year) ? <ProvisionalTimingsNote year={year} /> : null}
      </Container>
    </div>
  );
}
