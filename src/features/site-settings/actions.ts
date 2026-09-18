"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/guard";
import { logAdminActivity } from "@/lib/cms/activity";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { normalizeWhatsappPhone, siteSettingsSchema } from "./schema";
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
      // Confirmed by the DB trigger — the row-version marker for the client.
      updated_at: (data as { updated_at: string }).updated_at,
    };

    return { status: "success", message: "Settings saved successfully.", settings };
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
