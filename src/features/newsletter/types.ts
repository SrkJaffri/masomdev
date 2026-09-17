/** DB row shape for newsletter_subscribers. */
export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  consent: boolean;
  status: "subscribed" | "unsubscribed";
  source: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Admin table item — the row itself (emails are only ever rendered here). */
export type NewsletterSubscriber = NewsletterSubscriberRow;

/** Result shape returned by the public subscribe server action. */
export type NewsletterActionResult =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "already-subscribed"; message: string }
  | { status: "error"; message: string };

export const idleNewsletterResult: NewsletterActionResult = { status: "idle" };
