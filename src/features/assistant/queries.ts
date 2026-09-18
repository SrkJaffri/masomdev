import "server-only";

import {
  hasProvisionalTimings,
  hijriMonthName,
  hijriMonthNames,
  supportedCalendarYears,
} from "@/features/calendar/config";
import { createHijriResolver } from "@/features/calendar/hijri";
import { chicagoTodayISO, createDayEventResolver } from "@/features/calendar/queries";
import type {
  CalendarDayRow,
  CalendarEventRow,
  HijriMonthRow,
  HijriOverrideRow,
} from "@/features/calendar/types";
import { prayerTimeLabels } from "@/features/prayer-calendar/config";
import { formatStoredTime } from "@/features/prayer-calendar/lib/next-prayer";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseCalendarClient } from "@/lib/supabase/public";

import { matchEvents } from "./event-matching";

/**
 * Grounded data access for the MASOM Assistant.
 *
 * Every MASOM-specific fact the assistant can state originates here, from the
 * same tables and the SAME resolvers the website itself renders. There is no
 * query builder exposed to the model: these are fixed, parameterised reads.
 */

const MIN_YEAR = Math.min(...supportedCalendarYears);
const MAX_YEAR = Math.max(...supportedCalendarYears);

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2026-01-28" → "Wednesday, 28 January 2026". */
function formatGregorianLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The Gregorian year MASOM is currently in (Chicago). */
export function currentCalendarYear(): number {
  const year = Number(chicagoTodayISO().slice(0, 4));
  if (year < MIN_YEAR) return MIN_YEAR;
  if (year > MAX_YEAR) return MAX_YEAR;
  return year;
}

/** Every day of a Gregorian year as ISO strings. */
function yearDates(year: number): string[] {
  const dates: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const total = daysInMonth(year, month);
    for (let day = 1; day <= total; day += 1) {
      dates.push(`${year}-${pad(month)}-${pad(day)}`);
    }
  }
  return dates;
}

// ===========================================================================
// Calendar events
// ===========================================================================

export type EventOccurrence = {
  title: string;
  category: string | null;
  description: string | null;
  /** "YYYY-MM-DD" in MASOM's published calendar. */
  date: string;
  dateLabel: string;
  hijriLabel: string | null;
};

export type FindEventResult = {
  year: number;
  /** Matched occurrences, sorted by date. */
  occurrences: EventOccurrence[];
  /** True when the question was too generic to identify one event. */
  needsMoreDetail: boolean;
  /** Distinct event titles matched — lets the assistant offer a choice. */
  matchedTitles: string[];
  /** True when timings/dates for this year are the provisional baseline. */
  provisional: boolean;
};

/**
 * Resolves a visitor's event name to its real MASOM calendar date(s).
 *
 * The title is matched tolerantly (English / Roman Urdu / partial), but the
 * DATE is always produced by the published calendar engine — the recurring
 * Hijri anchors are matched FORWARD against every resolved day of the year,
 * exactly like the public calendar and the admin event list. A recurring event
 * can legitimately occur twice in one Gregorian year (the Hijri year shifts
 * ~11 days), and both occurrences are returned rather than silently dropped.
 */
export async function findCalendarEvent(
  eventName: string,
  year: number,
): Promise<FindEventResult | null> {
  try {
    const supabase = createSupabaseCalendarClient();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const [eventsRes, monthsRes, overridesRes] = await Promise.all([
      supabase
        .from("calendar_events")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      // All boundaries: resolving early January needs December's boundary.
      supabase.from("hijri_months").select("*").eq("is_published", true),
      supabase
        .from("hijri_overrides")
        .select("*")
        .eq("is_published", true)
        .gte("gregorian_date", start)
        .lte("gregorian_date", end),
    ]);

    for (const res of [eventsRes, monthsRes, overridesRes]) {
      if (res.error) throw res.error;
    }

    const events = (eventsRes.data as CalendarEventRow[] | null) ?? [];
    const months = (monthsRes.data as HijriMonthRow[] | null) ?? [];
    const overrides = (overridesRes.data as HijriOverrideRow[] | null) ?? [];

    const outcome = matchEvents(
      eventName,
      events.map((event) => ({
        id: event.id,
        title: event.title,
        category: event.category ?? "",
      })),
    );

    if (outcome.matches.length === 0) {
      return {
        year,
        occurrences: [],
        needsMoreDetail: outcome.needsMoreDetail,
        matchedTitles: [],
        provisional: hasProvisionalTimings(year),
      };
    }

    const matchedIds = new Set(outcome.matches.map((entry) => entry.candidate.id));
    const matchedEvents = events.filter((event) => matchedIds.has(event.id));

    // Same matcher as the public calendar — one event-resolution implementation.
    const resolveDayEvents = createDayEventResolver(matchedEvents, months, overrides);
    const resolveHijri = createHijriResolver(months, overrides);

    const occurrences: EventOccurrence[] = [];
    for (const date of yearDates(year)) {
      for (const event of resolveDayEvents(date)) {
        const hijri = resolveHijri(date);
        occurrences.push({
          title: event.title,
          category: event.category,
          description: event.description,
          date,
          dateLabel: formatGregorianLong(date),
          hijriLabel: hijri
            ? `${hijri.day} ${hijri.monthName} ${hijri.year} AH`
            : null,
        });
      }
    }

    occurrences.sort((a, b) => a.date.localeCompare(b.date));

    return {
      year,
      occurrences,
      needsMoreDetail: outcome.needsMoreDetail,
      matchedTitles: [...new Set(outcome.matches.map((entry) => entry.candidate.title))],
      provisional: hasProvisionalTimings(year),
    };
  } catch (error) {
    logCmsError("assistant:findCalendarEvent", error);
    return null;
  }
}

// ===========================================================================
// Prayer timings
// ===========================================================================

export type PrayerTimesResult = {
  date: string;
  dateLabel: string;
  hijriLabel: string | null;
  timings: Array<{ label: string; time: string | null }>;
  /** Events falling on this date, so "today" questions are fully answered. */
  events: Array<{ title: string; category: string | null }>;
  /** True when this year's timings are the provisional baseline copy. */
  provisional: boolean;
  /** True when no published row exists for the date. */
  missing: boolean;
};

/**
 * MASOM's published prayer timings for one date (default: today in Chicago),
 * with that day's Hijri date and any Islamic events. Imsaak is deliberately
 * excluded — it is stored but never published, matching the website.
 */
export async function getPrayerTimes(date?: string): Promise<PrayerTimesResult | null> {
  const target = date ?? chicagoTodayISO();
  const year = Number(target.slice(0, 4));

  try {
    const supabase = createSupabaseCalendarClient();

    const [dayRes, monthsRes, overrideRes, eventsRes] = await Promise.all([
      supabase
        .from("calendar_days")
        .select("*")
        .eq("gregorian_date", target)
        .eq("is_published", true)
        .maybeSingle(),
      supabase.from("hijri_months").select("*").eq("is_published", true),
      supabase
        .from("hijri_overrides")
        .select("*")
        .eq("is_published", true)
        .eq("gregorian_date", target)
        .maybeSingle(),
      supabase
        .from("calendar_events")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    for (const res of [dayRes, monthsRes, overrideRes, eventsRes]) {
      if (res.error) throw res.error;
    }

    const row = (dayRes.data as CalendarDayRow | null) ?? null;
    const months = (monthsRes.data as HijriMonthRow[] | null) ?? [];
    const override = (overrideRes.data as HijriOverrideRow | null) ?? null;
    const events = (eventsRes.data as CalendarEventRow[] | null) ?? [];

    const overrides = override ? [override] : [];
    const hijri = createHijriResolver(months, overrides)(target);
    const dayEvents = createDayEventResolver(events, months, overrides)(target);

    return {
      date: target,
      dateLabel: formatGregorianLong(target),
      hijriLabel: hijri ? `${hijri.day} ${hijri.monthName} ${hijri.year} AH` : null,
      timings: (
        ["fajr", "sunrise", "zohar", "sunset", "maghrib", "midnight"] as const
      ).map((key) => ({
        label: prayerTimeLabels[key],
        // Stored as the compact "4:31a"; expanded exactly like the website.
        time: row?.[key] ? formatStoredTime(row[key] as string) : null,
      })),
      events: dayEvents.map((event) => ({ title: event.title, category: event.category })),
      provisional: hasProvisionalTimings(year),
      missing: row === null,
    };
  } catch (error) {
    logCmsError("assistant:getPrayerTimes", error);
    return null;
  }
}

// ===========================================================================
// Hijri month boundaries
// ===========================================================================

export type HijriMonthResult = {
  monthName: string;
  /** Occurrences of that Hijri month starting inside the requested year. */
  starts: Array<{
    hijriYear: number;
    startDate: string;
    startLabel: string;
    endDate: string | null;
    endLabel: string | null;
  }>;
  year: number;
};

/** Resolve a month name (any supported spelling) to its number, else null. */
export function resolveHijriMonthNumber(input: string): number | null {
  const wanted = input.toLowerCase().replace(/[^a-z]/g, "");
  if (!wanted) return null;

  const aliases: Record<string, number> = {
    muharram: 1, moharram: 1, muharam: 1,
    safar: 2, saphar: 2,
    rabiulawwal: 3, rabiawwal: 3, rabiul: 3, rabi1: 3, rabiulawal: 3,
    rabiussaani: 4, rabiussani: 4, rabiuthani: 4, rabi2: 4, rabiulsani: 4,
    jamadiulawwal: 5, jamadiawwal: 5, jumadaulawwal: 5, jamadi1: 5,
    jamadiussaani: 6, jamadiussani: 6, jumadaalthani: 6, jamadi2: 6,
    rajab: 7, rajjab: 7,
    shaabaan: 8, shaban: 8, shabaan: 8, shaaban: 8,
    ramzan: 9, ramadan: 9, ramadhan: 9, ramzaan: 9,
    shawwal: 10, shawaal: 10, shawal: 10,
    zeeqaad: 11, zeeqaad1: 11, ziqaad: 11, zilqaad: 11, zilqad: 11, zulqada: 11,
    zilhajj: 12, zilhaj: 12, zilhijjah: 12, zulhijjah: 12, zilhij: 12,
  };

  if (aliases[wanted]) return aliases[wanted];

  // Fall back to the canonical MASOM spellings themselves.
  for (const [number, name] of Object.entries(hijriMonthNames)) {
    if (name.toLowerCase().replace(/[^a-z]/g, "") === wanted) return Number(number);
  }
  return null;
}

/**
 * When a Hijri month begins and ends in a given Gregorian year, straight from
 * the published `hijri_months` boundaries — so "Ramzan kab se hai?" is never
 * answered from the model's own calendar arithmetic.
 */
export async function getHijriMonthDates(
  monthNumber: number,
  year: number,
): Promise<HijriMonthResult | null> {
  try {
    const supabase = createSupabaseCalendarClient();
    const { data, error } = await supabase
      .from("hijri_months")
      .select("*")
      .eq("is_published", true)
      .order("gregorian_start", { ascending: true });

    if (error) throw error;

    const months = (data as HijriMonthRow[] | null) ?? [];
    const starts: HijriMonthResult["starts"] = [];

    months.forEach((month, index) => {
      if (month.hijri_month !== monthNumber) return;
      if (!month.gregorian_start.startsWith(`${year}-`)) return;

      // The published month runs until the day before the next boundary.
      const next = months[index + 1];
      let endDate: string | null = null;
      if (next) {
        const [y, m, d] = next.gregorian_start.split("-").map(Number);
        const previous = new Date(Date.UTC(y, m - 1, d - 1));
        endDate = previous.toISOString().slice(0, 10);
      }

      starts.push({
        hijriYear: month.hijri_year,
        startDate: month.gregorian_start,
        startLabel: formatGregorianLong(month.gregorian_start),
        endDate,
        endLabel: endDate ? formatGregorianLong(endDate) : null,
      });
    });

    return { monthName: hijriMonthName(monthNumber), starts, year };
  } catch (error) {
    logCmsError("assistant:getHijriMonthDates", error);
    return null;
  }
}
