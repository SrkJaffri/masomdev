"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/features/auth/guard";
import { logAdminActivity } from "@/lib/cms/activity";
import { logCmsError } from "@/lib/cms/logging";
import type { ActionResult } from "@/lib/cms/validation";
import { CMS_BUCKETS, deleteImage, uploadImage } from "@/lib/media/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { listProgramPosterMedia } from "./media";
import { getProgramById } from "./queries";
import { programFormSchema } from "./schema";
import type { ProgramPosterMedia } from "./types";

const BUCKET = CMS_BUCKETS.programs;

/** Storage names are root-level files: uuid.ext or a plain basename. */
const SAFE_POSTER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|jpe?g|png)$/i;

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
  await requireAdmin();
  return listProgramPosterMedia();
}

export async function createProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid form.",
    };
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
      return { status: "error", message: upload.error };
    }
    uploadedPath = upload.path;
    posterPath = upload.path;
  } else {
    const reuseName = readPosterRef(formData);
    if (reuseName) {
      if (!SAFE_POSTER_NAME_RE.test(reuseName) || !(await posterExists(reuseName))) {
        return {
          status: "error",
          message: "The selected image is no longer available. Please pick another.",
        };
      }
      posterPath = reuseName;
    }
  }

  const supabase = await createSupabaseServerClient();
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
    .single();

  if (error) {
    if (uploadedPath) await deleteImage(BUCKET, uploadedPath);
    logCmsError("programs:create", error);
    return { status: "error", message: "Could not save the program. Please try again." };
  }

  await logAdminActivity("program", "created", inserted?.id ?? null, parsed.data.title);

  revalidatePrograms();
  return { status: "success", message: "Program added." };
}

export async function updateProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { status: "error", message: "Missing program id." };
  }

  const existing = await getProgramById(id);
  if (!existing) {
    return { status: "error", message: "Program not found." };
  }

  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid form.",
    };
  }

  // Poster decision. Default: keep whatever the program already references.
  let posterPath = existing.poster_path;
  let uploadedPath: string | null = null;
  let previousPath: string | null = null;

  const file = formData.get("poster");
  if (file instanceof File && file.size > 0) {
    const upload = await uploadImage(BUCKET, file);
    if (!upload.ok) {
      return { status: "error", message: upload.error };
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
          return {
            status: "error",
            message: "The selected image is no longer available. Please pick another.",
          };
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
    logCmsError("programs:update", error);
    return {
      status: "error",
      message: "Could not update the program. Please try again.",
    };
  }

  // The DB row now points at posterPath; remove the old image only if no other
  // program still uses it (shared-image safety).
  if (previousPath && previousPath !== posterPath) {
    await deletePosterIfUnused(previousPath, id);
  }

  const action =
    existing.is_published === parsed.data.is_published
      ? "updated"
      : parsed.data.is_published
        ? "published"
        : "unpublished";
  await logAdminActivity("program", action, id, parsed.data.title);

  revalidatePrograms();
  return { status: "success", message: "Program updated." };
}

export async function deleteProgram(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { status: "error", message: "Missing program id." };
  }

  const existing = await getProgramById(id);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("programs").delete().eq("id", id);

  if (error) {
    logCmsError("programs:delete", error);
    return {
      status: "error",
      message: "Could not delete the program. Please try again.",
    };
  }

  // Row is gone — delete the poster only when no remaining program references it.
  if (existing) await deletePosterIfUnused(existing.poster_path, id);

  await logAdminActivity(
    "program",
    "deleted",
    id,
    existing ? existing.title : undefined,
  );

  revalidatePrograms();
  return { status: "success", message: "Program deleted." };
}
