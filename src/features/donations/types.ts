/**
 * Donation intents — registered interest in donating, NOT payments.
 *
 * MASOM does not process money anywhere in this application. A row in
 * donation_intents means someone told us they intend to give; it is never
 * evidence that funds were received. That is why no status value called
 * "paid", "payment_received" or "completed" exists in the schema, the DB
 * constraint, or this type.
 */

export type DonationIntentRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Informational amount the visitor stated. Nothing was charged. */
  amount: string | number;
  donation_type: string;
  note: string | null;
  /** Where the intent came from: the chatbot or the Donate page form. */
  source: string;
  status: DonationIntentStatus;
  /** Server-derived duplicate guard. Never rendered. */
  idempotency_key: string | null;
  /** Never rendered — server-side abuse correlation only. */
  ip_hash: string | null;
  user_agent: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Admin list item. Hashes and fingerprints never reach the browser. */
export type DonationIntent = Omit<
  DonationIntentRow,
  "ip_hash" | "user_agent" | "idempotency_key"
>;

/**
 * Deliberately contains NO "paid"/"payment_received"/"completed" value.
 * Adding one would imply a verified payment integration that does not exist.
 */
export const DONATION_INTENT_STATUSES = [
  "registered",
  "awaiting_payment",
  "reviewed",
  "archived",
] as const;

export type DonationIntentStatus = (typeof DONATION_INTENT_STATUSES)[number];

export const DONATION_INTENT_STATUS_LABELS: Record<DonationIntentStatus, string> = {
  registered: "Registered",
  awaiting_payment: "Awaiting Payment",
  reviewed: "Reviewed",
  archived: "Archived",
};

export const DONATION_INTENT_SOURCE_LABELS: Record<string, string> = {
  "website-chatbot": "Chatbot",
  "website-donate-form": "Donate Page",
};
