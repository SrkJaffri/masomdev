import { z } from "zod";

import { supportedCalendarYears } from "@/features/calendar/config";
import { DONATION_PURPOSES } from "@/features/donations/schema";

import { ASSISTANT_LIMITS } from "./config";

/**
 * MASOM Assistant validation.
 *
 * Every tool argument is a FIXED, TYPED field validated here before it reaches
 * a query. There is deliberately no free-text "query"/"sql"/"table"/"filter"
 * passthrough anywhere: the model selects a tool and fills declared fields, it
 * never composes a database query.
 */

// ===========================================================================
// Chat request
// ===========================================================================

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1)
    .max(ASSISTANT_LIMITS.maxMessageLength),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, "Please type a question so I can help.")
    .max(ASSISTANT_LIMITS.maxHistoryMessages),
  // Opaque client-generated id (uuid-ish). Not a credential and not trusted for
  // anything except rate-limit bucketing and idempotency key derivation.
  sessionId: z.string().trim().min(8).max(64),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

// ===========================================================================
// Tool arguments
// ===========================================================================

const MIN_YEAR = Math.min(...supportedCalendarYears);
const MAX_YEAR = Math.max(...supportedCalendarYears);

const calendarYearSchema = z
  .number()
  .int()
  .min(MIN_YEAR)
  .max(MAX_YEAR);

/** "YYYY-MM-DD", additionally checked for real calendar validity. */
const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (year < MIN_YEAR || year > MAX_YEAR) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Please use a real date between 2023 and 2029.");

export const findCalendarEventSchema = z.object({
  /**
   * The event name as the visitor said it (English, Roman Urdu, or partial).
   * Matched against stored MASOM event titles — never used as a DB expression.
   */
  eventName: z.string().trim().min(2).max(120),
  /** Gregorian year to resolve the event in. Defaults to the current year. */
  year: calendarYearSchema.optional(),
});

export const getPrayerTimesSchema = z.object({
  /** Specific date. Omit for today (America/Chicago). */
  date: isoDateSchema.optional(),
});

export const getHijriMonthDatesSchema = z.object({
  /** Hijri month name in any supported spelling — resolved to a fixed number. */
  monthName: z.string().trim().min(3).max(40),
  year: calendarYearSchema.optional(),
});

export const getUpcomingProgramsSchema = z.object({
  limit: z.number().int().min(1).max(10).optional(),
});

export const getAnnouncementsSchema = z.object({});

export const getDonationInfoSchema = z.object({});

export const searchSiteKnowledgeSchema = z.object({
  /** Natural-language topic. Searched over a curated in-repo knowledge base. */
  topic: z.string().trim().min(2).max(200),
});

/**
 * Donation types are DERIVED from the approved Donate-page options, so the
 * assistant can never offer a fund MASOM does not actually collect.
 */
export type DonationTypeValue = (typeof DONATION_PURPOSES)[number]["value"];

export const DONATION_TYPE_VALUES = DONATION_PURPOSES.map(
  (purpose) => purpose.value,
) as [DonationTypeValue, ...DonationTypeValue[]];

/**
 * Donation intent registration — the ONLY write tool.
 *
 * Deliberately has NO field for a card number, CVV, bank account, routing
 * number or any banking credential: the schema itself makes it impossible for
 * the assistant to persist payment credentials even if a visitor pastes them.
 */
export const registerDonationIntentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email("Please provide a valid email address.").max(254),
  phone: z.string().trim().max(40).optional(),
  /** Informational amount only — MASOM does not charge it. */
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, "Please provide a numeric amount.")
    .refine((value) => Number(value) > 0, "Amount must be greater than zero."),
  donationType: z.enum(DONATION_TYPE_VALUES),
  note: z.string().trim().max(1000).optional(),
  /**
   * Must be true. The assistant sets it only after showing the visitor a
   * summary and receiving an explicit "yes" — no silent writes.
   */
  confirmed: z.literal(true),
});

export type FindCalendarEventInput = z.infer<typeof findCalendarEventSchema>;
export type GetPrayerTimesInput = z.infer<typeof getPrayerTimesSchema>;
export type GetUpcomingProgramsInput = z.infer<typeof getUpcomingProgramsSchema>;
export type SearchSiteKnowledgeInput = z.infer<typeof searchSiteKnowledgeSchema>;
export type RegisterDonationIntentInput = z.infer<typeof registerDonationIntentSchema>;
