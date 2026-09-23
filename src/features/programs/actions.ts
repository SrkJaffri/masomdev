"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { logAdminActivity } from "@/lib/cms/activity";
import {
  logAdminDiagnostic,
  newProgramCorrelationId,
  safeDiagnosticMessage,
  type ProgramMutationStage,
} from "@/lib/cms/diagnostics";
import { logCmsError } from "@/lib/cms/logging";
import type { ActionResult } from "@/lib/cms/validation";
import { CMS_BUCKETS, deleteImage, uploadImage } from "@/lib/media/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { listProgramPosterMedia } from "./media";
import { programFormEchoFrom, programFormSchema } from "./schema";
import { getProgramById } from "./queries";
import type { ProgramPosterMedia } from "./types";

const BUCKET = CMS_BUCKETS.programs;

/** Storage names are root-level files: uuid.ext or a plain basename. */
const SAFE_POSTER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|jpe?g|png)$/i;

/** The exact safe message shown for an expired/missing admin session. */
const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

/** Generic safe message for unexpected failures (shown with a reference id). */
const GENERIC_FAILURE_MESSAGE =
  "We couldn't complete this action. Please try again.";

/**
 * redirect()/notFound() inside Server Actions throw special Next.js control
 * values whose `digest` starts with "NEXT_". They are control flow, never
 * bugs — rethrow them untouched.
 */
function isControlFlowError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest === "NEXT_REDIRECT" ||
      (error as { digest: string }).digest.startsWith("NEXT_"))
  );
}

/**
 * `requireAdmin()` redirect()s (a control-flow exception) instead of
 * returning, so a Server Action whose session lapsed mid-flight would throw
 * NEXT_REDIRECT — which the client form surfaces as a generic action error
 * that crashes this section's UI. Instead, each mutation asks directly: a
 * null user means the session is gone; a user without the admin role means
 * RLS would reject the mutation anyway. Either way the caller returns a
 * typed, safe result. requireAdmin() remains the gate for page loads; RLS
 * stays the real security boundary — this check only decides UX.
 */
async function getSessionState(): Promise<
  { ok: true; userId: string } | { ok: false; reason: "no-user" | "not-admin" }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no-user" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false, reason: "not-admin" };
  return { ok: true, userId: user.id };
}

function revalidatePrograms() {
  revalidatePath("/admin/programs");
  revalidatePath("/");
  revalidatePath("/events-schedule");
  revalidateTag("programs");
}

function parseProgramForm(formData: FormData) {
  return programFormSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    start_date: formData.get("start_date") ?? "",
    end_date: formData.get("end_date") ?? "",
    start_time: formData.get("start_time") ?? "",
    end_time: formData.get("end_time") ?? "",
    location: formData.get("location") ?? "",
    link_url: formData.get("link_url") ?? "",
    is_published: formData.get("is_published"),
    sort_order: formData.get("sort_order") ?? "0",
  });
}

/** String entries of a FormData, for echoing submitted values back on error. */
function stringEntries(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.keys()]
      .filter((key) => typeof formData.get(key) === "string")
      .map((key) => [key, formData.get(key) as string]),
  );
}

/**
 * The value of the hidden `poster_ref` field (a storage name chosen from the
 * media library), or null when the admin uploaded a file / kept the poster.
 */
function readPosterRef(formData: FormData): string | null {
  const value = formData.get("poster_ref");
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 ? name : null;
}

/** True when the storage object still exists (mirrors what the picker showed). */
async function posterExists(name: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(BUCKET).exists(name);
  if (error) return false;
  return data === true;
}

/**
 * Number of OTHER programs whose poster_path equals `path`. Used before
 * deleting a storage object so shared images are never removed while another
 * program still references them.
 */
async function countOtherPosterReferences(
  path: string,
  excludeProgramId?: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("programs")
    .select("id", { count: "exact", head: true })
    .eq("poster_path", path);
  if (excludeProgramId) query = query.neq("id", excludeProgramId);
  const { count, error } = await query;
  if (error) {
    // Fail closed: if we cannot verify, keep the file.
    logCmsError("programs:countPosterRefs", error);
    return 1;
  }
  return count ?? 0;
}

/** Deletes a poster file from storage only when no program references it. */
async function deletePosterIfUnused(
  path: string | null | undefined,
  excludeProgramId?: string,
): Promise<void> {
  if (!path) return;
  const references = await countOtherPosterReferences(path, excludeProgramId);
  if (references === 0) await deleteImage(BUCKET, path);
}

/**
 * Lazily loads the Program Media Library (storage listing + usage) on demand
 * instead of on every /admin/programs page load. Called by the client when the
 * admin opens "Choose from media library". Returns [] on any failure (the
 * picker shows an empty/retry state) — never throws to the browser.
 */
export async function getProgramPosterMediaAction(): Promise<ProgramPosterMedia[]> {
  const session = await getSessionState();
  if (!session.ok) return [];
  return listProgramPosterMedia();
}

// ---------------------------------------------------------------------------
// Diagnostics plumbing
// ---------------------------------------------------------------------------

type DiagnosticOp = "create" | "update" | "delete" | "media-delete";

type DiagnosticInput = {
  correlationId: string;
  operation: DiagnosticOp;
  stage: ProgramMutationStage;
  errorCode: string;
  /** The raw failure (Error | PostgREST object | note string) — never sent raw to the client. */
  detail: unknown;
  /** Safe message shown in the user-facing result. */
  userMessage: string;
  /** Validation failures echo the submitted string values back to the form. */
  values?: Record<string, unknown>;
};

/**
 * One call = one correlation-tagged console line + one best-effort durable
 * diagnostic row, then the safe ActionResult the action returns. The raw
 * `detail` is reduced to a single sanitized line; only stage + code + that
 * line are ever persisted or shown. The correlation id rides along so the
 * form can show "Reference: PRG-XXXXXX" for the next-occurrence report.
 */
function fail(input: DiagnosticInput): ActionResult {
  void logAdminDiagnostic({
    correlationId: input.correlationId,
    operation: input.operation,
    stage: input.stage,
    errorCode: input.errorCode,
    safeMessage: safeDiagnosticMessage(input.detail),
  });
  return {
    status: "error",
    message: input.userMessage,
    correlationId: input.correlationId,
    ...(input.values
      ? { values: programFormEchoFrom(input.values) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Program CRUD
// ---------------------------------------------------------------------------

export async function createProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const correlationId = newProgramCorrelationId();
  const operation = "create" as const;

  try {
    const session = await getSessionState();
    if (!session.ok) {
      return fail({
        correlationId,
        operation,
        stage: "auth",
        errorCode: "SESSION_EXPIRED",
        detail: `session reason=${session.reason}`,
        userMessage: SESSION_EXPIRED_MESSAGE,
      });
    }

    const parsed = parseProgramForm(formData);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Invalid form.";
      return fail({
        correlationId,
        operation,
        stage: "validation",
        errorCode: "VALIDATION_FAILED",
        detail: first,
        userMessage: first,
        values: stringEntries(formData),
      });
    }

    // Poster: either a brand-new upload or a reference to an existing file.
    // `uploadedPath` is tracked separately so a failed insert only removes the
    // file this request created — never a reused image.
    let uploadedPath: string | null = null;
    let posterPath: string | null = null;

    const file = formData.get("poster");
    if (file instanceof File && file.size > 0) {
      const upload = await uploadImage(BUCKET, file);
      if (!upload.ok) {
        return fail({
          correlationId,
          operation,
          stage: "upload",
          errorCode: "UPLOAD_FAILED",
          detail: upload.error,
          userMessage: upload.error,
        });
      }
      uploadedPath = upload.path;
      posterPath = upload.path;
    } else {
      const reuseName = readPosterRef(formData);
      if (reuseName) {
        if (!SAFE_POSTER_NAME_RE.test(reuseName) || !(await posterExists(reuseName))) {
          return fail({
            correlationId,
            operation,
            stage: "upload",
            errorCode: "POSTER_REF_INVALID",
            detail: `poster_ref rejected (${reuseName.length} chars)`,
            userMessage:
              "The selected image is no longer available. Please pick another.",
          });
        }
        posterPath = reuseName;
      }
    }

    const supabase = await createSupabaseServerClient();
    // .maybeSingle() (not .single()): a returned-zero-rows shape (e.g. an RLS
    // policy change) must read as an error result, not throw into the catch.
    const { data: inserted, error } = await supabase
      .from("programs")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description,
        poster_path: posterPath,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        location: parsed.data.location,
        link_url: parsed.data.link_url,
        is_published: parsed.data.is_published,
        sort_order: parsed.data.sort_order,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (uploadedPath) await deleteImage(BUCKET, uploadedPath);
      return fail({
        correlationId,
        operation,
        stage: "database",
        errorCode: "SAVE_FAILED",
        detail: error,
        userMessage: "Could not save the program. Please try again.",
      });
    }

    await logAdminActivity("program", "created", inserted?.id ?? null, parsed.data.title);

    revalidatePrograms();
    return { status: "success", message: "Program added." };
  } catch (error) {
    // A redirect()/notFound() is control flow, not a bug — let Next handle it.
    if (isControlFlowError(error)) throw error;
    return fail({
      correlationId,
      operation,
      stage: "unknown",
      errorCode: "UNEXPECTED",
      detail: error,
      userMessage: GENERIC_FAILURE_MESSAGE,
    });
  }
}

export async function updateProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const correlationId = newProgramCorrelationId();
  const operation = "update" as const;

  try {
    const session = await getSessionState();
    if (!session.ok) {
      return fail({
        correlationId,
        operation,
        stage: "auth",
        errorCode: "SESSION_EXPIRED",
        detail: `session reason=${session.reason}`,
        userMessage: SESSION_EXPIRED_MESSAGE,
      });
    }

    const id = formData.get("id");
    if (typeof id !== "string" || id.length === 0) {
      return fail({
        correlationId,
        operation,
        stage: "validation",
        errorCode: "VALIDATION_FAILED",
        detail: "Missing program id.",
        userMessage: "Missing program id.",
        values: stringEntries(formData),
      });
    }

    const existing = await getProgramById(id);
    if (!existing) {
      return fail({
        correlationId,
        operation,
        stage: "stale",
        errorCode: "NOT_FOUND",
        detail: `program ${id} not found`,
        userMessage:
          "This program no longer exists. It may have been deleted in another tab.",
      });
    }

    const parsed = parseProgramForm(formData);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Invalid form.";
      return fail({
        correlationId,
        operation,
        stage: "validation",
        errorCode: "VALIDATION_FAILED",
        detail: first,
        userMessage: first,
        values: stringEntries(formData),
      });
    }

    // Poster decision. Default: keep whatever the program already references.
    let posterPath = existing.poster_path;
    let uploadedPath: string | null = null;
    let previousPath: string | null = null;

    const file = formData.get("poster");
    if (file instanceof File && file.size > 0) {
      const upload = await uploadImage(BUCKET, file);
      if (!upload.ok) {
        return fail({
          correlationId,
          operation,
          stage: "upload",
          errorCode: "UPLOAD_FAILED",
          detail: upload.error,
          userMessage: upload.error,
        });
      }
      uploadedPath = upload.path;
      posterPath = upload.path;
      previousPath = existing.poster_path;
    } else {
      const reuseName = readPosterRef(formData);
      if (reuseName) {
        if (reuseName === existing.poster_path) {
          // Re-selected the current image — treat as "keep current".
          posterPath = existing.poster_path;
        } else {
          if (!SAFE_POSTER_NAME_RE.test(reuseName) || !(await posterExists(reuseName))) {
            return fail({
              correlationId,
              operation,
              stage: "upload",
              errorCode: "POSTER_REF_INVALID",
              detail: `poster_ref rejected (${reuseName.length} chars)`,
              userMessage:
                "The selected image is no longer available. Please pick another.",
            });
          }
          posterPath = reuseName;
          previousPath = existing.poster_path;
        }
      }
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("programs")
      .update({
        title: parsed.data.title,
        description: parsed.data.description,
        poster_path: posterPath,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        location: parsed.data.location,
        link_url: parsed.data.link_url,
        is_published: parsed.data.is_published,
        sort_order: parsed.data.sort_order,
      })
      .eq("id", id);

    if (error) {
      // Only clean up the file this request uploaded; the previous poster is
      // still referenced by this program (the update failed).
      if (uploadedPath) await deleteImage(BUCKET, uploadedPath);
      return fail({
        correlationId,
        operation,
        stage: "database",
        errorCode: "SAVE_FAILED",
        detail: error,
        userMessage: "Could not update the program. Please try again.",
      });
    }

    // ----- The mutation is committed from here on. -----
    // Cleanup/revalidation failures are logged (with the same correlation id)
    // but NEVER reported as a save failure, and the mutation is never re-run
    // automatically — a false "save failed" here is what creates duplicates.
    if (previousPath && previousPath !== posterPath) {
      try {
        await deletePosterIfUnused(previousPath, id);
      } catch (cleanupError) {
        logCmsError("programs:update:cleanup", cleanupError);
        void logAdminDiagnostic({
          correlationId,
          operation,
          stage: "upload",
          errorCode: "OLD_POSTER_CLEANUP_FAILED",
          safeMessage: safeDiagnosticMessage(cleanupError),
        });
      }
    }

    const action =
      existing.is_published === parsed.data.is_published
        ? "updated"
        : parsed.data.is_published
          ? "published"
          : "unpublished";
    await logAdminActivity("program", action, id, parsed.data.title);

    try {
      revalidatePrograms();
    } catch (revalidateError) {
      // The row is saved; the admin sees success even if cache purging hiccuped
      // (stale cache self-heals on the next request/refresh).
      logCmsError("programs:update:revalidate", revalidateError);
      void logAdminDiagnostic({
        correlationId,
        operation,
        stage: "revalidation",
        errorCode: "REVALIDATE_FAILED",
        safeMessage: safeDiagnosticMessage(revalidateError),
      });
    }
    return { status: "success", message: "Program updated." };
  } catch (error) {
    if (isControlFlowError(error)) throw error;
    return fail({
      correlationId,
      operation,
      stage: "unknown",
      errorCode: "UNEXPECTED",
      detail: error,
      userMessage: GENERIC_FAILURE_MESSAGE,
    });
  }
}

export async function deleteProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const correlationId = newProgramCorrelationId();
  const operation = "delete" as const;

  try {
    const session = await getSessionState();
    if (!session.ok) {
      return fail({
        correlationId,
        operation,
        stage: "auth",
        errorCode: "SESSION_EXPIRED",
        detail: `session reason=${session.reason}`,
        userMessage: SESSION_EXPIRED_MESSAGE,
      });
    }

    const id = formData.get("id");
    if (typeof id !== "string" || id.length === 0) {
      return fail({
        correlationId,
        operation,
        stage: "validation",
        errorCode: "VALIDATION_FAILED",
        detail: "Missing program id.",
        userMessage: "Missing program id.",
      });
    }

    const existing = await getProgramById(id);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("programs").delete().eq("id", id);

    if (error) {
      return fail({
        correlationId,
        operation,
        stage: "database",
        errorCode: "SAVE_FAILED",
        detail: error,
        userMessage: "Could not delete the program. Please try again.",
      });
    }

    // Row is gone — delete the poster only when no remaining program references it.
    if (existing) {
      try {
        await deletePosterIfUnused(existing.poster_path, id);
      } catch (cleanupError) {
        logCmsError("programs:delete:cleanup", cleanupError);
        void logAdminDiagnostic({
          correlationId,
          operation,
          stage: "upload",
          errorCode: "OLD_POSTER_CLEANUP_FAILED",
          safeMessage: safeDiagnosticMessage(cleanupError),
        });
      }
    }

    await logAdminActivity("program", "deleted", id, existing ? existing.title : undefined);

    try {
      revalidatePrograms();
    } catch (revalidateError) {
      logCmsError("programs:delete:revalidate", revalidateError);
      void logAdminDiagnostic({
        correlationId,
        operation,
        stage: "revalidation",
        errorCode: "REVALIDATE_FAILED",
        safeMessage: safeDiagnosticMessage(revalidateError),
      });
    }
    return { status: "success", message: "Program deleted." };
  } catch (error) {
    if (isControlFlowError(error)) throw error;
    return fail({
      correlationId,
      operation,
      stage: "unknown",
      errorCode: "UNEXPECTED",
      detail: error,
      userMessage: GENERIC_FAILURE_MESSAGE,
    });
  }
}

/**
 * Deletes ONE poster object from the `programs` bucket (media library).
 * Hardened with the same correlation diagnostics as the CRUD actions.
 */
export async function deleteProgramPosterAction(
  name: string,
): Promise<DeletePosterResult> {
  const correlationId = newProgramCorrelationId();
  const operation = "media-delete" as const;

  const target = name.trim();
  if (!SAFE_POSTER_NAME_RE.test(target)) {
    void logAdminDiagnostic({
      correlationId,
      operation,
      stage: "validation",
      errorCode: "POSTER_NAME_INVALID",
      safeMessage: "poster name failed safety check",
    });
    return { ok: false, error: "Unable to delete this image. Please try again." };
  }

  const session = await getSessionState();
  if (!session.ok) {
    void logAdminDiagnostic({
      correlationId,
      operation,
      stage: "auth",
      errorCode: "SESSION_EXPIRED",
      safeMessage: `session reason=${session.reason}`,
    });
    return { ok: false, error: SESSION_EXPIRED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  // Fresh server-side reference check — never trust the client's usage count.
  const { data: referencing, error: refError } = await supabase
    .from("programs")
    .select("title")
    .eq("poster_path", target);

  if (refError) {
    logCmsError("programs:deleteMedia:refs", refError);
    void logAdminDiagnostic({
      correlationId,
      operation,
      stage: "database",
      errorCode: "REF_CHECK_FAILED",
      safeMessage: safeDiagnosticMessage(refError),
    });
    return { ok: false, error: "Unable to delete this image. Please try again." };
  }

  const usedBy = (referencing ?? [])
    .map((row) => (row as { title: string | null }).title)
    .filter((title): title is string => Boolean(title));

  if (usedBy.length > 0) {
    return {
      ok: false,
      error: "This image is currently being used by a Program and cannot be deleted.",
      inUse: true,
      usedBy,
    };
  }

  // Delete only the exact object. If it is already gone (removed out-of-band),
  // treat the deletion as accomplished — the library no longer contains it.
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([target]);
  if (removeError) {
    const { data: stillExists, error: existsError } = await supabase.storage
      .from(BUCKET)
      .exists(target);
    if (existsError || stillExists !== false) {
      logCmsError("programs:deleteMedia", removeError);
      void logAdminDiagnostic({
        correlationId,
        operation,
        stage: "upload",
        errorCode: "STORAGE_DELETE_FAILED",
        safeMessage: safeDiagnosticMessage(removeError),
      });
      return { ok: false, error: "Unable to delete this image. Please try again." };
    }
  }

  await logAdminActivity("program", "media deleted", null, target);
  return { ok: true };
}

export type DeletePosterResult =
  { ok: true } | { ok: false; error: string; inUse?: boolean; usedBy?: string[] };
