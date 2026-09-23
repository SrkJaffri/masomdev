import "server-only";

import { randomBytes } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The Programs CMS area — the only instrumented area so far. */
export const DIAGNOSTIC_AREA_PROGRAMS = "programs";

/** Failure stages for a Program mutation, in execution order. */
export type ProgramMutationStage =
  | "auth"
  | "validation"
  | "stale"
  | "upload"
  | "database"
  | "revalidation"
  | "unknown";

/**
 * Short-lived, human-reportable correlation id (PRG-A1B2C3).
 *
 * `PRG` ties the reference to the Programs area; 6 crypto-random base-32
 * characters keep collisions negligible for the handful of failures per year
 * this table will ever hold, while staying easy to read over the phone.
 */
export function newProgramCorrelationId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(6);
  let id = "";
  for (const byte of bytes) id += alphabet[byte % 32];
  return `PRG-${id}`;
}

type DurableDiagnosticInput = {
  correlationId: string;
  operation: "create" | "update" | "delete" | "media-delete";
  stage: ProgramMutationStage;
  errorCode: string;
  safeMessage: string;
};

/**
 * Extracts a single-line message from any thrown/rejected value without ever
 * leaking secrets: Supabase/PostgREST errors are plain objects with a
 * `message` property; Error instances use `error.message`. Newlines are
 * flattened so the console log stays one greppable line.
 */
export function safeDiagnosticMessage(error: unknown): string {
  let message = "Unknown error";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    message = (error as { message: string }).message;
  }
  return message.replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * Persists one failure record through the security-definer RPC
 * `log_admin_diagnostic` (RLS-gated, admin-only, append-only). Best-effort by
 * design: the durable copy exists so the NEXT intermittent incident can be
 * traced after Vercel's short-retention logs have expired — if the insert
 * itself fails, the console line above is still emitted and the mutation's
 * user-facing result is unaffected.
 *
 * Only the fields below are ever stored: no tokens, no cookies, no raw form
 * payloads, no stack traces, no applicant/admin PII.
 */
export async function logAdminDiagnostic(input: DurableDiagnosticInput): Promise<void> {
  const line = `[cms-diagnostic:${DIAGNOSTIC_AREA_PROGRAMS}:${input.operation}] correlation=${input.correlationId} stage=${input.stage} code=${input.errorCode} :: ${input.safeMessage}`;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("log_admin_diagnostic", {
      p_correlation_id: input.correlationId,
      p_area: DIAGNOSTIC_AREA_PROGRAMS,
      p_operation: input.operation,
      p_stage: input.stage,
      p_error_code: input.errorCode,
      p_safe_message: input.safeMessage,
    });
    if (error) throw error;
  } catch (error) {
    // The durable copy is best-effort; keep the console line as the fallback.
    console.error(`${line} :: durable-log-failed ${safeDiagnosticMessage(error)}`);
    console.error(line);
    return;
  }
  console.error(line);
}
