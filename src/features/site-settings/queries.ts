import "server-only";

import { cache } from "react";

import { ASSISTANT_DEFAULTS } from "@/features/assistant/config";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { PublicSiteSettings, SiteSettingsRow } from "./types";

/**
 * Safe fallback mirroring the migration's seeded values — used ONLY if the
 * settings query itself fails (network/DB error). An existing row with
 * enabled=false is authoritative data, never replaced by this fallback.
 */
export const SITE_SETTINGS_FALLBACK: PublicSiteSettings = {
  email_announcements_enabled: true,
  email_announcements_label: "Email Announcements",
  email_announcements_url:
    "https://us13.campaign-archive.com/home/?u=01dfc250f2762204df48c0230&id=06a230bfd1",
  whatsapp_group_enabled: true,
  whatsapp_group_label: "Join Our Whats App Events Group",
  whatsapp_group_url: "https://chat.whatsapp.com/LbReeM8ts7VJoC7yMOPqSI",
  floating_whatsapp_enabled: true,
  floating_whatsapp_phone: "+1 773 283 9718",
  floating_whatsapp_message:
    "Assalam-o-Alaikum, I’m reaching out to MASOM through the website. I would like to ask about your programs and services. Thank you.",
  floating_whatsapp_label: "Chat with MASOM",
  ai_assistant_enabled: true,
  ai_assistant_name: ASSISTANT_DEFAULTS.name,
  ai_assistant_welcome_message: ASSISTANT_DEFAULTS.welcomeMessage,
  ai_assistant_fallback_message: ASSISTANT_DEFAULTS.fallbackMessage,
};

/**
 * Public + admin read of the singleton settings row (id='main'). Anon can
 * SELECT through RLS, so the public homepage/layout read uses the same
 * session-aware client without any privileged access. React-cached so the
 * homepage cards and floating button (layout) share ONE fetch per request.
 */
export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  try {
    const supabase = await createSupabaseServerClient();
    // `*` rather than a column list: the AI Support Agent columns are added by
    // a later migration, and naming them explicitly would make the WHOLE read
    // fail (falling back to defaults for the existing WhatsApp/announcement
    // settings) on any deployment where that migration has not run yet.
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", "main")
      .maybeSingle();

    if (error) throw error;
    if (!data) return SITE_SETTINGS_FALLBACK;

    const row = data as unknown as Partial<SiteSettingsRow>;
    return {
      ...SITE_SETTINGS_FALLBACK,
      ...row,
      // Assistant columns may not exist yet — fall back rather than emit
      // `undefined` into the layout.
      ai_assistant_enabled:
        row.ai_assistant_enabled ?? SITE_SETTINGS_FALLBACK.ai_assistant_enabled,
      ai_assistant_name:
        row.ai_assistant_name ?? SITE_SETTINGS_FALLBACK.ai_assistant_name,
      ai_assistant_welcome_message:
        row.ai_assistant_welcome_message ??
        SITE_SETTINGS_FALLBACK.ai_assistant_welcome_message,
      ai_assistant_fallback_message:
        row.ai_assistant_fallback_message ??
        SITE_SETTINGS_FALLBACK.ai_assistant_fallback_message,
    };
  } catch (error) {
    logCmsError("site-settings:getPublic", error);
    return SITE_SETTINGS_FALLBACK;
  }
});

/** Admin read returning the full row (timestamps included) for the form. */
export async function getSiteSettingsRow(): Promise<SiteSettingsRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  if (error) {
    logCmsError("site-settings:getRow", error);
    return null;
  }
  if (!data) return null;

  // Same guard as the public read: on a deployment where the AI Support Agent
  // migration has not run, those columns are simply absent. Filling them from
  // the defaults keeps every form control controlled instead of undefined.
  const row = data as unknown as Partial<SiteSettingsRow>;
  return {
    ...SITE_SETTINGS_FALLBACK,
    ...row,
    ai_assistant_enabled:
      row.ai_assistant_enabled ?? SITE_SETTINGS_FALLBACK.ai_assistant_enabled,
    ai_assistant_name: row.ai_assistant_name ?? SITE_SETTINGS_FALLBACK.ai_assistant_name,
    ai_assistant_welcome_message:
      row.ai_assistant_welcome_message ??
      SITE_SETTINGS_FALLBACK.ai_assistant_welcome_message,
    ai_assistant_fallback_message:
      row.ai_assistant_fallback_message ??
      SITE_SETTINGS_FALLBACK.ai_assistant_fallback_message,
    id: row.id ?? "main",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}
