import "server-only";

import { cache } from "react";

import { prayerTimeLabels } from "@/features/prayer-calendar/config";
import { formatStoredTime } from "@/features/prayer-calendar/lib/next-prayer";
import type { DailyPrayerTimings, PrayerTimeSlot } from "@/features/prayer-calendar/types";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseCalendarClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { adminCalendarYear, publicTimingOrder } from "./config";
import {
  createHijriResolver,
  type HijriResolver,
} from "./hijri";
import type {
  CalendarDayAdminItem,
  CalendarDayRow,
  CalendarEventAdminItem,
  CalendarEventRow,
  CalendarMonthView,
  HijriMonthAdminItem,
  HijriMonthRow,
  HijriOverrideAdminItem,
  HijriOverrideRow,
} from "./types";

// ---------------------------------------------------------------------------
// Small date helpers (UTC-based to stay timezone-safe).
// ---------------------------------------------------------------------------
function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-12; day 0 of the next month index === last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Today's date in MASOM's local timezone (Chicago), as "YYYY-MM-DD". */
export function chicagoTodayISO(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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

function buildSlots(row: CalendarDayRow | undefined): PrayerTimeSlot[] {
  return publicTimingOrder.map((key) => ({
    key,
    label: prayerTimeLabels[key],
    // Stored values use the compact "4:31a" / "12:55p" form; expand to
    // "4:31 AM" / "12:55 PM" everywhere the public UI shows them.
    time: row ? (row[key] ? formatStoredTime(row[key]) : null) : null,
  }));
}

/**
 * Builds the per-day event resolver used by every calendar view.
 *
 * Event model (migration 20260917140000):
 *   • RECURRING Islamic events carry hijri_year = NULL — "same Hijri month +
 *     same Hijri day = same event, every Hijri year". They match ANY displayed
 *     day whose resolved Hijri date equals their (month, day), whether that
 *     day belongs to 1446, 1447 or any other year (Gregorian 2025 spans two
 *     Hijri years — this is what keeps both halves covered).
 *   • Year-specific events keep an explicit hijri_year (e.g. the 1 AH
 *     Masjid-e-Quba anniversary) and match only that exact Hijri date.
 *   • Gregorian-only local events (no Hijri anchor) match their event_date.
 *
 * Recurrence identity is (hijri_month, hijri_day) — NEVER the cached
 * `event_date`, which is reference data only.
 *
 * The final list per day is deduplicated on stable logical identity
 * (anchor + normalized title + category) so a year-specific copy can never
 * double-render alongside its recurring twin.
 *
 * Exported so the MASOM Assistant resolves event dates through the SAME
 * matcher as the public calendar — there is exactly one event-matching
 * implementation in the codebase.
 */
export function createDayEventResolver(
  events: CalendarEventRow[],
  months: HijriMonthRow[],
  overrides: HijriOverrideRow[],
): (gregorianISO: string) => CalendarEventRow[] {
  const resolveHijri = createHijriResolver(months, overrides);
  const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "");

  return (gregorianISO: string) => {
    const hijri = resolveHijri(gregorianISO);
    const seen = new Set<string>();
    const matched: CalendarEventRow[] = [];

    for (const event of events) {
      let matches = false;
      let identity = "";
      if (event.hijri_month !== null && event.hijri_day !== null) {
        if (event.hijri_year === null) {
          // Recurring: matches the day's Hijri (month, day) in ANY year.
          matches =
            hijri !== null &&
            hijri.month === event.hijri_month &&
            hijri.day === event.hijri_day;
          identity =
            hijri !== null
              ? `h:${hijri.month}-${hijri.day}:${normalizeTitle(event.title)}:${event.category}`
              : "";
        } else {
          // Year-specific: matches only that exact Hijri date.
          matches =
            hijri !== null &&
            hijri.year === event.hijri_year &&
            hijri.month === event.hijri_month &&
            hijri.day === event.hijri_day;
          identity = `h:${event.hijri_month}-${event.hijri_day}:${normalizeTitle(event.title)}:${event.category}`;
        }
      } else {
        // Gregorian-only event.
        matches = event.event_date === gregorianISO;
        identity = `g:${event.event_date}:${normalizeTitle(event.title)}:${event.category}`;
      }

      if (matches && !seen.has(identity)) {
        seen.add(identity);
        matched.push(event);
      }
    }
    return matched;
  };
}

// ---------------------------------------------------------------------------
// Public reads (anon client — keeps pages statically renderable).
// ---------------------------------------------------------------------------

/**
 * The whole published calendar for a year, assembled into 12 month views with a
 * row for every day (timings, resolved Hijri date, and any events merged in).
 * Returns [] on any failure so the page can render an empty-but-valid state.
 */
export async function getCalendarMonths(year: number): Promise<CalendarMonthView[]> {
  try {
    const supabase = createSupabaseCalendarClient();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const [daysRes, monthsRes, overridesRes, eventsRes] = await Promise.all([
      supabase
        .from("calendar_days")
        .select("*")
        .eq("is_published", true)
        .gte("gregorian_date", start)
        .lte("gregorian_date", end),
      // Fetch ALL month boundaries (unfiltered by year): resolving early-January
      // needs the boundary that started in the previous December.
      supabase.from("hijri_months").select("*").eq("is_published", true),
      supabase
        .from("hijri_overrides")
        .select("*")
        .eq("is_published", true)
        .gte("gregorian_date", start)
        .lte("gregorian_date", end),
      // Fetch ALL published active events (87 rows total) and derive each
      // event's Gregorian date server-side from its Hijri anchor + current
      // boundaries. Filtering on the cached event_date would miss events the
      // moment a boundary moves; the view only emits the days in range.
      supabase
        .from("calendar_events")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    for (const res of [daysRes, monthsRes, overridesRes, eventsRes]) {
      if (res.error) throw res.error;
    }

    const days = (daysRes.data as CalendarDayRow[] | null) ?? [];
    const months = (monthsRes.data as HijriMonthRow[] | null) ?? [];
    const overrides = (overridesRes.data as HijriOverrideRow[] | null) ?? [];
    const events = (eventsRes.data as CalendarEventRow[] | null) ?? [];

    const dayMap = new Map(days.map((row) => [row.gregorian_date, row] as const));
    const resolveDayEvents = createDayEventResolver(events, months, overrides);

    const resolve: HijriResolver = createHijriResolver(months, overrides);

    const monthViews: CalendarMonthView[] = [];
    for (let month = 1; month <= 12; month += 1) {
      const total = daysInMonth(year, month);
      const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      const dayViews = [];
      for (let day = 1; day <= total; day += 1) {
        const date = isoDate(year, month, day);
        dayViews.push({
          date,
          gregorianDay: day,
          weekday: weekdayOf(date),
          hijri: resolve(date),
          timings: buildSlots(dayMap.get(date)),
          events: resolveDayEvents(date).map((event) => ({
            id: event.id,
            title: event.title,
            description: event.description,
            category: event.category,
          })),
        });
      }

      monthViews.push({ year, month, monthLabel, days: dayViews });
    }

    return monthViews;
  } catch (error) {
    logCmsError("calendar:getMonths", error);
    return [];
  }
}

/**
 * A single Gregorian month of the calendar: every day in that month with its
 * timings, resolved Hijri date and merged events. Returns null when the month
 * is out of range. Only the selected month's rows are fetched — never the whole
 * year — so the initial page does not ship 365 calendar rows to the browser.
 */
export async function getCalendarMonth(
  year: number,
  month: number,
): Promise<CalendarMonthView | null> {
  if (month < 1 || month > 12) return null;

  try {
    const supabase = createSupabaseCalendarClient();
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;

    const [daysRes, monthsRes, overridesRes, eventsRes] = await Promise.all([
      supabase
        .from("calendar_days")
        .select("*")
        .eq("is_published", true)
        .gte("gregorian_date", start)
        .lte("gregorian_date", end),
      // Fetch ALL month boundaries (13 rows): resolving early-January needs the
      // boundary that started in the previous December.
      supabase.from("hijri_months").select("*").eq("is_published", true),
      supabase
        .from("hijri_overrides")
        .select("*")
        .eq("is_published", true)
        .gte("gregorian_date", start)
        .lte("gregorian_date", end),
      // Fetch ALL published active events and derive their Gregorian dates
      // server-side from Hijri anchors (see getCalendarMonths). Only events
      // that resolve into the requested month are emitted below, so the browser
      // still only receives the selected month's rows.
      supabase
        .from("calendar_events")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    for (const res of [daysRes, monthsRes, overridesRes, eventsRes]) {
      if (res.error) throw res.error;
    }

    const days = (daysRes.data as CalendarDayRow[] | null) ?? [];
    const months = (monthsRes.data as HijriMonthRow[] | null) ?? [];
    const overrides = (overridesRes.data as HijriOverrideRow[] | null) ?? [];
    const events = (eventsRes.data as CalendarEventRow[] | null) ?? [];

    const dayMap = new Map(days.map((row) => [row.gregorian_date, row] as const));
    const resolveDayEvents = createDayEventResolver(events, months, overrides);

    const resolve: HijriResolver = createHijriResolver(months, overrides);
    const total = daysInMonth(year, month);
    const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    const dayViews = [];
    for (let day = 1; day <= total; day += 1) {
      const date = isoDate(year, month, day);
      dayViews.push({
        date,
        gregorianDay: day,
        weekday: weekdayOf(date),
        hijri: resolve(date),
        timings: buildSlots(dayMap.get(date)),
        events: resolveDayEvents(date).map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          category: event.category,
        })),
      });
    }

    return { year, month, monthLabel, days: dayViews };
  } catch (error) {
    logCmsError("calendar:getMonth", error);
    return null;
  }
}

/**
 * Today's six prayer timings for the site-header bar, with formatted Gregorian
 * and Hijri date labels. Falls back to an all-empty set (dashes) on failure.
 */
export async function getTodayTimings(): Promise<DailyPrayerTimings> {
  const today = chicagoTodayISO();
  try {
    const supabase = createSupabaseCalendarClient();
    const [dayRes, monthsRes, overrideRes] = await Promise.all([
      supabase
        .from("calendar_days")
        .select("*")
        .eq("gregorian_date", today)
        .eq("is_published", true)
        .maybeSingle(),
      supabase.from("hijri_months").select("*").eq("is_published", true),
      supabase
        .from("hijri_overrides")
        .select("*")
        .eq("is_published", true)
        .eq("gregorian_date", today)
        .maybeSingle(),
    ]);

    if (dayRes.error) throw dayRes.error;
    if (monthsRes.error) throw monthsRes.error;
    if (overrideRes.error) throw overrideRes.error;

    const row = (dayRes.data as CalendarDayRow | null) ?? undefined;
    const months = (monthsRes.data as HijriMonthRow[] | null) ?? [];
    const override = (overrideRes.data as HijriOverrideRow | null) ?? null;

    const resolve = createHijriResolver(months, override ? [override] : []);
    const hijri = resolve(today);

    return {
      gregorianDate: formatGregorianLong(today),
      hijriDate: hijri
        ? `${hijri.day} ${hijri.monthName} ${hijri.year} AH`
        : null,
      slots: buildSlots(row),
    };
  } catch (error) {
    logCmsError("calendar:getToday", error);
    return { gregorianDate: null, hijriDate: null, slots: buildSlots(undefined) };
  }
}

// ---------------------------------------------------------------------------
// Admin reads (session client — RLS enforces admin via is_admin()).
// ---------------------------------------------------------------------------

/**
 * Lightweight admin counts (total + active) for the dashboard stat cards.
 * Selects only the flags — avoids the Hijri month/override joins entirely.
 */
/**
 * Lightweight admin counts (total + active) for the dashboard stat cards and
 * the sidebar badges. Wrapped in React cache() so the admin layout and the
 * dashboard page share ONE fetch per request instead of duplicating it.
 */
export const getCalendarEventCounts = cache(async (): Promise<{
  total: number;
  active: number;
}> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("is_active");

  if (error) {
    logCmsError("calendar:eventCounts", error);
    return { total: 0, active: 0 };
  }
  const rows = (data ?? []) as Array<{ is_active: boolean }>;
  return {
    total: rows.length,
    active: rows.filter((row) => row.is_active).length,
  };
});

export async function getAllCalendarDays(year: number): Promise<CalendarDayAdminItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_days")
    .select("*")
    .gte("gregorian_date", `${year}-01-01`)
    .lte("gregorian_date", `${year}-12-31`)
    .order("gregorian_date", { ascending: true });

  if (error) {
    logCmsError("calendar:getAllDays", error);
    return [];
  }
  return (data as CalendarDayRow[] | null) ?? [];
}

export async function getCalendarDayByDate(date: string): Promise<CalendarDayRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_days")
    .select("*")
    .eq("gregorian_date", date)
    .maybeSingle();

  if (error) {
    logCmsError("calendar:getDayByDate", error);
    return null;
  }
  return (data as CalendarDayRow | null) ?? null;
}

/**
 * The Hijri month boundaries whose Gregorian start falls inside the ADMIN
 * calendar year (see {@link adminCalendarYear}). Admin edits the shipped year
 * (2026 → Hijri 1447/1448); the multi-year boundaries for the other public
 * years stay in the database untouched — only this ADMIN list is scoped.
 * Note a boundary that began in late 2025 (e.g. Rajab 1447) is intentionally
 * absent from the list even though its month continues into January 2026:
 * the calendar engine still reads it from the full boundary set when
 * resolving dates.
 */
export async function getAllHijriMonths(): Promise<HijriMonthAdminItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hijri_months")
    .select("*")
    .gte("gregorian_start", `${adminCalendarYear}-01-01`)
    .lte("gregorian_start", `${adminCalendarYear}-12-31`)
    .order("gregorian_start", { ascending: true });

  if (error) {
    logCmsError("calendar:getAllHijriMonths", error);
    return [];
  }
  return (data as HijriMonthRow[] | null) ?? [];
}

/**
 * Per-day Hijri overrides whose Gregorian date falls inside the ADMIN calendar
 * year. Overrides for other years (kept for the public multi-year calendar)
 * are excluded from this admin list only — nothing is deleted.
 */
export async function getAllHijriOverrides(): Promise<HijriOverrideAdminItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hijri_overrides")
    .select("*")
    .gte("gregorian_date", `${adminCalendarYear}-01-01`)
    .lte("gregorian_date", `${adminCalendarYear}-12-31`)
    .order("gregorian_date", { ascending: true });

  if (error) {
    logCmsError("calendar:getAllHijriOverrides", error);
    return [];
  }
  return (data as HijriOverrideRow[] | null) ?? [];
}

/**
 * The canonical event list resolved INTO the ADMIN calendar year (2026).
 *
 * Recurring Islamic events (hijri_year = NULL) repeat every Hijri year, so a
 * single canonical row has no single "the" Gregorian date — the admin Date
 * column must show this year's occurrence. Resolving a recurring anchor
 * through `createHijriToGregorian` would pin it to the LATEST published
 * boundary's Hijri year (2029 today), which is how 2025–2030 dates leaked in
 * after the public calendar went multi-year. Instead the events are matched
 * FORWARD against the resolved Hijri date of every day of the admin year —
 * the same engine the public calendar uses ({@link createDayEventResolver}) —
 * so each row shows the occurrence whose Gregorian date falls between
 * Jan 1 and Dec 31 of the admin year (spanning both Hijri years that overlap
 * Gregorian 2026: 1447 and 1448).
 *
 * Event identity (ids, titles, anchors, recurrence) is untouched — only the
 * displayed occurrence changes. An event that does not occur inside the admin
 * year is excluded rather than shown with a foreign-year date; the cached
 * `event_date` is used only as a last-resort fallback for rows with no Hijri
 * anchor (gregorian-only local events, which carry their real date there).
 */
export async function getAllCalendarEvents(): Promise<CalendarEventAdminItem[]> {
  const supabase = await createSupabaseServerClient();
  const [eventsRes, monthsRes, overridesRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("hijri_months").select("*"),
    supabase.from("hijri_overrides").select("*"),
  ]);

  if (eventsRes.error) {
    logCmsError("calendar:getAllEvents", eventsRes.error);
    return [];
  }
  if (monthsRes.error) {
    logCmsError("calendar:getAllEvents:months", monthsRes.error);
    return [];
  }
  if (overridesRes.error) {
    logCmsError("calendar:getAllEvents:overrides", overridesRes.error);
    return [];
  }

  const events = (eventsRes.data as CalendarEventRow[] | null) ?? [];
  const months = (monthsRes.data as HijriMonthRow[] | null) ?? [];
  const overrides = (overridesRes.data as HijriOverrideRow[] | null) ?? [];

  const hijriAnchored = events.length === 0 || "hijri_year" in events[0];

  // Resolve each calendar_day of the admin year once (365 resolver calls),
  // then group the events matched on that day. Only this year's calendar_days
  // are fetched — never the whole multi-year table.
  const daysRes = await supabase
    .from("calendar_days")
    .select("gregorian_date")
    .gte("gregorian_date", `${adminCalendarYear}-01-01`)
    .lte("gregorian_date", `${adminCalendarYear}-12-31`)
    .order("gregorian_date", { ascending: true });
  if (daysRes.error) {
    logCmsError("calendar:getAllEvents:days", daysRes.error);
    return [];
  }
  const dayDates =
    ((daysRes.data as Array<{ gregorian_date: string }> | null) ?? []).map(
      (row) => row.gregorian_date,
    );

  const resolveDayEvents = createDayEventResolver(events, months, overrides);
  const resolvedById = new Map<string, string>(); // event id → 2026 occurrence
  for (const date of dayDates) {
    for (const event of resolveDayEvents(date)) {
      // First occurrence wins; the dedup inside the resolver guarantees the
      // same event never matches twice in one year.
      if (!resolvedById.has(event.id)) resolvedById.set(event.id, date);
    }
  }

  return events
    .map((event) => {
      const resolved = resolvedById.get(event.id) ?? null;
      const hijriDerived =
        resolved ??
        (hijriAnchored && event.hijri_month !== null && event.hijri_day !== null
          ? null
          : event.event_date);
      return {
        ...event,
        derived_gregorian_date: hijriDerived ?? event.event_date,
        hijri_anchored: hijriAnchored,
      };
    })
    .filter(
      // Hide events with no occurrence inside the admin year (instead of
      // showing their latest/foreign-year occurrence).
      (event) =>
        event.derived_gregorian_date.startsWith(`${adminCalendarYear}-`),
    )
    .sort((a, b) => a.derived_gregorian_date.localeCompare(b.derived_gregorian_date));
}
