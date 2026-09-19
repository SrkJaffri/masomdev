import "server-only";

import { randomUUID } from "node:crypto";

import { getSupabasePublicEnv } from "@/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** CMS storage buckets (created in supabase/migrations/*_storage.sql). */
export const CMS_BUCKETS = {
  banners: "banners",
  programs: "programs",
  /** Dedicated Website Popup artwork bucket (public read, admin-only write). */
  popup: "popup",
} as const;

export type CmsBucket = (typeof CMS_BUCKETS)[keyof typeof CMS_BUCKETS];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export const ACCEPTED_IMAGE_LABEL = "WebP, JPEG, or PNG";

type CmsImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

const EXTENSION_BY_TYPE: Record<CmsImageType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export type ImageValidation = { ok: true } | { ok: false; error: string };
export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

/** Server-side gate: only real, small, image files of an allowed type. */
export function validateImageFile(file: File | null): ImageValidation {
  if (!file || file.size === 0) {
    return { ok: false, error: "Please choose an image file." };
  }
  if (
    !ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])
  ) {
    return { ok: false, error: `Only ${ACCEPTED_IMAGE_LABEL} images are allowed.` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }
  return { ok: true };
}

/**
 * Inspects the file's leading bytes ("magic number") and returns the actual
 * image type, or null if the content is not a supported image. This does NOT
 * trust the browser-provided MIME type — a file renamed/relabelled to look like
 * an image (or an executable disguised as one) will not match a signature and
 * is rejected. The detected type is what we persist, so the stored object's
 * extension/content-type always reflects the real bytes.
 */
async function detectImageType(file: File): Promise<CmsImageType | null> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, index) => header[offset + index] === byte);

  // JPEG: FF D8 FF
  if (matches([0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP: "RIFF" .... "WEBP"
  if (matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

/**
 * Uploads an image to a CMS bucket using the caller's authenticated session,
 * so Storage RLS (admin-only writes) is enforced. Returns the bucket-relative
 * object path to persist in the row's *_path column.
 *
 * Validation is layered: a fast metadata check (declared type + size) followed
 * by a content signature check. The stored extension/content-type come from the
 * detected type, never from the (spoofable) browser MIME or the file name.
 */
export async function uploadImage(bucket: CmsBucket, file: File): Promise<UploadResult> {
  const valid = validateImageFile(file);
  if (!valid.ok) return valid;

  const detected = await detectImageType(file);
  if (!detected) {
    return { ok: false, error: `Only ${ACCEPTED_IMAGE_LABEL} images are allowed.` };
  }

  const extension = EXTENSION_BY_TYPE[detected];
  const path = `${randomUUID()}.${extension}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: detected,
    upsert: false,
  });

  if (error) {
    return { ok: false, error: "Image upload failed. Please try again." };
  }
  return { ok: true, path };
}

/** Removes an object from a bucket. Silently ignores empty/local paths. */
export async function deleteImage(
  bucket: CmsBucket,
  path: string | null | undefined,
): Promise<void> {
  if (!path || path.startsWith("/") || /^https?:\/\//.test(path)) return;
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(bucket).remove([path]);
}

/**
 * Turns a stored *_path value into a usable <img> src. Handles three shapes so
 * the same mapping works for CMS uploads and local reference-data fallbacks:
 *   - absolute URL  -> returned as-is
 *   - "/local.png"  -> a public/ asset, returned as-is
 *   - "uuid.webp"   -> resolved to the bucket's public URL
 */
export function resolveImageSrc(
  bucket: CmsBucket,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
  const { url } = getSupabasePublicEnv();
  return `${url}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}
