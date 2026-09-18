import { z } from "zod";

// Production-safe default: if NEXT_PUBLIC_SITE_URL is ever missing from a
// deployment environment, SEO/canonical/OG URLs must still point at the real
// canonical host — never localhost. Local development overrides this via
// .env.local (NEXT_PUBLIC_SITE_URL=http://localhost:3000).
const DEFAULT_SITE_URL = "https://www.masom.com";

const siteUrlSchema = z.url();

const supabasePublicSchema = z.object({
  url: z.url(),
  anonKey: z.string().min(1),
});

export type SupabasePublicEnv = z.infer<typeof supabasePublicSchema>;

export function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const parsed = siteUrlSchema.safeParse(value || DEFAULT_SITE_URL);

  return (parsed.success ? parsed.data : DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const parsed = supabasePublicSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  return parsed.data;
}

export function getSupabaseServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must never be read in the browser.");
  }

  const parsed = z.string().min(1).safeParse(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!parsed.success) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server-side only).");
  }

  return parsed.data;
}

export type DonationEmailConfig = {
  apiKey: string;
  from: string;
  to: string;
  /** Whether the courtesy auto-reply to the donor is enabled (default: true). */
  autoReplyEnabled: boolean;
};

// Values that explicitly disable a feature that is on by default.
const FALSEY_VALUES = new Set(["0", "false", "no", "off"]);

/**
 * Server-only Resend configuration for contact-form notifications. Returns
 * null when a required variable is unset so the caller can degrade safely
 * (the DB insert still happens first — email is best-effort). Never exposes
 * values to the browser.
 */
export type ContactEmailConfig = {
  apiKey: string;
  from: string;
  to: string;
};

export function getContactEmailConfig(): ContactEmailConfig | null {
  if (typeof window !== "undefined") return null;

  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  // Recipient for contact-form notifications. Falls back to the secretary
  // inbox (the address published on the MASOM contact page).
  const to =
    process.env.CONTACT_NOTIFICATION_EMAIL?.trim() ||
    "secretary@masom.com";

  if (!apiKey || !from) return null;

  return { apiKey, from, to };
}

/**
 * Server-only Resend configuration for donation submissions. Returns null when
 * any variable is unset so the caller can fail with a friendly message instead
 * of crashing. Never exposes values to the browser.
 */
export function getDonationEmailConfig(): DonationEmailConfig | null {
  if (typeof window !== "undefined") return null;

  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  const to = process.env.DONATION_NOTIFICATION_EMAIL?.trim() ?? "";

  if (!apiKey || !from || !to) return null;

  // Opt-out flag: the auto-reply is on unless explicitly disabled, so MASOM
  // can turn it off at deploy time without a code change.
  const autoReplyRaw = process.env.DONATION_AUTO_REPLY_ENABLED?.trim().toLowerCase() ?? "";
  const autoReplyEnabled = !FALSEY_VALUES.has(autoReplyRaw);

  return { apiKey, from, to, autoReplyEnabled };
}
