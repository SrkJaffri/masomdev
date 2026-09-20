/**
 * Option vocabularies for the Private Program application.
 *
 * Every value here is taken directly from the MASOM paper form
 * (`/public/pdf/privateProgram.pdf`). Labels mirror the printed wording so a
 * submitted application reads the same as the original document.
 *
 * Shared by the client form, the Zod schema and the email builder so the three
 * can never drift apart.
 */

export const RECURRENCE_OPTIONS = [
  { value: "one-time", label: "One Time" },
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
  { value: "other", label: "Other" },
] as const;

export type RecurrenceValue = (typeof RECURRENCE_OPTIONS)[number]["value"];

/**
 * Congregation areas. `parent: "basement"` reproduces the printed form, where
 * Media Hall and Library are indented beneath Basement — they are areas within
 * it, not separate floors.
 */
export const CONGREGATION_AREA_OPTIONS = [
  { value: "first-floor", label: "1st Floor", parent: null },
  { value: "second-floor", label: "2nd Floor", parent: null },
  { value: "basement", label: "Basement", parent: null },
  { value: "media-hall", label: "Media Hall", parent: "basement" },
  { value: "library", label: "Library", parent: "basement" },
] as const;

export type CongregationAreaValue = (typeof CONGREGATION_AREA_OPTIONS)[number]["value"];

export const FOOD_SERVICE_OPTIONS = [
  { value: "served", label: "Served" },
  { value: "distributed", label: "Distributed (To-go)" },
] as const;

export type FoodServiceValue = (typeof FOOD_SERVICE_OPTIONS)[number]["value"];

export const LOGISTICS_OPTIONS = [
  { value: "microphone", label: "Microphone / PA System" },
  { value: "projector", label: "Projector / Presentation Equipment" },
] as const;

export type LogisticsValue = (typeof LOGISTICS_OPTIONS)[number]["value"];

export const ADVERTISEMENT_OPTIONS = [
  { value: "notice-board", label: "MASOM Notice Board" },
] as const;

export type AdvertisementValue = (typeof ADVERTISEMENT_OPTIONS)[number]["value"];

/**
 * The 13 facility guidelines, reproduced from the paper form. Displayed in
 * full on the page and referenced by the agreement checkbox.
 */
export const MASOM_GUIDELINES = [
  "MASOM Rules and Regulations must be followed at all times.",
  "The programs shall start and finish on time.",
  "Only areas listed in this form will be used. If a venue needs to change, it shall be communicated to the Secretary at least two days before the program's scheduled date.",
  "ALL programs shall be recorded as per MASOM Audio Video Archival policy.",
  "Web Transmission of the program is not permitted.",
  "PhoneTree messaging service shall not be used to advertise this program.",
  "There shall be no statements, or acts against the Shariat-e-Muhammadi (saww).",
  "There shall be no resolutions or statements made against the United States of America.",
  "There shall be no resolutions or statements condoning violence.",
  "The sponsors of the programs are required to deposit $100, as a deposit, to cover cleaning, logistical components, and other miscellaneous expenses. This deposit shall be returned back to the sponsor(s) after at least ONE Executive Committee member clears the facility against any of the above violations. Any damage/abuse as a result of the program, not covered by the deposit, shall be billed to the sponsor(s).",
  "Before leaving the MASOM premises, the sponsor must ensure that there are no open flames, or any other kind of fire hazards present (candles, agarbatti etc.).",
  "All lights shall be turned off.",
  "MASOM reserves the right to change these guidelines without prior notice.",
] as const;

/** The indemnity agreement, reproduced from the paper form. */
export const AGREEMENT_TEXT =
  "I/we hereby agree to abide by the rules above. I/we also agree that failure to " +
  "adhere to these rules shall result in the immediate termination of this contract " +
  "with MASOM. I/we also understand that MASOM reserves the right to terminate this " +
  "contract at any time without prior notice. To the greatest extent permitted by " +
  "law, I/we agree to protect, indemnify, and hold MASOM harmless, and release MASOM " +
  "from all liability, from all claims, losses, or damages, including attorneys fees, " +
  "arising out of or connected with the event except for MASOM's gross negligence or " +
  "willful misconduct.";

/**
 * Accounting fields printed down the left margin of the paper form. They exist
 * here ONLY so the digital page shows the same document structure — they are
 * rendered read-only, are never part of the submitted payload, and are never
 * reported as applicant-supplied values.
 */
export const OFFICE_USE_FIELDS = [
  { label: "Deposit (see guideline #10)", placeholder: "$" },
  { label: "Donation (per program)", placeholder: "$" },
  { label: "Total", placeholder: "$" },
  { label: "Receipt Number", placeholder: "—" },
  { label: "Secretary, MASOM", placeholder: "—" },
  { label: "Secretary Date", placeholder: "—" },
] as const;

/** Maximum length of the free-text program summary. */
export const SUMMARY_MAX_LENGTH = 2000;
