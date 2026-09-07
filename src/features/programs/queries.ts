import "server-only";

import { upcomingPrograms } from "@/features/home/data/programs";
import { logCmsError } from "@/lib/cms/logging";
import { CMS_BUCKETS, resolveImageSrc } from "@/lib/media/storage";
import { createSupabaseProgramClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ProgramAdminItem, ProgramCard, ProgramRow } from "./types";

const BUCKET = CMS_BUCKETS.programs;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today's date in MASOM's local timezone (Chicago) as "YYYY-MM-DD". */
function chicagoTodayISO(): string {
  // en-CA formats as YYYY-MM-DD; same convention as the calendar queries.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** An event is upcoming while its end (or start, if single-day) is today or later. */
function isUpcoming(startDate: string, endDate: string | null): boolean {
  return (endDate ?? startDate) >= chicagoTodayISO();
}

/**
 * Minutes since midnight for a stored time. Accepts the CMS's 24-hour
 * "HH:MM:SS"/"HH:MM" values AND 12-hour display strings ("1:00 PM",
 * "12:00 AM" = 0, "12:00 PM" = noon) so the fallback data sorts identically.
 * Invalid/empty values sort first (0), matching Postgres NULL-first ordering.
 */
function parseTimeToMinutes(value: string | null): number {
  if (!value) return 0;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return 0;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "AM" && hours === 12) hours = 0;
  if (period === "PM" && hours !== 12) hours += 12;
  return hours * 60 + minutes;
}

/** Chronological comparator: date, then start time. Shared by all program lists. */
function compareByDateAndTime(
  a: { start_date: string; start_time: string | null },
  b: { start_date: string; start_time: string | null },
): number {
  const byDate = a.start_date.localeCompare(b.start_date);
  if (byDate !== 0) return byDate;
  return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time);
}

/** "20:00:00" -> "8:00 PM". */
function formatClock(value: string | null): string | null {
  if (!value) return null;
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw ?? "0");
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${pad(minutes)} ${period}`;
}

function timeLabel(start: string | null, end: string | null): string | null {
  const startLabel = formatClock(start);
  const endLabel = formatClock(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? null;
}

function toProgramCard(row: ProgramRow): ProgramCard {
  const posterSrc = resolveImageSrc(BUCKET, row.poster_path);
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    timeLabel: timeLabel(row.start_time, row.end_time),
    // Cache-bust on updated_at so browsers / Next.js Image / CDN never serve a
    // stale poster after an admin replaces the image. The value changes only
    // when the program record is updated (typically the image itself).
    posterSrc: posterSrc
      ? `${posterSrc}?v=${encodeURIComponent(row.updated_at)}`
      : null,
    description: row.description,
    location: row.location,
    linkUrl: row.link_url,
  };
}

/** Real Phase 3 programs, used until the CMS holds published rows. */
function fallbackPrograms(): ProgramCard[] {
  return upcomingPrograms
    .filter((program) => isUpcoming(program.date, null))
    .sort((a, b) =>
      compareByDateAndTime(
        { start_date: a.date, start_time: a.startTime },
        { start_date: b.date, start_time: b.startTime },
      ),
    )
    .map((program) => ({
      id: program.id,
      title: program.title,
      startDate: program.date,
      timeLabel:
        program.startTime && program.endTime
          ? `${program.startTime} – ${program.endTime}`
          : (program.startTime ?? null),
      posterSrc: program.image.src,
      description: program.description ?? null,
      location: program.location ?? null,
      linkUrl: program.linkUrl ?? null,
    }));
}

/**
 * Public upcoming programs. Returns EVERY published program that is still
 * upcoming (started today or later, using MASOM's Chicago timezone), ordered
 * chronologically with the start time as the same-day tiebreak. Uses the same
 * `programs` CMS table as the Program Calendar; when the CMS is empty or
 * unavailable it falls back to the local reference programs.
 */
export async function getUpcomingPrograms(): Promise<ProgramCard[]> {
  try {
    const supabase = createSupabaseProgramClient();
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("is_published", true)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      const cards = (data as ProgramRow[])
        .filter((row) => isUpcoming(row.start_date, row.end_date))
        .map(toProgramCard);
      if (cards.length > 0) return cards;
    }
  } catch (error) {
    logCmsError("programs:getUpcoming", error);
  }

  return fallbackPrograms();
}

/** Admin: every program (including past/unpublished), with poster previews. */
export async function getAllPrograms(): Promise<ProgramAdminItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    logCmsError("programs:getAll", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const program = row as ProgramRow;
    return {
      ...program,
      previewUrl: resolveImageSrc(BUCKET, program.poster_path),
      timeLabel: timeLabel(program.start_time, program.end_time),
    };
  });
}

/**
 * Published programs whose START date falls in the given month (server-side
 * filtered so only the selected period is fetched). Multi-day programs are
 * bucketed by their start date, matching the calendar's month view.
 */
export async function getProgramsForMonth(
  year: number,
  month: number,
): Promise<ProgramCard[]> {
  const start = `${year}-${pad(month)}-01`;
  // Last day of the month ("-31" is invalid for 30-day months and February,
  // which makes Postgres reject the range and empties the calendar view).
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(lastDay)}`;

  try {
    const supabase = createSupabaseProgramClient();
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("is_published", true)
      .gte("start_date", start)
      .lte("start_date", end)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => toProgramCard(row as ProgramRow));
  } catch (error) {
    logCmsError("programs:getForMonth", error);
    return [];
  }
}

/** Distinct years that actually contain published programs (calendar year list). */
export async function getProgramYears(): Promise<number[]> {
  try {
    const supabase = createSupabaseProgramClient();
    const { data, error } = await supabase
      .from("programs")
      .select("start_date")
      .eq("is_published", true);

    if (error) throw error;
    const years = new Set<number>();
    for (const row of data ?? []) {
      const match = /^(\d{4})/.exec((row as { start_date: string }).start_date ?? "");
      if (match) years.add(Number(match[1]));
    }
    return [...years].sort((a, b) => a - b);
  } catch (error) {
    logCmsError("programs:getYears", error);
    return [];
  }
}

/**
 * Lightweight admin counts (total + published) for the dashboard stat cards.
 * Selects only the flags — no full-row payloads.
 */
export async function getProgramCounts(): Promise<{
  total: number;
  published: number;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select("is_published");

  if (error) {
    logCmsError("programs:counts", error);
    return { total: 0, published: 0 };
  }
  const rows = (data ?? []) as Array<{ is_published: boolean }>;
  return {
    total: rows.length,
    published: rows.filter((row) => row.is_published).length,
  };
}

export async function getProgramById(id: string): Promise<ProgramRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logCmsError("programs:getById", error);
    return null;
  }
  return (data as ProgramRow | null) ?? null;
}
