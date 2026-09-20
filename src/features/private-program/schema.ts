import { z } from "zod";

import {
  ADVERTISEMENT_OPTIONS,
  CONGREGATION_AREA_OPTIONS,
  FOOD_SERVICE_OPTIONS,
  LOGISTICS_OPTIONS,
  RECURRENCE_OPTIONS,
  SUMMARY_MAX_LENGTH,
} from "./constants";

/**
 * Public Private Program application (/private-program-application).
 *
 * This is the ONE schema: the client validates against it for instant field
 * errors and the server action re-validates the same shape before anything is
 * emailed. The browser is never trusted — client validation is UX only.
 *
 * Deliberately absent: every "For MASOM Office Use Only" accounting field
 * (deposit, donation, total, receipt #, secretary sign-off). Those are printed
 * read-only on the page and have no schema key, so a crafted request cannot
 * smuggle a value into the application email.
 */

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((option) => option.value) as [string, ...string[]];

/**
 * Single-line free text. Rejects CR/LF so an applicant-supplied value can
 * never be spliced into an email header (subject / Reply-To injection).
 */
const singleLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .refine((value) => !/[\r\n]/.test(value), { message: "Line breaks are not allowed here." });

const requiredSingleLine = (max: number, message: string) =>
  singleLine(max).refine((value) => value.length > 0, { message });

/** `YYYY-MM-DD` from a native date input, checked for real calendar validity. */
const dateString = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), message);

/** `HH:MM` from a native time input. */
const timeString = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, message);

/**
 * Phone: permissive on purpose. Digits are counted after stripping the usual
 * punctuation so legitimate international formats (+44 20 7946 0958,
 * (312) 555-0190) all pass, while free text does not.
 */
const phoneSchema = singleLine(40)
  .refine((value) => value.length > 0, { message: "Please enter a phone number." })
  .refine((value) => /^[+()\-.\s\d]+$/.test(value), {
    message: "Please enter a valid phone number.",
  })
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    },
    { message: "Please enter a valid phone number." },
  );

/** Checkbox groups arrive as arrays; unknown values are rejected by the enum. */
const optionalMultiSelect = <T extends readonly { value: string }[]>(options: T) =>
  z.array(z.enum(values(options))).max(options.length).default([]);

export const privateProgramSchema = z
  .object({
    // --- Section 1: Program Schedule ---------------------------------------
    recurrence: z.enum(values(RECURRENCE_OPTIONS), {
      message: "Please choose how often the program repeats.",
    }),
    otherSchedule: singleLine(160).default(""),
    startDate: dateString("Please choose a start date."),
    endDate: dateString("Please choose an end date."),

    // --- Section 2: Program Information ------------------------------------
    programTitle: requiredSingleLine(160, "Please enter the program title."),
    startTime: timeString("Please choose a start time."),
    endTime: timeString("Please choose an end time."),
    summary: z
      .string()
      .trim()
      .min(10, "Please describe the program (at least 10 characters).")
      .max(SUMMARY_MAX_LENGTH, `Please keep the summary under ${SUMMARY_MAX_LENGTH} characters.`),
    speaker: singleLine(160).default(""),
    attendees: z
      .string()
      .trim()
      .default("")
      .refine((value) => value === "" || /^\d{1,6}$/.test(value), {
        message: "Please enter a whole number of attendees.",
      })
      .refine((value) => value === "" || Number(value) >= 1, {
        message: "Estimated attendees must be at least 1.",
      }),

    // --- Section 3: Facility & Services ------------------------------------
    congregationAreas: z
      .array(z.enum(values(CONGREGATION_AREA_OPTIONS)))
      .min(1, "Please select at least one congregation area.")
      .max(CONGREGATION_AREA_OPTIONS.length),
    foodService: optionalMultiSelect(FOOD_SERVICE_OPTIONS),
    logistics: optionalMultiSelect(LOGISTICS_OPTIONS),
    advertisement: optionalMultiSelect(ADVERTISEMENT_OPTIONS),

    // --- Section 5: Agreement & Applicant ----------------------------------
    // The checkbox arrives as a boolean from react-hook-form and as a string
    // ("true"/"false"/"on") from FormData, so accept both and normalise. Any
    // other value is simply "not agreed" and gets the same friendly message.
    agreement: z
      .union([z.boolean(), z.string()])
      .nullish()
      .transform((value) => value === true || value === "true" || value === "on")
      .refine((value) => value, {
        message: "Please agree to the MASOM guidelines before submitting.",
      }),
    applicantName: requiredSingleLine(160, "Please enter the applicant name(s)."),
    electronicSignature: requiredSingleLine(160, "Please type your name as your signature."),
    agreementDate: dateString("Please choose the agreement date."),
    phone: phoneSchema,
    email: z
      .string()
      .trim()
      .min(1, "Please enter your email address.")
      .max(254, "Please enter a shorter email address.")
      .refine((value) => !/[\r\n]/.test(value), { message: "Please enter a valid email address." })
      .pipe(z.email("Please enter a valid email address.")),

    /** Honeypot field — must stay empty. */
    website: z.string().max(0, "Invalid submission.").default(""),
  })
  // "Other" recurrence is meaningless without the explanation the paper form
  // asks for on the adjacent line.
  .refine((data) => data.recurrence !== "other" || data.otherSchedule.trim().length > 0, {
    message: "Please describe the schedule.",
    path: ["otherSchedule"],
  })
  // A One Time program may start and end on the same day, so this is >=.
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  });

export type PrivateProgramValues = z.infer<typeof privateProgramSchema>;
