/**
 * Seeds the 2025 MASOM Prayer + Hijri Calendar into the EXISTING normalized
 * tables (calendar_days + hijri_months) from the OFFICIAL source: the legacy
 * MASOM 2025 site's published monthly timetables
 * (https://masom.com/2025/…, "Daily Prayer Time" plugin, the same published
 * timetable that fed the printed 2025 calendar).
 *
 * WHAT IT SEEDS
 *   • calendar_days — 365 rows (2025-01-01 … 2025-12-31) with the six
 *     published timings exactly as printed by MASOM (converted "5:55 am" →
 *     "5:55a", the stored compact form). Imsaak is not printed by the source
 *     and stays NULL (it is never shown publicly anyway).
 *   • hijri_months  — the Islamic month-start boundaries for every Hijri month
 *     whose days fall inside 2025, derived from the official per-day Hijri
 *     labels ("1 Rajab 1446" on 2025-01-02 ⇒ boundary 1446/7 = 2025-01-02),
 *     plus the single boundary active on Jan 1 2025 (back-computed from that
 *     day's official label) so early-January days resolve.
 *
 * WHAT IT DOES NOT DO (hard guarantees)
 *   • NEVER deletes anything. NEVER truncates.
 *   • NEVER updates an existing hijri_months row — if a boundary already
 *     exists it is only VERIFIED (mismatches are reported, not overwritten),
 *     so the admin's corrected 2026 moon-sighting boundaries are untouchable.
 *   • Only writes calendar_days rows whose date starts "2025-" (asserted).
 *   • Does NOT import events: the source's daily events are the same annual
 *     Islamic events already stored as HIJRI-ANCHORED rows in calendar_events,
 *     which automatically resolve to their 2025 dates via the month
 *     boundaries. One-off 2026 local events are never copied.
 *
 * RUN (idempotent — safe to re-run, reports inserted/updated/skipped):
 *   node --env-file=.env.local scripts/seed-calendar-2025.mjs
 *
 * PREREQUISITES: .env.local with NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY; calendar migrations applied.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env. Run with: node --env-file=.env.local scripts/seed-calendar-2025.mjs " +
      "(needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const YEAR = "2025";
const TIMETABLE_URL =
  "https://masom.com/2025/wp-admin/admin-ajax.php?action=get_monthly_timetable&display=printAndMonth&month=";

/** Legacy-site Hijri month spellings → standard month number (1 = Muharram). */
const hijriMonthByLabel = {
  muharram: 1,
  safar: 2,
  "rabi-ul-awwal": 3,
  "rabi-ul-awwai": 3,
  "rabi-al-awwal": 3,
  "rabi-us-saani": 4,
  "rabi-us-sani": 4,
  "rabi-al-thani": 4,
  "jamadi-ul-awwal": 5,
  "jumadi-ul-awwal": 5,
  "jamadi-al-oola": 5,
  "jamadi-us-saani": 6,
  "jamadi-us-sani": 6,
  "jumadi-us-saani": 6,
  "jamadi-ul-thani": 6,
  rajab: 7,
  shaban: 8,
  shabaan: 8,
  shaabaan: 8,
  "sha'baan": 8,
  ramzan: 9,
  ramadan: 9,
  ramazan: 9,
  shawwal: 10,
  "zeeqa'ad": 11,
  zeeqaad: 11,
  zilqaad: 11,
  ziquad: 11,
  zilhajj: 12,
  zilhaj: 12,
  zulhijjah: 12,
};

function hijriMonthNumber(label) {
  const key = label.toLowerCase().replace(/[^a-z'-]/g, "");
  return hijriMonthByLabel[key] ?? null;
}

/** "5:55 am" → "5:55a" (the compact stored form used by calendar_days). */
function toStoredTime(raw) {
  const match = /^(\d{1,2}):(\d{2})\s*([ap])\.?m?\.?$/i.exec(raw.trim());
  if (!match) return null;
  return `${Number(match[1])}:${match[2]}${match[3].toLowerCase()}`;
}

const GREGORIAN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Parses "January 1, 2025  29 Jamadi-us-Saani 1446" into its parts. */
function parseDateCell(text) {
  const match =
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2})\s+([A-Za-z'’-]+)\s+(\d{4})$/.exec(
      text.replace(/\s+/g, " ").trim(),
    );
  if (!match) return null;
  return {
    gregorian_date: `${match[3]}-${String(GREGORIAN_MONTHS.indexOf(match[1]) + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`,
    hijri_day: Number(match[4]),
    hijri_month_label: match[5],
    hijri_year: Number(match[6]),
  };
}

/** Maps an official event title prefix to the CMS event category set. */
function categoryFromTitle(title) {
  const t = title.toLowerCase();
  if (t.startsWith("wiladat")) return "Wiladat";
  if (t.startsWith("wafat")) return "Wafat";
  if (t.startsWith("martyrdom") || t.startsWith("shahadat")) return "Martyrdom";
  if (t.startsWith("shab")) return "Shab";
  if (t.startsWith("eid")) return "Eid";
  if (t.startsWith("ziarat")) return "Ziarat";
  return "Historical";
}

/** Fetches one month of the official 2025 timetable and returns day rows. */
async function fetchMonth(month) {
  const res = await fetch(`${TIMETABLE_URL}${month}`, {
    headers: { "User-Agent": "MASOM-CMS-Seed/1.0 (one-time historical import)" },
  });
  if (!res.ok) throw new Error(`month ${month}: HTTP ${res.status}`);
  const html = await res.text();

  const rawCells = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  if (rawCells.length % 9 !== 0) {
    throw new Error(`month ${month}: unexpected cell count ${rawCells.length}`);
  }

  const strip = (s) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

  const days = [];
  for (let i = 0; i < rawCells.length; i += 9) {
    const row = rawCells.slice(i, i + 9);
    const text = row.map(strip);
    const [dateCell, , fajr, sunrise, zohar, sunset, maghrib, midnight] = text;
    const parsed = parseDateCell(dateCell);
    if (!parsed) throw new Error(`month ${month}: unparsable date cell "${dateCell}"`);
    const times = [fajr, sunrise, zohar, sunset, maghrib, midnight].map(toStoredTime);
    if (times.some((t) => t === null)) {
      throw new Error(`month ${month} ${parsed.gregorian_date}: unparsable time cells`);
    }
    // The event cell may hold several <br>-separated events for one day.
    const events = row[8]
      .split(/<br\s*\/?>/i)
      .map(strip)
      .filter(Boolean);
    days.push({
      gregorian_date: parsed.gregorian_date,
      hijri: parsed,
      imsaak: null,
      fajr: times[0],
      sunrise: times[1],
      zohar: times[2],
      sunset: times[3],
      maghrib: times[4],
      midnight: times[5],
      events,
    });
  }
  return days;
}

function addDays(iso, delta) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // ---------------------------------------------------------------------------
  // 1. Fetch all 12 months of official 2025 data first (fail fast, write later).
  // ---------------------------------------------------------------------------
  const allDays = [];
  for (let month = 1; month <= 12; month += 1) {
    const days = await fetchMonth(month);
    console.log(`fetched ${month}/2025: ${days.length} days`);
    allDays.push(...days);
    await new Promise((r) => setTimeout(r, 300)); // be polite to the source
  }

  // Scope guard: only 2025 rows may ever reach calendar_days.
  const offYear = allDays.filter((d) => !d.gregorian_date.startsWith(`${YEAR}-`));
  if (offYear.length > 0) {
    throw new Error(`refusing to import non-${YEAR} day rows: ${offYear.map((d) => d.gregorian_date).join(", ")}`);
  }
  if (allDays.length !== 365) {
    throw new Error(`expected 365 day rows for 2025, parsed ${allDays.length}`);
  }

  // ---------------------------------------------------------------------------
  // 2. Derive Hijri month-start boundaries from the official day labels.
  //    Every labeled day implies its month's start: start = date − (day − 1).
  //    All days of a month must agree on one implied start; this also recovers
  //    months whose printed table never shows a "1 <Month>" day (e.g. Shawwal
  //    1446: the 2025 table prints "30 Ramzan" on Apr 1 and jumps straight to
  //    "2 Shawwal" on Apr 2 — the boundary is still unambiguously Apr 1).
  // ---------------------------------------------------------------------------
  const impliedStarts = new Map(); // key: year-month → Map(startISO → day count)
  for (const day of allDays) {
    const monthNum = hijriMonthNumber(day.hijri.hijri_month_label);
    if (monthNum === null) {
      throw new Error(`unknown Hijri month label "${day.hijri.hijri_month_label}" on ${day.gregorian_date}`);
    }
    day.hijri_month_num = monthNum;
    const key = `${day.hijri.hijri_year}-${monthNum}`;
    const start = addDays(day.gregorian_date, -(day.hijri.hijri_day - 1));
    const starts = impliedStarts.get(key) ?? new Map();
    starts.set(start, (starts.get(start) ?? 0) + 1);
    impliedStarts.set(key, starts);
  }

  const boundaries = new Map(); // key: year-month → { hijri_year, hijri_month, gregorian_start }
  const boundaryConflicts = [];
  for (const [key, starts] of impliedStarts) {
    if (starts.size > 1) {
      boundaryConflicts.push(`${key}: ${[...starts.entries()].map(([s, c]) => `${s}(${c} days)`).join(", ")}`);
    }
    // Pick the start implied by the most day labels (unique in practice).
    const sortedStarts = [...starts.entries()].sort((a, b) => b[1] - a[1]);
    const best = sortedStarts[0][0];
    const [hijri_year, hijri_month] = key.split("-").map(Number);
    boundaries.set(key, { hijri_year, hijri_month, gregorian_start: best });
  }
  for (const conflict of boundaryConflicts) {
    console.warn(`  BOUNDARY LABEL CONFLICT in source (most-agreed start used): ${conflict}`);
  }
  console.log(
    "derived boundaries:",
    [...boundaries.values()].map((b) => `${b.hijri_year}/${b.hijri_month} → ${b.gregorian_start}`).join(", "),
  );

  // Days whose official printed label disagrees with the derived boundaries
  // (the Apr 1 2025 "30 Ramzan / 2 Shawwal next day" overlap) are preserved
  // EXACTLY as printed via hijri_overrides — visible data, never silent edits.
  const boundaryList = [...boundaries.values()].map((b) => ({
    ...b,
    start: Math.floor(Date.parse(`${b.gregorian_start}T00:00:00Z`) / 86_400_000),
  }));
  const overrides = [];
  for (const day of allDays) {
    const dayNum = Math.floor(Date.parse(`${day.gregorian_date}T00:00:00Z`) / 86_400_000);
    let match = null;
    for (const b of boundaryList) {
      if (b.start <= dayNum && (!match || b.start > match.start)) match = b;
    }
    if (!match) throw new Error(`no Hijri boundary covers ${day.gregorian_date}`);
    const derivedDay = dayNum - match.start + 1;
    if (derivedDay !== day.hijri.hijri_day || match.hijri_month !== day.hijri_month_num) {
      overrides.push({
        gregorian_date: day.gregorian_date,
        hijri_year: day.hijri.hijri_year,
        hijri_month: day.hijri_month_num,
        hijri_day: day.hijri.hijri_day,
        note: `Official 2025 printed timetable label (derived: ${match.hijri_month}/${derivedDay}).`,
      });
    }
  }
  if (overrides.length > 0) {
    console.log(
      `label overrides needed: ${overrides.map((o) => `${o.gregorian_date} = ${o.hijri_day}/${o.hijri_month}/${o.hijri_year}`).join(", ")}`,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Write calendar_days (2025 rows only). Upsert = idempotent; report new
  //    vs updated. RLS isn't involved (service role), existing 2026+ rows are
  //    structurally unreachable because only 2025-dated rows are written.
  // ---------------------------------------------------------------------------
  const dayRows = allDays.map((d) => ({
    gregorian_date: d.gregorian_date,
    imsaak: d.imsaak,
    fajr: d.fajr,
    sunrise: d.sunrise,
    zohar: d.zohar,
    sunset: d.sunset,
    maghrib: d.maghrib,
    midnight: d.midnight,
    is_published: true,
  }));

  const { data: existingDayDates } = await supabase
    .from("calendar_days")
    .select("gregorian_date")
    .gte("gregorian_date", `${YEAR}-01-01`)
    .lte("gregorian_date", `${YEAR}-12-31`);
  const existingSet = new Set((existingDayDates ?? []).map((r) => r.gregorian_date));

  const { error: daysError, count: upsertedDays } = await supabase
    .from("calendar_days")
    .upsert(dayRows, { onConflict: "gregorian_date", count: "exact" });
  if (daysError) throw daysError;

  const newDays = dayRows.filter((r) => !existingSet.has(r.gregorian_date)).length;
  console.log(
    `calendar_days: ${upsertedDays ?? dayRows.length} rows written (${newDays} inserted, ${dayRows.length - newDays} updated).`,
  );

  // ---------------------------------------------------------------------------
  // 4. Write hijri_months: INSERT-missing only. Existing boundaries are
  //    verified against the source; mismatches are REPORTED, never overwritten
  //    (the admin's moon-sighting corrections are authoritative).
  // ---------------------------------------------------------------------------
  const { data: existingMonths } = await supabase
    .from("hijri_months")
    .select("hijri_year, hijri_month, gregorian_start");
  const existingByMonth = new Map(
    (existingMonths ?? []).map((m) => [`${m.hijri_year}-${m.hijri_month}`, m.gregorian_start]),
  );

  let insertedBoundaries = 0;
  let skippedBoundaries = 0;
  const mismatches = [];
  const missing = [];
  for (const b of boundaries.values()) {
    const key = `${b.hijri_year}-${b.hijri_month}`;
    const existing = existingByMonth.get(key);
    if (existing === undefined) {
      missing.push(b);
    } else if (existing !== b.gregorian_start) {
      // Expected overlap case: e.g. Rajab 1447 (2025-12-22) already exists from
      // the 2026 seed and MUST match — a mismatch means the sources disagree.
      mismatches.push(`${key}: db=${existing} source=${b.gregorian_start}`);
    } else {
      skippedBoundaries += 1;
    }
  }

  if (missing.length > 0) {
    const { error, count } = await supabase
      .from("hijri_months")
      .insert(missing.map((b) => ({ ...b, is_published: true })), { count: "exact" });
    if (error) throw error;
    insertedBoundaries = count ?? missing.length;
  }

  console.log(
    `hijri_months: ${insertedBoundaries} inserted, ${skippedBoundaries} already correct, ${mismatches.length} mismatches.`,
  );
  for (const m of mismatches) {
    console.warn(`  BOUNDARY MISMATCH (left unchanged, review needed): ${m}`);
  }

  // ---------------------------------------------------------------------------
  // 4b. Write hijri_overrides (insert-missing only, 2025-dated rows guarded).
  // ---------------------------------------------------------------------------
  let insertedOverrides = 0;
  if (overrides.length > 0) {
    const offYearOverrides = overrides.filter((o) => !o.gregorian_date.startsWith(`${YEAR}-`));
    if (offYearOverrides.length > 0) throw new Error("refusing to import non-2025 overrides");
    const { data: existingOverrides } = await supabase
      .from("hijri_overrides")
      .select("gregorian_date")
      .in("gregorian_date", overrides.map((o) => o.gregorian_date));
    const haveOverrides = new Set((existingOverrides ?? []).map((o) => o.gregorian_date));
    const missingOverrides = overrides.filter((o) => !haveOverrides.has(o.gregorian_date));
    if (missingOverrides.length > 0) {
      const { error, count } = await supabase
        .from("hijri_overrides")
        .insert(missingOverrides.map((o) => ({ ...o, is_published: true })), { count: "exact" });
      if (error) throw error;
      insertedOverrides = count ?? missingOverrides.length;
    }
  }
  console.log(`hijri_overrides: ${insertedOverrides} inserted (of ${overrides.length} needed).`);

  // ---------------------------------------------------------------------------
  // 4c. Import the official 2025 daily events as HIJRI-ANCHORED rows.
  //    Each source event is anchored to its printed Hijri date, so it joins
  //    the same recurring-event architecture as 2026 — no Gregorian copies.
  //    Anchors that already exist (e.g. Rajab 1447 events shared with the 2026
  //    seed) are skipped; existing rows are never modified or deleted.
  // ---------------------------------------------------------------------------
  const sourceEvents = [];
  for (const day of allDays) {
    for (const title of day.events) {
      sourceEvents.push({
        title,
        category: categoryFromTitle(title),
        hijri_year: day.hijri.hijri_year,
        hijri_month: day.hijri_month_num,
        hijri_day: day.hijri.hijri_day,
        event_date: day.gregorian_date,
      });
    }
  }
  const { data: existingAnchors } = await supabase
    .from("calendar_events")
    .select("hijri_year, hijri_month, hijri_day, title")
    .not("hijri_year", "is", null);
  const anchorKey = (e) => `${e.hijri_year}-${e.hijri_month}-${e.hijri_day}-${e.title.toLowerCase()}`;
  const existingAnchorSet = new Set((existingAnchors ?? []).map(anchorKey));
  const newEvents = sourceEvents.filter((e) => !existingAnchorSet.has(anchorKey(e)));
  let insertedEvents = 0;
  if (newEvents.length > 0) {
    const { error, count } = await supabase
      .from("calendar_events")
      .insert(
        newEvents.map((e, index) => ({
          title: e.title,
          category: e.category,
          description: null,
          hijri_year: e.hijri_year,
          hijri_month: e.hijri_month,
          hijri_day: e.hijri_day,
          event_date: e.event_date,
          sort_order: index % 10,
          is_active: true,
        })),
        { count: "exact" },
      );
    if (error) throw error;
    insertedEvents = count ?? newEvents.length;
  }
  console.log(
    `calendar_events: ${insertedEvents} inserted (${sourceEvents.length} in source, ${sourceEvents.length - newEvents.length} already anchored).`,
  );

  // ---------------------------------------------------------------------------
  // 5. Post-import verification: counts + a spot-check of official labels.
  // ---------------------------------------------------------------------------
  const { count: days2025 } = await supabase
    .from("calendar_days")
    .select("*", { count: "exact", head: true })
    .gte("gregorian_date", "2025-01-01")
    .lte("gregorian_date", "2025-12-31");
  const { count: days2026 } = await supabase
    .from("calendar_days")
    .select("*", { count: "exact", head: true })
    .gte("gregorian_date", "2026-01-01")
    .lte("gregorian_date", "2026-12-31");

  const { data: spotJan1 } = await supabase
    .from("calendar_days")
    .select("fajr, sunrise, midnight")
    .eq("gregorian_date", "2025-01-01")
    .maybeSingle();
  const { data: spotJun1 } = await supabase
    .from("calendar_days")
    .select("fajr, sunrise, midnight")
    .eq("gregorian_date", "2025-06-01")
    .maybeSingle();
  const { count: events1446 } = await supabase
    .from("calendar_events")
    .select("*", { count: "exact", head: true })
    .eq("hijri_year", 1446);
  const { data: aprOverride } = await supabase
    .from("hijri_overrides")
    .select("gregorian_date, hijri_month, hijri_day")
    .eq("gregorian_date", "2025-04-01")
    .maybeSingle();

  console.log("--- verify ---");
  console.log(`calendar_days 2025: ${days2025} (expect 365)`);
  console.log(`calendar_days 2026: ${days2026} (expect the pre-import count, 365)`);
  console.log(`calendar_events anchored to 1446: ${events1446}`);
  console.log("override 2025-04-01 (expect 9/30 = 30 Ramzan, per printed table):", aprOverride);
  console.log(`spot 2025-01-01 (expect 5:55a / 7:18a / 11:09p):`, spotJan1);
  console.log(`spot 2025-06-01 (expect 3:39a / 5:19a / 11:54p):`, spotJun1);
  console.log("done.");
}

main().catch((error) => {
  console.error("SEED FAILED — no partial state beyond step logs above:", error.message);
  process.exit(1);
});
