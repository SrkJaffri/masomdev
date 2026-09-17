import { z } from "zod";

import {
  boolFromForm,
  optionalText,
  requiredDate,
  requiredText,
  sortOrderFromForm,
} from "@/lib/cms/validation";

/**
 * A MASOM clock time such as "5:55a", "12:19a" or "1:01p". Optional: an empty
 * field becomes null. The format is intentionally lenient (it also accepts
 * "5:55am") so that admins are guided without rejecting valid printed values.
 */
const optionalClockTime = z
  .string()
  .trim()
  .max(12)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || /^\d{1,2}:\d{2}\s?[ap]\.?m?\.?$/i.test(value), {
    message: 'Use a time like "5:55a" or "1:01p".',
  });

const hijriYear = z.coerce
  .number({ message: "Enter a Hijri year." })
  .int()
  .min(1);
const hijriMonth = z.coerce
  .number({ message: "Choose a Hijri month." })
  .int()
  .min(1)
  .max(12);
const hijriDay = z.coerce
  .number({ message: "Enter a day (1-30)." })
  .int()
  .min(1)
  .max(30);

// ---------------------------------------------------------------------------
// calendar_days — the six published timings (+ imsaak, stored only).
// ---------------------------------------------------------------------------
export const calendarDayFormSchema = z.object({
  gregorian_date: requiredDate,
  imsaak: optionalClockTime,
  fajr: optionalClockTime,
  sunrise: optionalClockTime,
  zohar: optionalClockTime,
  sunset: optionalClockTime,
  maghrib: optionalClockTime,
  midnight: optionalClockTime,
  is_published: boolFromForm,
});
export type CalendarDayFormValues = z.infer<typeof calendarDayFormSchema>;

// ---------------------------------------------------------------------------
// hijri_months — a single month-start boundary.
// ---------------------------------------------------------------------------
export const hijriMonthFormSchema = z.object({
  hijri_year: hijriYear,
  hijri_month: hijriMonth,
  gregorian_start: requiredDate,
  is_published: boolFromForm,
});
export type HijriMonthFormValues = z.infer<typeof hijriMonthFormSchema>;

// ---------------------------------------------------------------------------
// hijri_overrides — an explicit per-day Hijri correction.
// ---------------------------------------------------------------------------
export const hijriOverrideFormSchema = z.object({
  gregorian_date: requiredDate,
  hijri_year: hijriYear,
  hijri_month: hijriMonth,
  hijri_day: hijriDay,
  note: optionalText(300),
  is_published: boolFromForm,
});
export type HijriOverrideFormValues = z.infer<typeof hijriOverrideFormSchema>;

// ---------------------------------------------------------------------------
// calendar_events — an Islamic event anchored to an authoritative Hijri date.
// An EMPTY Hijri year means the event RECURS every Hijri year (canonical
// recurring model, hijri_year stored as NULL); a filled year pins it to that
// one Hijri year. The Gregorian date is derived live from the current
// hijri_months boundaries, so it is NOT part of the form (computed server-side).
// ---------------------------------------------------------------------------
const hijriYearOrRecurring = z.preprocess(
  (value) => (value === null || value === "" || value === undefined ? null : value),
  z
    .coerce
    .number({ message: "Enter a Hijri year or leave blank for every year." })
    .int()
    .min(1)
    .nullable(),
);

export const calendarEventFormSchema = z.object({
  hijri_year: hijriYearOrRecurring,
  hijri_month: hijriMonth,
  hijri_day: hijriDay,
  title: requiredText(200),
  description: optionalText(2000),
  category: optionalText(60),
  is_active: boolFromForm,
  sort_order: sortOrderFromForm,
});
export type CalendarEventFormValues = z.infer<typeof calendarEventFormSchema>;
