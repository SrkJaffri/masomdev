import "server-only";

import { cache } from "react";

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
    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "email_announcements_enabled,email_announcements_label,email_announcements_url," +
          "whatsapp_group_enabled,whatsapp_group_label,whatsapp_group_url," +
          "floating_whatsapp_enabled,floating_whatsapp_phone,floating_whatsapp_message,floating_whatsapp_label",
      )
      .eq("id", "main")
      .maybeSingle();

    if (error) throw error;
    if (!data) return SITE_SETTINGS_FALLBACK;
    return data as unknown as PublicSiteSettings;
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
  return (data as SiteSettingsRow | null) ?? null;
}
