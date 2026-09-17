/** DB row shape for contact_submissions. */
export type ContactSubmissionRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  consent: boolean;
  status: "new" | "read" | "replied" | "archived";
  source: string;
  /** Never rendered — server-side abuse correlation only. */
  ip_hash: string | null;
  user_agent: string | null;
  submitted_at: string;
  read_at: string | null;
  replied_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Admin table/detail item. ip_hash / user_agent are deliberately excluded
 * from the admin list payload — the admin UI never needs them. */
export type ContactSubmission = Omit<ContactSubmissionRow, "ip_hash" | "user_agent">;

export const CONTACT_STATUSES = ["new", "read", "replied", "archived"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Result shape returned by the public contact server action. */
export type ContactActionResult =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const idleContactResult: ContactActionResult = { status: "idle" };
