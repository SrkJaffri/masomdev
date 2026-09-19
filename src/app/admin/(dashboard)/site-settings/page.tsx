import { SiteSettingsManager } from "@/features/site-settings/components/site-settings-manager";
import {
  getSiteSettingsRow,
  SITE_SETTINGS_FALLBACK,
} from "@/features/site-settings/queries";
import { resolveImageSrc } from "@/lib/media/storage";

export default async function AdminSiteSettingsPage() {
  const row = await getSiteSettingsRow();
  // The migration seeds the row, but the form must always render — fall back
  // to the same safe defaults the public site uses.
  const settings = row ?? {
    id: "main",
    ...SITE_SETTINGS_FALLBACK,
    created_at: "",
    updated_at: "",
  };

  return (
    <SiteSettingsManager
      settings={{
        email_announcements_enabled: settings.email_announcements_enabled,
        email_announcements_label: settings.email_announcements_label,
        email_announcements_url: settings.email_announcements_url,
        whatsapp_group_enabled: settings.whatsapp_group_enabled,
        whatsapp_group_label: settings.whatsapp_group_label,
        whatsapp_group_url: settings.whatsapp_group_url,
        floating_whatsapp_enabled: settings.floating_whatsapp_enabled,
        floating_whatsapp_phone: settings.floating_whatsapp_phone,
        floating_whatsapp_message: settings.floating_whatsapp_message,
        floating_whatsapp_label: settings.floating_whatsapp_label,
        ai_assistant_enabled: settings.ai_assistant_enabled,
        ai_assistant_name: settings.ai_assistant_name,
        ai_assistant_welcome_message: settings.ai_assistant_welcome_message,
        ai_assistant_fallback_message: settings.ai_assistant_fallback_message,
        popup_enabled: settings.popup_enabled,
        popup_image_url: settings.popup_image_url,
        // Resolved to a renderable URL (public bucket URL for storage paths)
        // server-side; the form only ever sees a previewable src.
        popup_image_preview: resolveImageSrc(
          "popup",
          settings.popup_image_url || null,
        ),
        popup_delay_seconds: settings.popup_delay_seconds,
        popup_display_pages: settings.popup_display_pages,
        popup_frequency: settings.popup_frequency,
        popup_link_url: settings.popup_link_url,
        // Row-version marker so the form adopts only genuinely newer props.
        updated_at: settings.updated_at,
      }}
    />
  );
}
