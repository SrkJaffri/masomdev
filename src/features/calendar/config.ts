import type { PrayerTimeKey } from "@/features/prayer-calendar/types";

/**
 * MASOM's Hijri month names, in the exact spelling used on the printed
 * calendar. Indexed by the standard Islamic month number (1 = Muharram).
 * Month numbers live in the database; the human spelling lives here so it is
 * easy to adjust without a migration.
 */
export const hijriMonthNames: Record<number, string> = {
  1: "Muharram",
  2: "Safar",
  3: "Rabi-ul-Awwal",
  4: "Rabi-us-Saani",
  5: "Jamadi-ul-Awwal",
  6: "Jamadi-us-Saani",
  7: "Rajab",
  8: "Shaabaan",
  9: "Ramzan",
  10: "Shawwal",
  11: "Zeeqa'ad",
  12: "Zilhajj",
};

export function hijriMonthName(month: number): string {
  return hijriMonthNames[month] ?? `Month ${month}`;
}

/** Suggested event categories for the admin dropdown (free text still allowed). */
export const eventCategories = [
  "Wiladat",
  "Martyrdom",
  "Wafat",
  "Eid",
  "Shab",
  "Ziarat",
  "Historical",
  "Other",
] as const;

/**
 * The six prayer-timing fields MASOM publishes, in display order, with their
 * exact labels. Imsaak is intentionally NOT here — it is stored in the database
 * but never shown publicly.
 */
export const publicTimingOrder: PrayerTimeKey[] = [
  "fajr",
  "sunrise",
  "zohar",
  "sunset",
  "maghrib",
  "midnight",
];

/** The calendar year this deployment ships with (the default/public URL year). */
export const calendarYear = 2026;

/**
 * Every Gregorian year with a complete, published calendar in the database.
 * 2025 is the historical pilot (official imported data); 2026 is the shipped
 * year. The public year dropdown is generated from this list — adding a future
 * year to the public site is a data task, not a UI change.
 */
export const supportedCalendarYears = [2025, 2026] as const;

export type SupportedCalendarYear = (typeof supportedCalendarYears)[number];

export function isSupportedCalendarYear(value: number): value is SupportedCalendarYear {
  return (supportedCalendarYears as readonly number[]).includes(value);
}

/** Canonical public route for the calendar (legacy-compatible). */
export const calendarBasePath = "/hijricalendar2026";

/** Stable public URL of the official MASOM yearly calendar PDF. */
export const calendarPdfUrl = "/masom-calendar-2026.pdf";
