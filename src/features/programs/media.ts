import "server-only";

import { logCmsError } from "@/lib/cms/logging";
import { CMS_BUCKETS, resolveImageSrc } from "@/lib/media/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ProgramPosterFile, ProgramPosterMedia } from "./types";

const BUCKET = CMS_BUCKETS.programs;

const PAGE_SIZE = 100;
const IMAGE_EXTENSION_RE = /\\.(webp|jpe?g|png)$/i;

type PosterObject = {
  name: string;
  createdAt: string | null;
  /** Upload size in bytes; already present in the list response metadata. */
  sizeBytes: number | null;
};

function isImageObject(object: {
  name: string;
  id: string | null;
  metadata: { mimetype?: string } | null;
}): boolean {
  // Folders have a null id and no metadata; skip them.
  if (object.id === null || !object.metadata) return false;
  const mimetype = object.metadata.mimetype ?? "";
  return mimetype.startsWith("image/") || IMAGE_EXTENSION_RE.test(object.name);
}

/**
 * Lists every image file stored in the `programs` bucket (the same location
 * used by Program poster uploads). Storage list results are capped server-side,
 * so pages are walked with an offset. Returns newest-uploaded first.
 *
 * Callers must already be behind the admin guard; this module only exposes
 * storage metadata + public URLs (never service-role credentials). Query
 * failures return an empty list; session/dynamic-render errors propagate (the
 * admin page is dynamic via its auth layout, matching the other admin queries).
 */
export async function listProgramPosterFiles(): Promise<ProgramPosterFile[]> {
  const supabase = await createSupabaseServerClient();
  const objects: PosterObject[] = [];
  let offset = 0;

  try {
    for (;;) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list("", {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) throw error;
      const page = data ?? [];
      for (const object of page) {
        if (isImageObject(object)) {
          objects.push({
            name: object.name,
            createdAt: object.created_at,
            // `metadata.size` is returned by the same list call — no extra
            // per-image requests needed for the card's file-size line.
            sizeBytes: object.metadata?.size ?? null,
          });
        }
      }
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch (error) {
    logCmsError("programs:listMedia", error);
    return [];
  }

  objects.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return objects.map((object) => ({
    name: object.name,
    url: resolveImageSrc(BUCKET, object.name) ?? "",
    createdAt: object.createdAt,
    sizeBytes: object.sizeBytes,
  }));
}

/**
 * Poster files enriched with the titles of programs currently referencing each
 * file (so the picker can show usage and let admins search by program name).
 */
export async function listProgramPosterMedia(): Promise<ProgramPosterMedia[]> {
  const [files, usage] = await Promise.all([listProgramPosterFiles(), getPosterUsage()]);
  return files.map((file) => ({
    ...file,
    usedBy: usage.get(file.name) ?? [],
  }));
}

/** Maps poster_path -> program titles, from the programs table. */
async function getPosterUsage(): Promise<Map<string, string[]>> {
  const usage = new Map<string, string[]>();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select("title, poster_path")
    .not("poster_path", "is", null);

  if (error) {
    logCmsError("programs:posterUsage", error);
    return usage;
  }
  for (const row of data ?? []) {
    const path = (row as { poster_path: string }).poster_path;
    const title = (row as { title: string }).title;
    if (!path) continue;
    const titles = usage.get(path) ?? [];
    if (!titles.includes(title)) titles.push(title);
    usage.set(path, titles);
  }
  return usage;
}
