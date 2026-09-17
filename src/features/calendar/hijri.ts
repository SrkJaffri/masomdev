import { hijriMonthName } from "./config";
import type { HijriDate, HijriMonthRow, HijriOverrideRow } from "./types";

/**
 * Converts a "YYYY-MM-DD" string into a whole day-number (days since the Unix
 * epoch, in UTC). Using UTC avoids the classic off-by-one that happens when a
 * local timezone is west of UTC and `new Date("2026-03-08")` rolls back a day.
 */
export function toDayNumber(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Inverse of {@link toDayNumber}: "YYYY-MM-DD" for a whole-day number. */
function fromDayNumber(dayNumber: number): string {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

export type HijriResolver = (gregorianISO: string) => HijriDate | null;

/**
 * Inverse of {@link HijriResolver}: maps an authoritative Hijri identity
 * (year/month/day) back to the Gregorian "YYYY-MM-DD" it currently resolves to.
 * The mapping is pure boundary arithmetic plus overrides — no baked-in shifts.
 *
 * A recurring event passes `year: null` — it resolves through the latest
 * published boundary's Hijri year (the current occurrence), so it renders in
 * EVERY Gregorian year the boundaries cover (2025's 1446 days included).
 */
export type HijriToGregorian = (hijri: {
  year: number | null;
  month: number;
  day: number;
}) => string | null;

type MonthBoundary = Pick<
  HijriMonthRow,
  "hijri_year" | "hijri_month" | "gregorian_start"
>;
type Override = Pick<
  HijriOverrideRow,
  "gregorian_date" | "hijri_year" | "hijri_month" | "hijri_day"
>;

/**
 * Builds the Hijri-date engine. Given the stored month-start boundaries and any
 * explicit per-day overrides, it returns a function that maps any Gregorian
 * "YYYY-MM-DD" to its Hijri date.
 *
 * Rules — deliberately explicit, nothing hidden:
 *   1. If an override row exists for the exact date, that Hijri date wins.
 *   2. Otherwise the date is derived from the latest month-start boundary at or
 *      before it: day-of-month = (date - boundaryStart) + 1.
 *
 * There is no baked-in +1/-1 anywhere. To shift a whole month, move its row in
 * `hijri_months`; to fix a single day (e.g. a month-end sighting adjustment),
 * add a row in `hijri_overrides`. Both are visible data, not code.
 */
export function createHijriResolver(
  months: MonthBoundary[],
  overrides: Override[] = [],
): HijriResolver {
  const sorted = months
    .map((m) => ({ ...m, start: toDayNumber(m.gregorian_start) }))
    .sort((a, b) => a.start - b.start);

  const overrideMap = new Map(overrides.map((o) => [o.gregorian_date, o] as const));

  return (gregorianISO) => {
    const override = overrideMap.get(gregorianISO);
    if (override) {
      return {
        year: override.hijri_year,
        month: override.hijri_month,
        day: override.hijri_day,
        monthName: hijriMonthName(override.hijri_month),
        source: "override",
      };
    }

    const target = toDayNumber(gregorianISO);
    let match: (typeof sorted)[number] | null = null;
    for (const boundary of sorted) {
      if (boundary.start <= target) match = boundary;
      else break;
    }
    if (!match) return null;

    return {
      year: match.hijri_year,
      month: match.hijri_month,
      day: target - match.start + 1,
      monthName: hijriMonthName(match.hijri_month),
      source: "derived",
    };
  };
}

/**
 * Builds the inverse engine: given an authoritative Hijri date
 * (hijri_year / hijri_month / hijri_day) it returns the Gregorian "YYYY-MM-DD"
 * that the current month boundaries resolve it to.
 *
 * Rules:
 *   1. If an override row exists for that exact Hijri day, its gregorian_date
 *      wins (mirrors the forward resolver's override rule).
 *   2. Otherwise the date is `hijri_months.gregorian_start + (hijri_day - 1)`
 *      for the matching (hijri_year, hijri_month) row. A NULL year (recurring
 *      event) uses the latest published boundary's Hijri year.
 *   3. If no boundary row exists for that month (e.g. a yet-unpublished month),
 *      the previous published boundary is used to count forward, so events never
 *      disappear just because a month is temporarily unpublished.
 *
 * This is what makes events "hijri-anchored": moving a row in `hijri_months`
 * automatically moves every event anchored to that Hijri month.
 */
export function createHijriToGregorian(
  months: MonthBoundary[],
  overrides: Override[] = [],
): HijriToGregorian {
  const byMonth = new Map<string, { year: number; month: number; start: number }>();
  let latestStart = -Infinity;
  let latestYear: number | null = null;
  for (const m of months) {
    byMonth.set(`${m.hijri_year}-${m.hijri_month}`, {
      year: m.hijri_year,
      month: m.hijri_month,
      start: toDayNumber(m.gregorian_start),
    });
    const start = toDayNumber(m.gregorian_start);
    if (start > latestStart) {
      latestStart = start;
      latestYear = m.hijri_year;
    }
  }

  const overrideMap = new Map(
    overrides.map(
      (o) =>
        [
          `${o.hijri_year}-${o.hijri_month}-${o.hijri_day}`,
          o.gregorian_date,
        ] as const,
    ),
  );

  return ({ year, month, day }) => {
    // A recurring event (year NULL) resolves in the latest published Hijri
    // year — the current occurrence of the annual cycle.
    const resolvedYear = year ?? latestYear;
    if (resolvedYear === null) return null;

    const overrideDate = overrideMap.get(`${resolvedYear}-${month}-${day}`);
    if (overrideDate) return overrideDate;

    let boundary = byMonth.get(`${resolvedYear}-${month}`);
    let elapsedDays = 0;
    if (!boundary) {
      // Fall back to the most recent published boundary strictly before the
      // requested month, then count forward through alternating month lengths
      // (odd months = 30 days, even months = 29). This keeps events anchored
      // even while a month boundary is temporarily unpublished.
      const target = resolvedYear * 12 + (month - 1);
      let candidate: { year: number; month: number; start: number } | null = null;
      let candidateIndex = -1;
      for (const b of byMonth.values()) {
        const idx = b.year * 12 + (b.month - 1);
        if (idx < target && idx > candidateIndex) {
          candidate = b;
          candidateIndex = idx;
        }
      }
      if (!candidate) return null;
      boundary = candidate;
      for (let i = candidateIndex; i < target; i++) {
        const monthNum = (i % 12) + 1; // months are numbered 1..12
        elapsedDays += monthNum % 2 === 1 ? 30 : 29;
      }
    }

    return fromDayNumber(boundary.start + elapsedDays + (day - 1));
  };
}
