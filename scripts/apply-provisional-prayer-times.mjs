/**
 * MASOM provisional prayer-times copier — 2026 verified schedule → baseline years.
 *
 *   node --env-file=.env.local scripts/apply-provisional-prayer-times.mjs --year=2023
 *   node --env-file=.env.local scripts/apply-provisional-prayer-times.mjs --all
 *
 * WHAT IT DOES (target years ONLY: 2023, 2024, 2027, 2028, 2029)
 *   For every calendar_days row of the target year, copies the six prayer-timing
 *   fields from the VERIFIED 2026 calendar_days row with the SAME Gregorian
 *   month/day:
 *     fajr, sunrise, zohar, sunset, maghrib, midnight
 *   Nothing else on the target row is written (gregorian_date, weekday, imsaak,
 *   is_published, timestamps all stay untouched).
 *
 *   Feb 29 rule (2024 and 2028): 2026 is not a leap year, so 2024-02-29 /
 *   2028-02-29 use the timings of 2026-02-28. March is NOT shifted — March 1
 *   still maps to 2026-03-01. This is a provisional fallback only.
 *
 * WHAT IT NEVER DOES
 *   • 2025 and 2026 are PROTECTED verified years — hard-refused, never written.
 *   • Never inserts/deletes calendar_days rows; only timing-field updates of
 *     existing target-year rows (every target row is verified to exist first).
 *   • Never touches hijri_months, hijri_overrides or calendar_events.
 *   • No guessed values: the script STOPS before writing anything if ANY 2026
 *     source row is missing or empty.
 *   • No TRUNCATE, no DELETE, no writes outside the target Gregorian year.
 *
 * IDEMPOTENT: copying the same verified 2026 values again produces identical
 * rows. A rerun reports "already matching" instead of a spurious "updated".
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env. Run with: node --env-file=.env.local scripts/apply-provisional-prayer-times.mjs --year=YYYY",
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Safety gates — mirrors scripts/seed-calendar-year.mjs
// ---------------------------------------------------------------------------
const ALLOWED_YEARS = new Set([2023, 2024, 2027, 2028, 2029]);
const PROTECTED_YEARS = new Set([2025, 2026]);
const EXPECTED_DAYS = { 2023: 365, 2024: 366, 2027: 365, 2028: 366, 2029: 365 };
const SOURCE_YEAR = 2026;
const SOURCE_YEAR_DAYS = 365;
const TIMING_FIELDS = ["fajr", "sunrise", "zohar", "sunset", "maghrib", "midnight"];
const TIMING_COLUMNS = ["gregorian_date", ...TIMING_FIELDS].join(",");

const arg = process.argv.find((a) => a.startsWith("--year="));
const runAll = process.argv.includes("--all");
const targetYear = runAll ? 0 : Number.parseInt((arg ?? "").split("=")[1] ?? "", 10);

if (PROTECTED_YEARS.has(targetYear)) {
  console.error(
    `ERROR: ${targetYear} is a protected verified calendar year. ` +
      "This script refuses to touch 2025/2026.",
  );
  process.exit(1);
}
if (!runAll && !ALLOWED_YEARS.has(targetYear)) {
  console.error(
    `ERROR: unsupported or missing --year. Allowed targets: ${[...ALLOWED_YEARS].join(", ")} ` +
      "(2025 and 2026 are protected verified years and are refused; --all runs every allowed year).",
  );
  process.exit(1);
}
const targets = runAll ? [...ALLOWED_YEARS].sort((a, b) => a - b) : [targetYear];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** All Gregorian dates of a year (UTC arithmetic; leap years included). */
function gregorianDatesOfYear(year) {
  const dates = [];
  const d = new Date(Date.UTC(year, 0, 1));
  while (d.getUTCFullYear() === year) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Source-map rule: same Gregorian month/day in the verified 2026 year,
 * EXCEPT Feb 29 → 2026-02-28 (2026 is not a leap year; no March shift).
 */
function sourceDateFor(date) {
  const [, month, day] = date.split("-");
  return day === "29" && month === "02" ? "2026-02-28" : `${SOURCE_YEAR}-${month}-${day}`;
}

/**
 * Loads and validates the full verified 2026 timing map BEFORE any write.
 * Exits the process if any source row is missing or has no timings at all —
 * no guessed values are ever inserted.
 */
async function loadSourceTimings() {
  const sourceDates = gregorianDatesOfYear(SOURCE_YEAR);
  if (sourceDates.length !== SOURCE_YEAR_DAYS) {
    throw new Error(`generated ${sourceDates.length} source dates, expected ${SOURCE_YEAR_DAYS}`);
  }
  const { data, error } = await supabase
    .from("calendar_days")
    .select(TIMING_COLUMNS)
    .gte("gregorian_date", `${SOURCE_YEAR}-01-01`)
    .lte("gregorian_date", `${SOURCE_YEAR}-12-31`);
  if (error) throw error;

  const byDate = new Map((data ?? []).map((row) => [row.gregorian_date, row]));
  const missing = sourceDates.filter((date) => !byDate.has(date));
  if (missing.length > 0) {
    console.error(
      `STOP: ${missing.length} verified ${SOURCE_YEAR} source calendar_days rows are missing ` +
        `(first: ${missing[0]}). No target year will be written.`,
    );
    process.exit(1);
  }
  const empty = sourceDates.filter((date) =>
    TIMING_FIELDS.every((field) => !byDate.get(date)[field]),
  );
  if (empty.length > 0) {
    console.error(
      `STOP: ${empty.length} verified ${SOURCE_YEAR} source rows have no prayer timings ` +
        `(first: ${empty[0]}). No target year will be written.`,
    );
    process.exit(1);
  }
  return byDate;
}

// ---------------------------------------------------------------------------
// Per-year run
// ---------------------------------------------------------------------------
async function applyProvisionalTimings(year, sourceByDate) {
  const expected = EXPECTED_DAYS[year];
  console.log(`\n=== ${year} (expected ${expected} days, source ${SOURCE_YEAR}) ===`);

  // 1. Read the target year's existing rows. All must exist — this script
  //    only UPDATES timing fields; missing rows are a seeding problem.
  const { data: targetRows, error: targetError } = await supabase
    .from("calendar_days")
    .select(TIMING_COLUMNS)
    .gte("gregorian_date", `${year}-01-01`)
    .lte("gregorian_date", `${year}-12-31`);
  if (targetError) throw targetError;

  const targetDates = gregorianDatesOfYear(year);
  if (targetDates.length !== expected) {
    throw new Error(`generated ${targetDates.length} dates for ${year}, expected ${expected}`);
  }
  const byDate = new Map((targetRows ?? []).map((row) => [row.gregorian_date, row]));
  const missingRows = targetDates.filter((date) => !byDate.has(date));
  if (missingRows.length > 0) {
    console.error(
      `STOP: ${missingRows.length} ${year} calendar_days rows missing (first: ${missingRows[0]}). ` +
        `Run scripts/seed-calendar-year.mjs --year=${year} first; nothing written for ${year}.`,
    );
    return { updated: 0, alreadyMatching: 0, missingSource: 0, missingRows: missingRows.length, ok: false };
  }

  // 2. Build the exact per-row patches (write nothing yet).
  const updates = [];
  let missingSource = 0;
  for (const date of targetDates) {
    const source = sourceByDate.get(sourceDateFor(date));
    if (!source) {
      missingSource += 1;
      continue;
    }
    const patch = {};
    for (const field of TIMING_FIELDS) patch[field] = source[field];
    updates.push({ gregorian_date: date, ...patch });
  }
  if (missingSource > 0) {
    console.error(
      `STOP: ${missingSource} ${SOURCE_YEAR} source rows missing for ${year}'s month/day map. ` +
        "No target year will be written.",
    );
    return { updated: 0, alreadyMatching: 0, missingSource, missingRows: 0, ok: false };
  }

  // 3. Write only rows whose stored timings actually differ (idempotent rerun).
  //    Upsert on gregorian_date with ONLY the six timing fields in the payload —
  //    on conflict the other columns keep their stored values.
  const toWrite = updates.filter((patch) => {
    const row = byDate.get(patch.gregorian_date);
    return TIMING_FIELDS.some((field) => row[field] !== patch[field]);
  });
  const alreadyMatching = updates.length - toWrite.length;
  if (toWrite.length > 0) {
    const { error, count } = await supabase
      .from("calendar_days")
      .upsert(toWrite, { onConflict: "gregorian_date", count: "exact" });
    if (error) throw error;
    if (count !== toWrite.length) {
      throw new Error(`expected ${toWrite.length} writes for ${year}, got ${count}`);
    }
  }

  console.log(
    `calendar_days ${year}: ${toWrite.length} updated, ${alreadyMatching} already matching, ${missingSource} missing source.`,
  );
  return { updated: toWrite.length, alreadyMatching, missingSource, missingRows: 0, ok: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Source-year assurance: exactly the 365 verified 2026 rows, no more, no less.
  const { count: sourceCount, error: sourceCountError } = await supabase
    .from("calendar_days")
    .select("*", { count: "exact", head: true })
    .gte("gregorian_date", `${SOURCE_YEAR}-01-01`)
    .lte("gregorian_date", `${SOURCE_YEAR}-12-31`);
  if (sourceCountError) throw sourceCountError;
  if (sourceCount !== SOURCE_YEAR_DAYS) {
    throw new Error(
      `source year ${SOURCE_YEAR} has ${sourceCount} calendar_days rows, expected ${SOURCE_YEAR_DAYS} — aborting`,
    );
  }
  console.log(
    `source year ${SOURCE_YEAR}: ${sourceCount} rows. Protected years 2025/2026 are never written ` +
      "(no write path to them exists in this script).",
  );

  // Load + validate the whole 2026 map BEFORE any write.
  const sourceByDate = await loadSourceTimings();

  const results = [];
  for (const year of targets) {
    results.push([year, await applyProvisionalTimings(year, sourceByDate)]);
  }

  // Post-verify: protected years untouched, every target row fully populated,
  // Feb 29 rows exactly equal 2026-02-28.
  console.log("\n--- verify ---");
  for (const py of PROTECTED_YEARS) {
    const { count } = await supabase
      .from("calendar_days")
      .select("*", { count: "exact", head: true })
      .gte("gregorian_date", `${py}-01-01`)
      .lte("gregorian_date", `${py}-12-31`);
    if (count !== SOURCE_YEAR_DAYS) throw new Error(`protected year ${py} day count changed: ${count}`);
  }
  console.log(`protected years 2025/2026: ${SOURCE_YEAR_DAYS} rows each (untouched).`);

  const feb28Source = sourceByDate.get("2026-02-28");
  let allPopulated = true;
  for (const year of targets) {
    const { data, error } = await supabase
      .from("calendar_days")
      .select(TIMING_COLUMNS)
      .gte("gregorian_date", `${year}-01-01`)
      .lte("gregorian_date", `${year}-12-31`);
    if (error) throw error;
    const rows = data ?? [];
    const incomplete = rows.filter((row) => TIMING_FIELDS.some((field) => !row[field]));
    const feb29 = rows.find((row) => row.gregorian_date.endsWith("-02-29"));
    if (feb29) {
      const matchesFeb28 = TIMING_FIELDS.every((field) => feb29[field] === feb28Source[field]);
      if (!matchesFeb28) throw new Error(`${year}-02-29 does not match 2026-02-28 after write`);
      console.log(`${year}-02-29 = 2026-02-28 timings ✓ (provisional leap-day rule)`);
    }
    if (rows.length !== EXPECTED_DAYS[year] || incomplete.length > 0) {
      allPopulated = false;
      console.error(
        `INCOMPLETE ${year}: ${rows.length} rows (expect ${EXPECTED_DAYS[year]}), ` +
          `${incomplete.length} with missing timings.`,
      );
    } else {
      console.log(`all ${EXPECTED_DAYS[year]} ${year} rows fully populated with six timings ✓`);
    }
  }
  if (!allPopulated) process.exit(1);

  console.log("\nSummary:");
  for (const [year, r] of results) {
    console.log(
      `  ${year}: updated=${r.updated} alreadyMatching=${r.alreadyMatching} ` +
        `missingSource=${r.missingSource} missingRows=${r.missingRows}${r.ok ? "" : " (FAILED)"}`,
    );
  }
  console.log("done.");
}

main().catch((error) => {
  console.error("PROVISIONAL PRAYER-TIME APPLY FAILED:", error.message);
  process.exit(1);
});
