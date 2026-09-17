"use server";

import { headers } from "next/headers";

import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { newsletterFormSchema, normalizeEmail } from "./schema";
import type { NewsletterActionResult } from "./types";

/**
 * PUBLIC newsletter subscription — the ONLY write path to
 * newsletter_subscribers from the public site.
 *
 * Security model:
 * - Runs server-side only; the service-role key stays on the server.
 * - The table has NO anon RLS policies, so the public API cannot touch it.
 * - Consent is validated SERVER-SIDE (the browser checkbox is not trusted).
 * - Emails are normalized (trim + lowercase) and unique case-insensitively at
 *   the DB level, so duplicate rows are impossible.
 * - Spam: hidden honeypot field + the same lightweight per-IP throttle the
 *   donation form uses. Errors are generic — no DB/internal details leak.
 */
export async function subscribeNewsletter(
  _prev: NewsletterActionResult,
  formData: FormData,
): Promise<NewsletterActionResult> {
  // Honeypot: if a bot filled the hidden field, silently pretend success.
  const honeypot = formData.get("company");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { status: "success", message: "Thank you for subscribing to MASOM updates." };
  }

  // Basic per-IP throttle (same pattern as the donation form).
  const throttleError = await enforceThrottle();
  if (throttleError) return throttleError;

  // Validate. Arbitrary extra fields are simply ignored by the schema.
  const parsed = newsletterFormSchema.safeParse({
    email: formData.get("email") ?? "",
    consent: formData.get("consent"),
    company: formData.get("company") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    };
  }

  const email = normalizeEmail(parsed.data.email);

  try {
    const supabase = createSupabaseAdminClient();

    // Deterministic duplicate handling: look the subscriber up first.
    const { data: existing, error: selectError } = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (selectError) throw selectError;

    // Already subscribed (any capitalization — the DB stores normalized).
    if (existing && existing.status === "subscribed") {
      return {
        status: "already-subscribed",
        message: "You're already subscribed to MASOM updates.",
      };
    }

    if (existing) {
      // Previously unsubscribed -> reactivate the SAME record (no new row).
      const { error: updateError } = await supabase
        .from("newsletter_subscribers")
        .update({
          consent: true,
          status: "subscribed",
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;

      return { status: "success", message: "Thank you for subscribing to MASOM updates." };
    }

    // Brand-new subscriber. If a concurrent request inserts the same email
    // first, the unique index rejects it — treat that as "already subscribed".
    const { error: insertError } = await supabase
      .from("newsletter_subscribers")
      .insert({ email, consent: true, status: "subscribed", source: "homepage" });

    if (insertError) {
      if (insertError.code === "23505") {
        return {
          status: "already-subscribed",
          message: "You're already subscribed to MASOM updates.",
        };
      }
      throw insertError;
    }

    return { status: "success", message: "Thank you for subscribing to MASOM updates." };
  } catch (error) {
    logCmsError("newsletter:subscribe", error);
    return {
      status: "error",
      message: "We couldn't complete your subscription. Please try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Per-IP throttle — copied donation-form pattern (in-memory, single instance).
// ---------------------------------------------------------------------------
const RATE_LIMIT_MS = 10_000;
const MAX_IP_ENTRIES = 2_000;
const lastSubmissionAt = new Map<string, number>();

async function enforceThrottle(): Promise<NewsletterActionResult | null> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const last = lastSubmissionAt.get(ip) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return {
      status: "error",
      message: "Please wait a moment before subscribing again.",
    };
  }
  if (lastSubmissionAt.size > MAX_IP_ENTRIES) lastSubmissionAt.clear();
  lastSubmissionAt.set(ip, now);
  return null;
}
