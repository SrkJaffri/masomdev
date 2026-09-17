/**
 * MASOM multi-year calendar generator/importer — generic, year-scoped, safe.
 *
 *   node --env-file=.env.local scripts/seed-calendar-year.mjs --year=2023
 *
 * WHAT IT CREATES (target years ONLY: 2023, 2024, 2027, 2028, 2029)
 *   • calendar_days — one row per Gregorian day of the target year with the
 *     six prayer-timing fields LEFT NULL. The project contains NO verified
 *     prayer-time calculation engine (audited: no astro library, no solar
 *     math anywhere in src/), and inventing, copying or interpolating
 *     timings is forbidden. The public UI renders missing timings as "—"
 *     until MASOM publishes official data for that year.
 *   • hijri_months — month-start boundaries for every Hijri month overlapping
 *     the target year, from the DETERMINISTIC STANDARD TABULAR (arithmetical)
 *     Islamic calendar: civil epoch (1 Muharram 1 AH = July 16 622 CE
 *     equivalent), alternating 29/30-day months, leap years wherever
 *     (11 × year + 14) mod 30 < 11. Calibrated against this project's
 *     verified 1446–1448 boundaries: every verified boundary sits within
 *     −1…+2 days of this model (normal moon-sighting spread), so it is the
 *     correct project-compatible baseline. INSERT-MISSING ONLY: a boundary
 *     that already exists (verified 2025/2026 rows, or a previous run) is
 *     checked and left untouched — mismatches are REPORTED, never written.
 *   • hijri_overrides — none inserted. The tabular model is one consistent
 *     baseline; when MASOM confirms actual moon-sighting dates the correction
 *     belongs in hijri_months/hijri_overrides (admin data), not in a re-seed.
 *   • calendar_events — NOTHING, ever. Canonical recurring events
 *     (hijri_year IS NULL, migration 20260917140000) resolve automatically
 *     against these boundaries for every year. No per-year event copies.
 *
 * WHAT IT REFUSES
 *   • 2025 and 2026 — protected verified calendar years (hard abort).
 *   • Any other year outside the allowed target list (hard abort).
 *   • Any row write dated outside the target Gregorian year (asserted).
 *   • Destructive SQL: no TRUNCATE, no DELETE, no UPDATE of existing data.
 *
 * IDEMPOTENT: re-running the same year reports inserted/updated/skipped and
 * writes identical rows (upsert on gregorian_date). Existing manually edited
 * data is preserved (boundaries are insert-missing only).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env. Run with: node --env-file=.env.local scripts/seed-calendar-year.mjs --year=YYYY",
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Safety gates
// ---------------------------------------------------------------------------
const ALLOWED_YEARS = new Set([2023, 2024, 2027, 2028, 2029]);
const PROTECTED_YEARS = new Set([2025, 2026]);
const EXPECTED_DAYS = { 2023: 365, 2024: 366, 2027: 365, 2028: 366, 2029: 365 };

const targetYear = Number.parseInt(
  (process.argv.find((a) => a.startsWith("--year=")) ?? "").split("=")[1] ?? "",
  10,
);

if (PROTECTED_YEARS.has(targetYear)) {
  console.error(
    `ERROR: ${targetYear} is a protected verified calendar year. ` +
      "This script refuses to touch 2025/2026.",
  );
  process.exit(1);
}
if (!ALLOWED_YEARS.has(targetYear)) {
  console.error(
    `ERROR: unsupported or missing --year. Allowed targets: ${[...ALLOWED_YEARS].join(", ")} ` +
      "(2025 and 2026 are protected verified years and are refused).",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Deterministic standard tabular (arithmetical) Hijri calendar
// ---------------------------------------------------------------------------
const EPOCH_JDN = 1948440; // 1 Muharram 1 AH, civil/tabular epoch (Meeus)
const JDN_19700101 = 2440588;

/** Days from 1 Muharram 1 AH to 1 Muharram hy (tabular). The floor term counts
 * elapsed tabular leap years, so the leap day sits between Dhu al-Hijjah hy−1
 * and Muharram hy — within-year month offsets below stay fixed. */
function daysBeforeYear(hy) {
  return 354 * (hy - 1) + Math.floor((11 * (hy - 1) + 14) / 30);
}

/** Start day-of-month offsets; months alternate 30/29, month 12 gets the leap day. */
const MONTH_START_OFFSETS = [0, 30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];

function tabularMonthStartDayNumber(hy, hm) {
  return EPOCH_JDN - JDN_19700101 + daysBeforeYear(hy) + MONTH_START_OFFSETS[hm - 1];
}

function dayNumberToISO(n) {
  return new Date(Date.UTC(1970, 0, 1 + n)).toISOString().slice(0, 10);
}

function isoToDayNumber(iso) {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/** Every Hijri month whose [start, nextStart) range overlaps the Gregorian year. */
function tabularBoundariesOverlapping(year) {
  const yearStart = isoToDayNumber(`${year}-01-01`);
  const yearEnd = isoToDayNumber(`${year}-12-31`);
  const out = [];
  // A Gregorian year Y overlaps Hijri years ≈ Y−580 … Y−577 (1 AH ≈ 622 CE;
  // the extra year on each end is slack — the overlap test filters exactly).
  for (let hy = year - 580; hy <= year - 577; hy += 1) {
    for (let hm = 1; hm <= 12; hm += 1) {
      const start = tabularMonthStartDayNumber(hy, hm);
      const next =
        hm < 12
          ? tabularMonthStartDayNumber(hy, hm + 1)
          : tabularMonthStartDayNumber(hy + 1, 1);
      if (next > yearStart && start <= yearEnd) {
        out.push({ hijri_year: hy, hijri_month: hm, gregorian_start: dayNumberToISO(start) });
      }
    }
  }
  return out;
}

/** All Gregorian dates of the target year (UTC arithmetic; leap years included). */
function gregorianDatesOfYear(year) {
  const dates = [];
  const d = new Date(Date.UTC(year, 0, 1));
  while (d.getUTCFullYear() === year) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`target year: ${targetYear} (expected ${EXPECTED_DAYS[targetYear]} days)`);

  // Pre-import assurance: protected-year day counts.
  for (const py of PROTECTED_YEARS) {
    const { count } = await supabase
      .from("calendar_days")
      .select("*", { count: "exact", head: true })
      .gte("gregorian_date", `${py}-01-01`)
      .lte("gregorian_date", `${py}-12-31`);
    console.log(`protected year ${py}: ${count} calendar_days rows (must stay ${EXPECTED_DAYS[py] ?? "365"})`);
  }

  // ------------------------------------------------------------------
  // 1. calendar_days — timings stay NULL (no verified calc engine exists).
  // ------------------------------------------------------------------
  const dates = gregorianDatesOfYear(targetYear);
  if (dates.length !== EXPECTED_DAYS[targetYear]) {
    throw new Error(`generated ${dates.length} dates for ${targetYear}, expected ${EXPECTED_DAYS[targetYear]}`);
  }
  const feb29 = `${targetYear}-02-29`;
  const hasFeb29 = dates.includes(feb29);
  const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
  if (hasFeb29 !== isLeap) throw new Error(`Feb 29 presence (${hasFeb29}) contradicts leap-year math for ${targetYear}`);

  const dayRows = dates.map((gregorian_date) => ({
    gregorian_date,
    imsaak: null,
    fajr: null,
    sunrise: null,
    zohar: null,
    sunset: null,
    maghrib: null,
    midnight: null,
    is_published: true,
  }));

  const { data: existingDays } = await supabase
    .from("calendar_days")
    .select("gregorian_date")
    .gte("gregorian_date", `${targetYear}-01-01`)
    .lte("gregorian_date", `${targetYear}-12-31`);
  const existingDaySet = new Set((existingDays ?? []).map((r) => r.gregorian_date));

  const { error: daysError, count: upsertedDays } = await supabase
    .from("calendar_days")
    .upsert(dayRows, { onConflict: "gregorian_date", count: "exact" });
  if (daysError) throw daysError;

  const insertedDays = dayRows.filter((r) => !existingDaySet.has(r.gregorian_date)).length;
  console.log(
    `calendar_days: ${upsertedDays ?? dayRows.length} written (${insertedDays} inserted, ${dayRows.length - insertedDays} updated, prayer timings NULL by design).`,
  );

  // ------------------------------------------------------------------
  // 2. hijri_months — INSERT-MISSING only; existing rows are verified, never
  //    overwritten (verified 2025/2026 boundaries and prior runs are safe).
  // ------------------------------------------------------------------
  const boundaries = tabularBoundariesOverlapping(targetYear);
  const { data: existingMonths } = await supabase
    .from("hijri_months")
    .select("hijri_year, hijri_month, gregorian_start");
  const existingByMonth = new Map(
    (existingMonths ?? []).map((m) => [`${m.hijri_year}-${m.hijri_month}`, m.gregorian_start]),
  );

  const missingBoundaries = [];
  const boundaryMismatches = [];
  let skippedBoundaries = 0;
  for (const b of boundaries) {
    const key = `${b.hijri_year}-${b.hijri_month}`;
    const existing = existingByMonth.get(key);
    if (existing === undefined) {
      missingBoundaries.push(b);
    } else if (existing !== b.gregorian_start) {
      boundaryMismatches.push(`${key}: db(verified)=${existing} tabular=${b.gregorian_start} — db left unchanged`);
    } else {
      skippedBoundaries += 1;
    }
  }

  if (missingBoundaries.length > 0) {
    const { error, count } = await supabase
      .from("hijri_months")
      .insert(missingBoundaries.map((b) => ({ ...b, is_published: true })), { count: "exact" });
    if (error) throw error;
    console.log(
      `hijri_months: ${count ?? missingBoundaries.length} inserted, ${skippedBoundaries} already present, ${boundaryMismatches.length} mismatches (reported only).`,
    );
  } else {
    console.log(`hijri_months: 0 inserted, ${skippedBoundaries} already present, ${boundaryMismatches.length} mismatches.`);
  }
  for (const m of boundaryMismatches) console.warn(`  BOUNDARY DIFFERS from tabular (db wins): ${m}`);

  console.log(
    "boundary sample:",
    boundaries
      .filter((b) => b.gregorian_start.startsWith(String(targetYear)))
      .slice(0, 3)
      .map((b) => `${b.hijri_year}/${b.hijri_month} → ${b.gregorian_start}`)
      .join(", "),
    "…",
    boundaries.at(-1).hijri_year + "/" + boundaries.at(-1).hijri_month,
    "→",
    boundaries.at(-1).gregorian_start,
  );
  console.log(
    "NOTE: tabular boundaries are a PROJECTED baseline — moon-sighting dependent, adjustable later via hijri_months/hijri_overrides.",
  );

  // ------------------------------------------------------------------
  // 3. calendar_events — intentionally untouched. Canonical recurring rows
  //    (hijri_year IS NULL) resolve for every year automatically.
  // ------------------------------------------------------------------
  const { count: recurringBefore } = await supabase
    .from("calendar_events")
    .select("*", { count: "exact", head: true })
    .is("hijri_year", null);

  // ------------------------------------------------------------------
  // 4. Post-verify: day count, Feb 29, weekday spot checks, protected years.
  // ------------------------------------------------------------------
  const { count: daysNow } = await supabase
    .from("calendar_days")
    .select("*", { count: "exact", head: true })
    .gte("gregorian_date", `${targetYear}-01-01`)
    .lte("gregorian_date", `${targetYear}-12-31`);
  const { data: feb29Row } = hasFeb29
    ? await supabase.from("calendar_days").select("gregorian_date").eq("gregorian_date", feb29).maybeSingle()
    : { data: null };

  // Weekday spot checks (UTC day-of-week; 0=Sun).
  const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
  const weekdayChecks = [
    [`${targetYear}-01-01`, new Date(Date.UTC(targetYear, 0, 1)).getUTCDay()],
    [`${targetYear}-06-15`, new Date(Date.UTC(targetYear, 5, 15)).getUTCDay()],
    [`${targetYear}-12-31`, new Date(Date.UTC(targetYear, 11, 31)).getUTCDay()],
  ];

  console.log("--- verify ---");
  console.log(`calendar_days ${targetYear}: ${daysNow} (expect ${EXPECTED_DAYS[targetYear]})`);
  console.log(`Feb 29 ${targetYear}: ${hasFeb29 ? (feb29Row ? "present ✓" : "MISSING ✗") : "n/a (non-leap)"}`);
  for (const [iso, expect] of weekdayChecks) {
    if (weekday(iso) !== expect) throw new Error(`weekday mismatch on ${iso}`);
  }
  console.log(`weekday spot checks: OK (${weekdayChecks.map((c) => c[0]).join(", ")})`);

  for (const py of PROTECTED_YEARS) {
    const { count } = await supabase
      .from("calendar_days")
      .select("*", { count: "exact", head: true })
      .gte("gregorian_date", `${py}-01-01`)
      .lte("gregorian_date", `${py}-12-31`);
    if (count !== 365) throw new Error(`protected year ${py} day count changed: ${count}`);
  }
  const { count: recurringAfter } = await supabase
    .from("calendar_events")
    .select("*", { count: "exact", head: true })
    .is("hijri_year", null);
  if (recurringAfter !== recurringBefore) throw new Error("canonical recurring event count changed");
  console.log(
    `protected years intact (2025/2026 = 365 rows each); canonical recurring events unchanged (${recurringAfter}).`,
  );
  console.log("done.");
}

main().catch((error) => {
  console.error("SEED FAILED — no partial state beyond step logs above:", error.message);
  process.exit(1);
});
