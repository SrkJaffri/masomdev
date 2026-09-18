import "server-only";

import {
  calendarBasePath,
  hijriMonthNames,
  supportedCalendarYears,
} from "@/features/calendar/config";

import {
  currentCalendarYear,
  findCalendarEvent,
  getHijriMonthDates,
  getPrayerTimes,
  resolveHijriMonthNumber,
} from "../queries";
import {
  findCalendarEventSchema,
  getHijriMonthDatesSchema,
  getPrayerTimesSchema,
} from "../schema";

import { type AssistantTool, invalidArguments, unavailable } from "./types";

/**
 * Calendar tools — the structured path for every date, timing and Islamic
 * event question. These always take precedence over site-knowledge search:
 * a MASOM date is a database fact, never prose.
 */

const YEAR_RANGE = `${Math.min(...supportedCalendarYears)}-${Math.max(...supportedCalendarYears)}`;

// ---------------------------------------------------------------------------
// findCalendarEvent
// ---------------------------------------------------------------------------

export const findCalendarEventTool: AssistantTool = {
  definition: {
    name: "findCalendarEvent",
    description:
      "Look up the real date of an Islamic event on MASOM's official Hijri calendar " +
      "(Wiladat, Shahadat/Martyrdom, Wafat, Eid, Shab, Ziarat and historical days). " +
      "Use this for ANY question about when an Islamic event falls. Accepts English " +
      "or Roman Urdu spellings. Never answer an event date without calling this tool.",
    parameters: {
      type: "object",
      properties: {
        eventName: {
          type: "string",
          description:
            "The event exactly as the visitor named it, e.g. 'Wiladat Imam Hasan Askari', " +
            "'Shahadat Imam Ali', 'Eid ul Fitr', 'Ashura'.",
        },
        year: {
          type: "integer",
          description: `Gregorian year to look up (${YEAR_RANGE}). Omit for the current year.`,
        },
      },
      required: ["eventName"],
      additionalProperties: false,
    },
  },
  async execute(input) {
    const parsed = findCalendarEventSchema.safeParse(input);
    if (!parsed.success) {
      return invalidArguments(parsed.error.issues[0]?.message ?? "bad input");
    }

    const year = parsed.data.year ?? currentCalendarYear();
    const result = await findCalendarEvent(parsed.data.eventName, year);
    if (!result) return unavailable("The MASOM calendar");

    if (result.needsMoreDetail) {
      return {
        ok: true,
        data: {
          found: false,
          reason: "ambiguous",
          instruction:
            "The question was too general to identify one event. Ask the visitor which " +
            "event they mean (for example whose Wiladat or Shahadat). Do NOT guess a date.",
          year,
        },
      };
    }

    if (result.occurrences.length === 0) {
      return {
        ok: true,
        data: {
          found: false,
          reason: "no_match",
          instruction:
            `No event matching that name is on MASOM's ${year} calendar. Say so plainly, ` +
            `suggest checking the calendar page at ${calendarBasePath}, and do NOT state a ` +
            "date from your own knowledge.",
          year,
        },
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        year,
        // Multiple entries = either a real ambiguity or a recurring event that
        // legitimately occurs twice in one Gregorian year. Present all of them.
        occurrences: result.occurrences,
        matchedTitles: result.matchedTitles,
        provisionalYear: result.provisional,
        calendarPath: calendarBasePath,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// getPrayerTimes
// ---------------------------------------------------------------------------

export const getPrayerTimesTool: AssistantTool = {
  definition: {
    name: "getPrayerTimes",
    description:
      "Get MASOM's published prayer timings for a date (Fajr, Sunrise, Zohar, Sunset, " +
      "Maghrib, Midnight), plus that day's Hijri date and any Islamic events. Use for " +
      "'today's namaz timings', 'what is today's Hijri date', or timings on a given date.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            `Date as YYYY-MM-DD within ${YEAR_RANGE}. Omit for today in MASOM's local ` +
            "time (America/Chicago).",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  async execute(input) {
    const parsed = getPrayerTimesSchema.safeParse(input);
    if (!parsed.success) {
      return invalidArguments(parsed.error.issues[0]?.message ?? "bad input");
    }

    const result = await getPrayerTimes(parsed.data.date);
    if (!result) return unavailable("MASOM's prayer timings");

    if (result.missing) {
      return {
        ok: true,
        data: {
          found: false,
          date: result.date,
          instruction:
            "MASOM has no published timings for that date. Say so and point the visitor " +
            `to the calendar page at ${calendarBasePath}. Do not estimate timings.`,
        },
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        date: result.date,
        dateLabel: result.dateLabel,
        hijriDate: result.hijriLabel,
        timings: result.timings,
        eventsToday: result.events,
        provisionalYear: result.provisional,
        calendarPath: calendarBasePath,
        note: "Imsaak is not published by MASOM and must not be stated.",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// getHijriMonthDates
// ---------------------------------------------------------------------------

export const getHijriMonthDatesTool: AssistantTool = {
  definition: {
    name: "getHijriMonthDates",
    description:
      "Get the Gregorian start (and end) date of a Hijri month from MASOM's published " +
      "month boundaries. Use for questions like 'Ramzan kab se shuru hai?' or 'when does " +
      "Muharram begin?'. Never calculate a Hijri month start yourself.",
    parameters: {
      type: "object",
      properties: {
        monthName: {
          type: "string",
          description:
            "Hijri month name as the visitor wrote it. MASOM's spellings are: " +
            Object.values(hijriMonthNames).join(", ") + ".",
        },
        year: {
          type: "integer",
          description: `Gregorian year (${YEAR_RANGE}). Omit for the current year.`,
        },
      },
      required: ["monthName"],
      additionalProperties: false,
    },
  },
  async execute(input) {
    const parsed = getHijriMonthDatesSchema.safeParse(input);
    if (!parsed.success) {
      return invalidArguments(parsed.error.issues[0]?.message ?? "bad input");
    }

    const monthNumber = resolveHijriMonthNumber(parsed.data.monthName);
    if (monthNumber === null) {
      return {
        ok: true,
        data: {
          found: false,
          reason: "unknown_month",
          instruction:
            "That is not a recognised Hijri month. Ask the visitor to confirm which month " +
            "they mean. MASOM's months are: " + Object.values(hijriMonthNames).join(", ") + ".",
        },
      };
    }

    const year = parsed.data.year ?? currentCalendarYear();
    const result = await getHijriMonthDates(monthNumber, year);
    if (!result) return unavailable("MASOM's Hijri month boundaries");

    if (result.starts.length === 0) {
      return {
        ok: true,
        data: {
          found: false,
          monthName: result.monthName,
          year,
          instruction:
            `MASOM's calendar has no start for ${result.monthName} inside ${year}. Say so, ` +
            "and offer to check a different year. Do not calculate the date yourself.",
        },
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        monthName: result.monthName,
        year,
        occurrences: result.starts,
        calendarPath: calendarBasePath,
        note: "Hijri month starts follow MASOM's published calendar and may differ from other announcements.",
      },
    };
  },
};
