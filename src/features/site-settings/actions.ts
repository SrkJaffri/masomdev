"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/guard";
import { logAdminActivity } from "@/lib/cms/activity";
import { logCmsError } from "@/lib/cms/logging";
import {
  CMS_BUCKETS,
  deleteImage,
  resolveImageSrc,
  uploadImage,
} from "@/lib/media/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { normalizePopupPages, normalizeWhatsappPhone, siteSettingsSchema } from "./schema";
import type {
  SiteSettingsActionResult,
  SiteSettingsFormValues,
} from "./types";

/** Server-action input: booleans are explicit, never FormData-inferred. */
export type SiteSettingsPayload = Omit<SiteSettingsFormValues, "updated_at">;

/**
 * Admin update of the singleton site_settings row (id='main'). Fully guarded:
 * requireAdmin() + the admin-only RLS update policy. Public surfaces pick up
 * changes on their next request via revalidatePath of the (website) layout.
 *
 * On success the action returns the row exactly as persisted, so the admin
 * form can immediately display DB-confirmed values — no stale-state window,
 * no manual refresh, no guessing about what was saved.
 */
export async function updateSiteSettings(
  payload: SiteSettingsPayload,
): Promise<SiteSettingsActionResult> {
  await requireAdmin();

  const parsed = siteSettingsSchema.safeParse({
    email_announcements_enabled: payload.email_announcements_enabled === true,
    email_announcements_label: payload.email_announcements_label,
    email_announcements_url: payload.email_announcements_url,
    whatsapp_group_enabled: payload.whatsapp_group_enabled === true,
    whatsapp_group_label: payload.whatsapp_group_label,
    whatsapp_group_url: payload.whatsapp_group_url,
    floating_whatsapp_enabled: payload.floating_whatsapp_enabled === true,
    floating_whatsapp_phone: payload.floating_whatsapp_phone,
    floating_whatsapp_message: payload.floating_whatsapp_message,
    floating_whatsapp_label: payload.floating_whatsapp_label,
    ai_assistant_enabled: payload.ai_assistant_enabled === true,
    ai_assistant_name: payload.ai_assistant_name,
    ai_assistant_welcome_message: payload.ai_assistant_welcome_message,
    ai_assistant_fallback_message: payload.ai_assistant_fallback_message,
    // The route list is NOT trusted from the client: normalizePopupPages
    // keeps only real MASOM public routes (deduplicated, order preserved).
    popup_enabled: payload.popup_enabled === true,
    popup_image_url: payload.popup_image_url.trim(),
    popup_delay_seconds: payload.popup_delay_seconds,
    popup_display_pages: normalizePopupPages(payload.popup_display_pages ?? []),
    popup_frequency:
      payload.popup_frequency === "always" ? ("always" as const) : ("session" as const),
    popup_link_url: payload.popup_link_url.trim(),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    };
  }

  const values = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    // Deployment-order safety: before the popup migration has run, the popup
    // columns do not exist and naming them would fail the WHOLE update (the
    // pre-existing WhatsApp/announcement settings would become unsavable).
    // Probe once per save: if the columns are missing, persist everything
    // else and tell the admin the popup part needs the migration.
    const { error: popupColumnError } = await supabase
      .from("site_settings")
      .select("popup_enabled")
      .limit(1);
    const popupColumnsReady = !popupColumnError;

    // The persisted row is read back from the successful UPDATE ... SELECT so
    // the client never has to guess what the authoritative saved state is.
    const { data, error } = await supabase
      .from("site_settings")
      .update({
        email_announcements_enabled: values.email_announcements_enabled,
        email_announcements_label: values.email_announcements_label,
        email_announcements_url: values.email_announcements_url,
        whatsapp_group_enabled: values.whatsapp_group_enabled,
        whatsapp_group_label: values.whatsapp_group_label,
        whatsapp_group_url: values.whatsapp_group_url,
        floating_whatsapp_enabled: values.floating_whatsapp_enabled,
        // Store the human-friendly input; wa.me normalization happens at
        // render time (single source of truth, nothing lost in the CMS).
        floating_whatsapp_phone: values.floating_whatsapp_phone,
        floating_whatsapp_message: values.floating_whatsapp_message,
        floating_whatsapp_label: values.floating_whatsapp_label,
        // Content only — the AI provider key is never stored in the CMS.
        ai_assistant_enabled: values.ai_assistant_enabled,
        ai_assistant_name: values.ai_assistant_name,
        ai_assistant_welcome_message: values.ai_assistant_welcome_message,
        ai_assistant_fallback_message: values.ai_assistant_fallback_message,
        ...(popupColumnsReady && {
          popup_enabled: values.popup_enabled,
          popup_image_url: values.popup_image_url,
          popup_delay_seconds: values.popup_delay_seconds,
          popup_display_pages: values.popup_display_pages,
          popup_frequency: values.popup_frequency,
          popup_link_url: values.popup_link_url,
        }),
      })
      .eq("id", "main")
      .select("updated_at")
      .single();

    if (error) throw error;
    if (!data) throw new Error("Site settings update returned no persisted row.");

    // Safe activity entry — no URLs or message content logged. Exactly one
    // entry per successful save (this action runs once per submit).
    await logAdminActivity("settings", "updated", "main", "Updated site settings");

    // Next request to any public page re-renders with the new settings.
    revalidatePath("/", "layout");

    const settings: SiteSettingsFormValues = {
      // Resolved server-side so the form always has a renderable preview.
      popup_image_preview: popupColumnsReady
        ? resolveImageSrc("popup", values.popup_image_url || null)
        : null,
      email_announcements_enabled: values.email_announcements_enabled,
      email_announcements_label: values.email_announcements_label,
      email_announcements_url: values.email_announcements_url,
      whatsapp_group_enabled: values.whatsapp_group_enabled,
      whatsapp_group_label: values.whatsapp_group_label,
      whatsapp_group_url: values.whatsapp_group_url,
      floating_whatsapp_enabled: values.floating_whatsapp_enabled,
      floating_whatsapp_phone: values.floating_whatsapp_phone,
      floating_whatsapp_message: values.floating_whatsapp_message,
      floating_whatsapp_label: values.floating_whatsapp_label,
      ai_assistant_enabled: values.ai_assistant_enabled,
      ai_assistant_name: values.ai_assistant_name,
      ai_assistant_welcome_message: values.ai_assistant_welcome_message,
      ai_assistant_fallback_message: values.ai_assistant_fallback_message,
      popup_enabled: values.popup_enabled,
      popup_image_url: values.popup_image_url,
      popup_delay_seconds: values.popup_delay_seconds,
      popup_display_pages: values.popup_display_pages,
      popup_frequency: values.popup_frequency,
      popup_link_url: values.popup_link_url,
      // Confirmed by the DB trigger — the row-version marker for the client.
      updated_at: (data as { updated_at: string }).updated_at,
    };

    return {
      status: "success",
      message: popupColumnsReady
        ? "Settings saved successfully."
        : "Settings saved. (Website Popup storage is not migrated yet — apply the popup migration to enable popup settings.)",
      settings,
    };
  } catch (error) {
    logCmsError("site-settings:update", error);
    return {
      status: "error",
      message: "We couldn't save the settings. Please try again.",
    };
  }
}

/** Exported for the admin form's live normalization hint. */
export async function previewWhatsappLink(phone: string, message: string): Promise<string> {
  const digits = normalizeWhatsappPhone(phone);
  return `https://wa.me/${digits}?${new URLSearchParams({ text: message })}`;
}

const POPUP_BUCKET = CMS_BUCKETS.popup;

/**
 * Result for the popup-image upload/remove actions. On success the persisted
 * path + resolved preview are echoed back so the admin form can adopt the
 * DB-confirmed state immediately (no refresh race, no stale overwrite when
 * Save Settings runs afterwards).
 */
export type PopupImageActionResult =
  | { status: "success"; message: string; path: string; previewUrl: string | null }
  | { status: "error"; message: string };

/**
 * Uploads a new popup artwork into the dedicated 'popup' bucket, persists its
 * object path in site_settings.popup_image_url, and deletes the replaced
 * storage object only after the DB update succeeds (no orphans, no broken
 * reference). Same layered validation as every CMS upload: declared type +
 * size, then magic-byte content sniffing — the stored extension/content-type
 * come from the detected bytes, never from the spoofable browser MIME.
 */
export async function uploadPopupImage(
  formData: FormData,
): Promise<PopupImageActionResult> {
  await requireAdmin();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Please choose an image file." };
  }

  const upload = await uploadImage(POPUP_BUCKET, file);
  if (!upload.ok) {
    return { status: "error", message: upload.error };
  }

  const supabase = await createSupabaseServerClient();

  // Read the current path first so the replaced object can be cleaned up.
  const { data: current } = await supabase
    .from("site_settings")
    .select("popup_image_url")
    .eq("id", "main")
    .maybeSingle();
  const previousPath =
    (current as { popup_image_url?: string | null } | null)?.popup_image_url ?? null;

  const { error } = await supabase
    .from("site_settings")
    .update({ popup_image_url: upload.path })
    .eq("id", "main");

  if (error) {
    // Roll back the just-uploaded orphan so storage stays clean.
    await deleteImage(POPUP_BUCKET, upload.path);
    logCmsError("site-settings:uploadPopupImage", error);
    return { status: "error", message: "Could not save the popup image. Please try again." };
  }

  // Replace the previous object only after the DB update landed. Absolute
  // https URLs (and local /public paths) have no storage object to remove.
  if (previousPath && !/^https?:\/\//.test(previousPath) && !previousPath.startsWith("/")) {
    await deleteImage(POPUP_BUCKET, previousPath);
  }

  await logAdminActivity("settings", "updated", "main", "Updated website popup image");
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: "Popup image updated.",
    path: upload.path,
    previewUrl: resolveImageSrc(POPUP_BUCKET, upload.path),
  };
}

/**
 * Clears popup_image_url ("not configured" — the popup stops rendering) and
 * removes the orphaned storage object. The artwork itself is never deleted
 * for external/local URLs.
 */
export async function removePopupImage(): Promise<PopupImageActionResult> {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("site_settings")
    .select("popup_image_url")
    .eq("id", "main")
    .maybeSingle();
  const previousPath =
    (current as { popup_image_url?: string | null } | null)?.popup_image_url ?? null;

  const { error } = await supabase
    .from("site_settings")
    .update({ popup_image_url: "" })
    .eq("id", "main");

  if (error) {
    logCmsError("site-settings:removePopupImage", error);
    return { status: "error", message: "Could not remove the popup image. Please try again." };
  }

  if (previousPath && !/^https?:\/\//.test(previousPath) && !previousPath.startsWith("/")) {
    await deleteImage(POPUP_BUCKET, previousPath);
  }

  await logAdminActivity("settings", "updated", "main", "Removed website popup image");
  revalidatePath("/", "layout");
  return { status: "success", message: "Popup image removed.", path: "", previewUrl: null };
}
