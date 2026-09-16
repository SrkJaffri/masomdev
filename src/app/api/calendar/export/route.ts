import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { calendarYear, isSupportedCalendarYear } from "@/features/calendar/config";
import { getCalendarMonth } from "@/features/calendar/queries";
import { logCmsError } from "@/lib/cms/logging";
import { buildMonthlyCalendarPdf, LOGO_PATH } from "@/lib/pdf/calendar-month-pdf";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * GET /api/calendar/export?year=2026&month=7
 *
 * Generates a branded, single-month PDF from the live Supabase calendar data
 * (current Hijri boundaries + overrides included) and streams it as an
 * attachment. Public data — no auth, but every parameter is validated and only
 * the selected month's rows are fetched. Nothing is persisted to storage.
 * The year must be a supported calendar year (2025 pilot, shipped 2026) — the
 * official annual PDF download stays year-specific elsewhere.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawYear = Number.parseInt(url.searchParams.get("year") ?? "", 10);
  const rawMonth = Number.parseInt(url.searchParams.get("month") ?? "", 10);

  const year = Number.isInteger(rawYear) ? rawYear : Number.NaN;
  const month = Number.isInteger(rawMonth) ? rawMonth : Number.NaN;

  // Only supported calendar years and 1-12 are valid; everything else is a
  // safe 400 (never an exception leak).
  if (!isSupportedCalendarYear(year) || month < 1 || month > 12) {
    return new NextResponse("Invalid year or month.", { status: 400 });
  }

  const monthView = await getCalendarMonth(year, month);
  if (!monthView || monthView.days.length === 0) {
    return new NextResponse("Calendar data not found for this month.", {
      status: 404,
    });
  }

  try {
    const logoPng = await readFile(join(process.cwd(), LOGO_PATH));
    const pdf = await buildMonthlyCalendarPdf(monthView, logoPng);
    const filename = `MASOM-Calendar-${MONTH_LABELS[month - 1]}-${year}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // The calendar data changes (timings, boundaries, events), so every
        // export must be fresh — no browser/proxy caching of a stale PDF.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logCmsError("calendar:pdf:generate", error);
    return new NextResponse("Could not generate the PDF. Please try again.", {
      status: 500,
    });
  }
}
