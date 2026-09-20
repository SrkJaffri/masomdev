"use server";

import { getPrivateProgramEmailConfig } from "@/config/env";
import { logCmsError } from "@/lib/cms/logging";
import { resolveClientIp } from "@/lib/http/client-identity";
import { createRateLimiter } from "@/lib/rate-limit";
import { createMathCaptcha } from "@/lib/security/math-captcha";

import { buildPrivateProgramEmail } from "./email";
import { privateProgramSchema } from "./schema";
import type { PrivateProgramActionResult } from "./types";

/**
 * PUBLIC Private Program application submission.
 *
 * Unlike the contact form there is no database table for this feature — the
 * email to the Secretary IS the record. That changes one thing materially: a
 * Resend failure must surface as an error, because nothing else captured the
 * application.
 *
 * Check order (rate limit LAST before the real work — a cooldown is consumed
 * only by ACCEPTED submissions, never by validation/captcha corrections):
 * 1. honeypot (silent success)
 * 2. Zod validation (whole application, server-side)
 * 3. math CAPTCHA verification (server-owned signed cookie; rotated every attempt)
 * 4. rate-limit CHECK (per-IP, private-program-namespaced limiter)
 * 5. rate-limit RESERVE (stamped BEFORE sending, so a double submit cannot
 *    deliver two applications even if the client-side guard is bypassed)
 * 6. Resend delivery
 *
 * Security model:
 * - Runs server-side only; the Resend key is read from the environment inside
 *   the action and never reaches the browser.
 * - The schema has no keys for the "For MASOM Office Use Only" accounting
 *   fields, so a crafted request cannot submit deposit/receipt values.
 * - Applicant text is escaped before it enters the HTML email, and single-line
 *   fields reject CR/LF so nothing can be spliced into a header.
 * - Errors are generic — no Resend/internal details leak to the visitor.
 */

// Own limiter instance — a recent Contact/Donation submission can never block
// an application and vice versa. Local development uses a short 2 s window so
// repeated tests are practical; production always runs the full 20 s window.
const IS_DEV = process.env.NODE_ENV === "development";
const privateProgramLimiter = createRateLimiter("private-program", IS_DEV ? 2_000 : 20_000);

// Distinct cookie from the contact form, so submitting one page never
// invalidates a challenge the visitor is looking at on the other.
const captcha = createMathCaptcha("masom_private_program_captcha");

const GENERIC_ERROR =
  "We were unable to submit your application at this time. Please try again.";

/** Field-level messages the client maps back onto its inputs. */
function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export async function submitPrivateProgramApplication(
  _prev: PrivateProgramActionResult,
  formData: FormData,
): Promise<PrivateProgramActionResult> {
  // 1. Honeypot: if a bot filled the hidden field, silently pretend success.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { status: "success", message: "Your application has been submitted." };
  }

  // 2. Validate the WHOLE application server-side. Only these keys are read —
  //    any extra field in the request (including office-use accounting values)
  //    is ignored entirely.
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const list = (key: string) =>
    formData.getAll(key).filter((value): value is string => typeof value === "string");

  const parsed = privateProgramSchema.safeParse({
    recurrence: text("recurrence"),
    otherSchedule: text("otherSchedule"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    programTitle: text("programTitle"),
    startTime: text("startTime"),
    endTime: text("endTime"),
    summary: text("summary"),
    speaker: text("speaker"),
    attendees: text("attendees"),
    congregationAreas: list("congregationAreas"),
    foodService: list("foodService"),
    logistics: list("logistics"),
    advertisement: list("advertisement"),
    agreement: formData.get("agreement"),
    applicantName: text("applicantName"),
    electronicSignature: text("electronicSignature"),
    agreementDate: text("agreementDate"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Please check the form and try again.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  // 3. Math CAPTCHA — server-owned answer. Rotates on every attempt.
  const captchaResult = await captcha.verifyCaptchaAnswer(text("captchaAnswer"));
  if (captchaResult === "missing") {
    return { status: "error", message: "Please answer the security question." };
  }
  if (captchaResult === "wrong") {
    return { status: "error", message: "Security answer is incorrect. Please try again." };
  }

  // 4. Rate-limit CHECK — only ACCEPTED submissions are inside a cooldown.
  const ip = await resolveClientIp();
  const limiterKey = `private-program:${ip}`;
  if (privateProgramLimiter.isLimited(limiterKey)) {
    return {
      status: "error",
      message: "Please wait a moment before submitting again.",
    };
  }

  // 5. RESERVE before delivery: this is what makes a duplicate submission
  //    impossible to turn into a duplicate email.
  privateProgramLimiter.reserve(limiterKey);

  const data = parsed.data;
  const config = getPrivateProgramEmailConfig();

  if (!config) {
    // Misconfiguration, not visitor error. There is no database fallback for
    // this feature, so the application would be lost — report failure.
    console.error(
      "private-program:submit — Resend is not configured; application NOT sent. Set RESEND_API_KEY.",
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  try {
    const { Resend } = await import("resend");
    const { subject, html, text: plainText } = buildPrivateProgramEmail(data, new Date());

    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from,
      to: [config.to],
      // The Secretary replies straight to the applicant; the From address
      // stays MASOM's own so domain authentication holds.
      replyTo: data.email,
      subject,
      html,
      text: plainText,
    });

    if (error) {
      logCmsError("private-program:submit", error);
      return { status: "error", message: GENERIC_ERROR };
    }

    return {
      status: "success",
      message: "Your Private Program Application has been sent to MASOM.",
    };
  } catch (error) {
    logCmsError("private-program:submit", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/**
 * Create a fresh CAPTCHA challenge: generates the operands, writes the signed
 * HttpOnly cookie, and returns the question for display. Called by the form on
 * mount and by the "New question" refresh — generate and apply happen in ONE
 * action so the displayed question always matches the stored answer (page
 * renders cannot write cookies in Next.js).
 */
export async function refreshPrivateProgramCaptcha(): Promise<string> {
  const { question } = await captcha.createCaptchaChallenge();
  return question;
}
