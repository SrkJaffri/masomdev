import "server-only";

import type { CalendarDayRow } from "@/features/calendar/types";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseCalendarClient } from "@/lib/supabase/public";
import type { NextPrayerCandidate, PrayerTimeKey } from "@/features/prayer-calendar/types";

// ---------------------------------------------------------------------------
// Next Prayer card data.
//
// The card uses ONLY the three real prayer events published in the calendar
// (Fajr, Zohar, Maghrib). Sunrise, Sunset and Midnight are intentionally never
// treated as prayers. All wall-clock conversions use America/Chicago and the
// iterative offset correction below handles DST transitions correctly.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = "America/Chicago";

/** The three real prayers, in chronological order. */
type PrayerOnlyKey = Extract<PrayerTimeKey, "fajr" | "zohar" | "maghrib">;

const PRAYER_KEYS: { key: PrayerOnlyKey; name: string }[] = [
  { key: "fajr", name: "Fajr" },
  { key: "zohar", name: "Zohar" },
  { key: "maghrib", name: "Maghrib" },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Calendar date (not instant) "deltaDays" ahead of today in Chicago. */
function chicagoDateISO(deltaDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return isoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Parses a stored time like "12:55p" / "4:31a" into 24h minutes of the day. */
function parseStoredTime(raw: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})([ap])$/i.exec(raw.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return null;
  const isAm = match[3].toLowerCase() === "a";
  if (!isAm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;
  return { hour, minute };
}

/** Renders a stored time like "12:55p" as "12:55 PM" for display. */
export function formatStoredTime(raw: string): string {
  const match = /^(\d{1,2}):(\d{2})([ap])$/i.exec(raw.trim());
  if (!match) return raw;
  const hour = Number(match[1]);
  const minute = match[2];
  const isAm = match[3].toLowerCase() === "a";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${isAm ? "AM" : "PM"}`;
}

function formatDateLabel(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Chicago UTC offset (ms) in effect at a given instant. */
function chicagoOffsetMs(epochMs: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const wall = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get(
    "second",
  )}`;
  return Date.parse(`${wall}Z`) - epochMs;
}

/**
 * Epoch ms of a Chicago wall-clock time ("YYYY-MM-DD" + stored "12:55p").
 * The offset is corrected iteratively so results stay exact across the DST
 * spring-forward / fall-back transitions (prayer times are never inside the
 * ambiguous 1-2am window, so this converges in two passes).
 */
function chicagoEpochFor(dateISO: string, rawTime: string): number | null {
  const parsed = parseStoredTime(rawTime);
  if (!parsed) return null;
  const wallAsUtc = Date.parse(
    `${dateISO}T${pad2(parsed.hour)}:${pad2(parsed.minute)}:00Z`,
  );
  if (Number.isNaN(wallAsUtc)) return null;

  let epoch = wallAsUtc;
  for (let i = 0; i < 4; i += 1) {
    const next = wallAsUtc - chicagoOffsetMs(epoch);
    if (next === epoch) break;
    epoch = next;
  }
  return epoch;
}

/**
 * The upcoming prayer candidates the live card needs: today's Fajr/Zohar/
 * Maghrib plus tomorrow's Fajr (for the after-Maghrib rollover). Only the two
 * necessary calendar rows are fetched — never the whole year. Returns [] on
 * any failure so the card renders a graceful empty state.
 */
export async function getNextPrayerCandidates(): Promise<NextPrayerCandidate[]> {
  try {
    const supabase = createSupabaseCalendarClient();
    const today = chicagoDateISO(0);
    const tomorrow = chicagoDateISO(1);

    const { data, error } = await supabase
      .from("calendar_days")
      .select("gregorian_date, fajr, zohar, maghrib")
      .eq("is_published", true)
      .in("gregorian_date", [today, tomorrow]);

    if (error) throw error;

    const rows = (data as Pick<
      CalendarDayRow,
      "gregorian_date" | "fajr" | "zohar" | "maghrib"
    >[] | null) ?? [];
    const byDate = new Map(rows.map((row) => [row.gregorian_date, row] as const));

    const candidates: NextPrayerCandidate[] = [];
    for (const dateISO of [today, tomorrow]) {
      const row = byDate.get(dateISO);
      if (!row) continue;
      const dateLabel = formatDateLabel(dateISO);
      for (const { key, name } of PRAYER_KEYS) {
        const raw = row[key];
        if (!raw) continue;
        const target = chicagoEpochFor(dateISO, raw);
        if (target === null) continue;
        candidates.push({ dateISO, dateLabel, name, time: formatStoredTime(raw), target });
      }
    }
    return candidates;
  } catch (error) {
    logCmsError("calendar:nextPrayer", error);
    return [];
  }
}
