import { z } from "zod";

/** Result shape returned by every CMS server action (drives useActionState). */
export type ActionResult =
  | { status: "idle" }
  | { status: "success"; message: string; toast?: string }
  | {
      status: "error";
      message: string;
      /** PRG-XXXXXX reference for the "next occurrence" report. */
      correlationId?: string;
      // Program-form extension: on a VALIDATION error the submitted text/date
      // values are echoed back so React 19's automatic uncontrolled-form reset
      // cannot wipe the admin's entries — they can correct and retry without
      // retyping everything. Absent for every other failure kind.
      values?: ProgramFormEcho;
    };

/**
 * Safe message returned when the client's Server Action reference no longer
 * resolves (framework-level failure). An admin tab left open across a Vercel
 * deploy keeps its stale client bundle; the first submit then fails before the
 * action ever runs. Nothing was saved — the admin reloads and retries. The
 * mutation is never retried automatically.
 */
export const STALE_SERVER_MESSAGE =
  "This admin page has been updated. Please refresh the page and try again.";

/**
 * Generic safe message for failures reported by the client-side wrapper
 * (network drop, unexpected action crash). Distinct from STALE_SERVER_MESSAGE
 * so the form only offers "Reload page" for the genuinely stale case.
 */
export const ACTION_FAILED_MESSAGE =
  "We couldn't complete this action. Please try again.";

/** Heuristic: does this thrown value look like an unresolvable action reference? */
function isStaleActionError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  return /failed to find server action|server action.*not found|invalid action|action.*mismatch|decrypt/i.test(
    message,
  );
}

/**
 * Client-safe wrapper around a CMS server action: turns framework-level
 * failures (stale Server Action reference after a deploy, network drop, or an
 * unexpected action crash) into typed error results instead of letting them
 * crash the section's error boundary. The returned function is used directly
 * as the `action` of a form / useActionState.
 */
export function withSafeAction(
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>,
): (prev: ActionResult, formData: FormData) => Promise<ActionResult> {
  return async (prev, formData) => {
    try {
      return await action(prev, formData);
    } catch (error) {
      // NEXT_REDIRECT / NOT_FOUND digests are framework control flow — they
      // cannot normally reach the client from an action, but if one ever does,
      // let the framework handle it rather than masking it.
      const digest = (error as { digest?: unknown } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_")) {
        throw error;
      }
      return {
        status: "error",
        message: isStaleActionError(error) ? STALE_SERVER_MESSAGE : ACTION_FAILED_MESSAGE,
      };
    }
  };
}

/** Text/date values echoed back to the Program form after a validation error. */
export type ProgramFormEcho = {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  link_url: string;
  sort_order: string;
  is_published: boolean;
};

export const idleResult: ActionResult = { status: "idle" };

const HTTP_URL = /^https?:\/\/.+/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** Required, trimmed, length-capped text. */
export function requiredText(max = 200) {
  return z.string().trim().min(1, { message: "This field is required." }).max(max);
}

/** Optional free text: "" -> null. */
export function optionalText(max = 2000) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();
}

/** Optional http(s) URL: "" -> null; otherwise must start with http:// or https://. */
export const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || HTTP_URL.test(value), {
    message: "Enter a valid URL starting with http:// or https://",
  });

/**
 * Pure, client-safe check for external image URLs: any valid https:// URL
 * (no hostname allowlist — the MASOM CDN/R2 host is not fixed, so any valid
 * https image URL is accepted). Rejects http:, javascript:, data:, blob:,
 * file:, localhost/loopback, IP-literal hosts and malformed input. Shared by
 * the admin form (UX) and the server actions (security) — both sides always
 * run the same rule.
 */
export function isValidExternalImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return false;
  }
  // IP-literal hosts (IPv4 dotted or bracketed IPv6) are not CDN-style hosts.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.startsWith("[") || host.includes(":")) {
    return false;
  }
  return true;
}

/**
 * Optional external image URL: "" -> null. When provided, must be a valid
 * https:// URL (any host). Server actions enforce this; the admin form uses
 * the same helper for instant UX feedback.
 */
export const optionalExternalImageUrl = z
  .string()
  .trim()
  .max(2048)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || isValidExternalImageUrl(value), {
    message: "Enter a valid HTTPS image URL.",
  });

/** Checkbox/switch value coming from FormData or RHF. Missing -> false. */
export const boolFromForm = z
  .union([z.boolean(), z.enum(["true", "false", "on", "off"])])
  .nullish()
  .transform((value) => value === true || value === "true" || value === "on");

/** Non-negative integer sort order; unparseable -> 0. */
export const sortOrderFromForm = z.coerce.number().int().min(0).max(100000).catch(0);

/** Required calendar date "YYYY-MM-DD". */
export const requiredDate = z
  .string()
  .trim()
  .regex(DATE_RE, { message: "Enter a valid date." });

/** Optional calendar date: "" -> null. */
export const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || DATE_RE.test(value), {
    message: "Enter a valid date.",
  });

/** Optional clock time "HH:MM": "" -> null. */
export const optionalTime = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || TIME_RE.test(value), {
    message: "Enter a valid time.",
  });

/** Optional datetime-local "YYYY-MM-DDTHH:MM": "" -> null. */
export const optionalDateTime = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || DATETIME_LOCAL_RE.test(value), {
    message: "Enter a valid date and time.",
  });
