"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { getContactEmailConfig } from "@/config/env";
import { logCmsError } from "@/lib/cms/logging";
import { createRateLimiter } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { createCaptchaChallenge, verifyCaptchaAnswer } from "./captcha";
import { contactFormSchema } from "./schema";
import type { ContactActionResult } from "./types";

/**
 * PUBLIC contact form submission — the ONLY write path to
 * contact_submissions from the public site.
 *
 * Check order (rate limit LAST before the real work — a cooldown is consumed
 * only by ACCEPTED submissions, never by validation/captcha corrections):
 * 1. honeypot (silent success)
 * 2. Zod validation (name/email/message/consent)
 * 3. math CAPTCHA verification (server-owned signed cookie; rotated every attempt)
 * 4. rate-limit CHECK (per-IP, contact-namespaced limiter)
 * 5. rate-limit RESERVE (stamp cooldown for this accepted attempt)
 * 6. DB insert FIRST (the submission must survive email failure)
 * 7. best-effort Resend notification
 *
 * Security model:
 * - Runs server-side only; service-role key stays on the server (it also keys
 *   the CAPTCHA cookie signature and the IP hash).
 * - The table has NO anon RLS policies, so the public API cannot touch it.
 * - Consent is validated SERVER-SIDE (the browser checkbox is not trusted).
 * - Emails are normalized (trim) before persistence.
 * - Spam: honeypot + per-IP throttle + math CAPTCHA. Errors are generic — no
 *   DB/Resend internals leak.
 */

// Contact form has its OWN limiter instance — a recent Donate/Newsletter
// submission can never block Contact and vice versa. Local development uses
// a short 2 s window so repeated tests are practical (all local requests
// share one IP bucket); production always runs the full 20 s window.
const IS_DEV = process.env.NODE_ENV === "development";
const contactLimiter = createRateLimiter("contact", IS_DEV ? 2_000 : 20_000);

export async function submitContactForm(
  _prev: ContactActionResult,
  formData: FormData,
): Promise<ContactActionResult> {
  // 1. Honeypot: if a bot filled the hidden field, silently pretend success.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { status: "success", message: "Thank you. Your message has been submitted successfully." };
  }

  // 2. Validate. Arbitrary extra fields are simply ignored by the schema.
  const parsed = contactFormSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    message: formData.get("message") ?? "",
    consent: formData.get("consent"),
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    };
  }

  // 3. Math CAPTCHA — server-owned answer, verified before anything else
  //    happens. Rotates the challenge on every attempt.
  const captchaResult = await verifyCaptchaAnswer(
    typeof formData.get("captchaAnswer") === "string" ? (formData.get("captchaAnswer") as string) : "",
  );
  if (captchaResult === "missing") {
    return { status: "error", message: "Please answer the security question." };
  }
  if (captchaResult === "wrong") {
    return { status: "error", message: "Security answer is incorrect. Please try again." };
  }

  // 4. Rate-limit CHECK — only ACCEPTED submissions are inside a cooldown.
  const ip = await resolveClientIp();
  const limiterKey = `contact:${ip}`;
  if (contactLimiter.isLimited(limiterKey)) {
    return {
      status: "error",
      message: "Please wait a moment before sending again.",
    };
  }

  // 5. RESERVE the cooldown for this accepted attempt.
  contactLimiter.reserve(limiterKey);

  const { name, email, message } = parsed.data;

  try {
    // 6. DATABASE FIRST — the submission must never be lost to an email
    //    outage. ip is stored as a one-way hash only (privacy).
    const supabase = createSupabaseAdminClient();
    const userAgent =
      (await headers()).get("user-agent")?.slice(0, 300) ?? null;

    const insertResult = await supabase
      .from("contact_submissions")
      .insert({
        name,
        email: email.toLowerCase(),
        message,
        consent: true,
        status: "new",
        source: "contacts-page",
        ip_hash: hashIp(ip),
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (insertResult.error) throw insertResult.error;

    // 7. EMAIL NOTIFICATION — best effort. A Resend failure must NOT fail the
    //    submission or remove the row: the DB is the system of record and the
    //    admin CMS still shows the message.
    const emailConfig = getContactEmailConfig();
    if (!emailConfig) {
      console.error(
        "contact:submit — Resend is not configured; submission saved but no notification was sent. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
      );
    } else {
      const sent = await sendContactNotification(emailConfig, {
        name,
        email: email.toLowerCase(),
        message,
        submittedAt: new Date().toISOString(),
      });
      if (!sent) {
        // Logged inside sendContactNotification; intentionally not surfaced
        // to the visitor — the message IS safely received.
        console.error(
          "contact:submit — notification email failed; submission remains saved in the CMS.",
        );
      }
    }

    return {
      status: "success",
      message: "Thank you. Your message has been submitted successfully.",
    };
  } catch (error) {
    logCmsError("contact:submit", error);
    return {
      status: "error",
      message: "We couldn't submit your message. Please try again.",
    };
  }
}

/**
 * Create a fresh CAPTCHA challenge: generates the operands, writes the signed
 * HttpOnly cookie, and returns the question for display. Called by the form
 * on mount and by the "New question" refresh — generate and apply happen in
 * ONE action so the displayed question always matches the stored answer
 * (page renders cannot write cookies in Next.js).
 */
export async function refreshCaptchaChallenge(): Promise<string> {
  const { question } = await createCaptchaChallenge();
  return question;
}

// ---------------------------------------------------------------------------
// Client IP resolution — trusted-header strategy (first value wins).
// ---------------------------------------------------------------------------
async function resolveClientIp(): Promise<string> {
  const headersList = await headers();

  // Cloudflare (the edge this site is served through) provides the original
  // visitor address directly; it cannot be spoofed past Cloudflare itself.
  const cfIp = headersList.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  // Standard proxy chain — take the FIRST (leftmost = original client) entry.
  const forwarded = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Local development usually has no proxy headers at all. All local requests
  // would collapse onto one bucket and repeatedly trip the 20 s production
  // cooldown, so dev gets a stable, clearly-marked local key (the limiter is
  // constructed with a short 2 s window in dev). Production behavior is
  // unchanged: full 20 s per real client IP.
  if (process.env.NODE_ENV === "development") return "local-dev";

  return "unknown";
}

/** One-way hash of the client IP — abuse correlation without storing the raw
 * address. Salted with the service-role key so the hash is not reversible via
 * rainbow tables; the salt never leaves the server. */
function hashIp(ip: string): string | null {
  if (ip === "unknown") return null;
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Resend notification
// ---------------------------------------------------------------------------
async function sendContactNotification(
  config: { apiKey: string; from: string; to: string },
  data: { name: string; email: string; message: string; submittedAt: string },
): Promise<boolean> {
  const { Resend } = await import("resend");

  const submittedAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(new Date(data.submittedAt));

  const body = [
    "MASOM",
    "New Contact Form Submission",
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    "",
    "Message:",
    data.message,
    "",
    `Submitted: ${submittedAt} (Central Time)`,
    "Source: MASOM Website Contact Form",
  ].join("\n");

  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from,
      to: [config.to],
      replyTo: data.email,
      subject: `New MASOM Website Contact Message — ${data.name}`,
      text: body,
    });
    if (error) {
      logCmsError("contact:notify", error);
      return false;
    }
    return true;
  } catch (error) {
    logCmsError("contact:notify", error);
    return false;
  }
}
