import { redirect } from "next/navigation";

import { CalendarView } from "@/features/calendar/components/calendar-view";
import {
  calendarBasePath,
  calendarPdfUrl,
  calendarYear,
  isSupportedCalendarYear,
} from "@/features/calendar/config";
import { getCalendarMonth } from "@/features/calendar/queries";
import type { CalendarMonthView } from "@/features/calendar/types";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata = createMetadata({
  title: `Hijri Prayer Calendar ${calendarYear} — MASOM`,
  description: `MASOM's ${calendarYear} Hijri calendar for Chicago: daily Fajr, Sunrise, Zohar, Sunset, Maghrib and Midnight prayer timings, Hijri dates and Islamic events.`,
  path: calendarBasePath,
});

/**
 * "Today" in MASOM's local timezone (Chicago) as YYYY-MM-DD, so the matching
 * row is highlighted. Kept here (not in the server-only query module) because
 * it is presentation state passed to a component.
 */
function chicagoTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current Gregorian month (1-12) in MASOM's local timezone (Chicago). */
function chicagoCurrentMonth(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "numeric",
    }).format(new Date()),
  );
}

/** Parses the ?month= URL parameter; falls back to the current month on any
 * missing or out-of-range value. */
function resolveMonthParam(raw: string | string[] | undefined, fallback: number): number {
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : fallback;
}

/** Parses the ?year= URL parameter as a number, or null when missing/invalid. */
function parseYearParam(raw: string | string[] | undefined): number | null {
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  return Number.isInteger(value) ? value : null;
}

function emptyMonth(year: number, month: number): CalendarMonthView {
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { year, month, monthLabel, days: [] };
}

export default async function HijriCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; year?: string | string[] }>;
}) {
  const params = await searchParams;
  // An explicit ?year= that is not a supported calendar year (2023–2029) never
  // renders another year's data under the invalid URL — the request is
  // redirected to the canonical calendar path with the bogus parameter dropped
  // (same month when a valid ?month= is present, no silent cross-year view).
  const explicitYear = parseYearParam(params.year);
  if (explicitYear !== null && !isSupportedCalendarYear(explicitYear)) {
    const monthParam = resolveMonthParam(params.month, 0);
    redirect(
      monthParam >= 1 && monthParam <= 12
        ? `${calendarBasePath}?month=${monthParam}`
        : calendarBasePath,
    );
  }
  const selectedYear = explicitYear !== null && isSupportedCalendarYear(explicitYear)
    ? explicitYear
    : calendarYear;
  // When no month is requested, only the shipped year opens on the current
  // month — historical years open on January (there is no "current" month in
  // 2025 to land on).
  const selectedMonth = resolveMonthParam(
    params.month,
    selectedYear === calendarYear ? chicagoCurrentMonth() : 1,
  );
  const monthView =
    (await getCalendarMonth(selectedYear, selectedMonth)) ?? emptyMonth(selectedYear, selectedMonth);
  return (
    <CalendarView
      year={selectedYear}
      month={monthView}
      todayISO={chicagoTodayISO()}
      pdfUrl={calendarPdfUrl}
    />
  );
}
