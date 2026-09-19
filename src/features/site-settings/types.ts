/** Allowed popup display frequencies (DB constraint mirrors this). */
export type PopupFrequency = "session" | "always";

/** DB row shape for public.site_settings (singleton id='main'). */
export type SiteSettingsRow = {
  id: string;
  email_announcements_enabled: boolean;
  email_announcements_label: string;
  email_announcements_url: string;
  whatsapp_group_enabled: boolean;
  whatsapp_group_label: string;
  whatsapp_group_url: string;
  floating_whatsapp_enabled: boolean;
  floating_whatsapp_phone: string;
  floating_whatsapp_message: string;
  floating_whatsapp_label: string;
  /**
   * AI Support Agent (MASOM Assistant). Provider API keys are NEVER stored
   * here — they remain server-side environment variables.
   */
  ai_assistant_enabled: boolean;
  ai_assistant_name: string;
  ai_assistant_welcome_message: string;
  ai_assistant_fallback_message: string;
  /**
   * Website Popup (CMS-controlled promotional modal). Artwork is a storage
   * object path in the 'popup' bucket or an approved absolute https URL;
   * empty string = not configured (popup never renders).
   */
  popup_enabled: boolean;
  popup_image_url: string;
  popup_delay_seconds: number;
  popup_display_pages: string[];
  popup_frequency: PopupFrequency;
  popup_link_url: string;
  created_at: string;
  updated_at: string;
};

/** What public components consume (no timestamps). */
export type PublicSiteSettings = Pick<
  SiteSettingsRow,
  | "email_announcements_enabled"
  | "email_announcements_label"
  | "email_announcements_url"
  | "whatsapp_group_enabled"
  | "whatsapp_group_label"
  | "whatsapp_group_url"
  | "floating_whatsapp_enabled"
  | "floating_whatsapp_phone"
  | "floating_whatsapp_message"
  | "floating_whatsapp_label"
  | "ai_assistant_enabled"
  | "ai_assistant_name"
  | "ai_assistant_welcome_message"
  | "ai_assistant_fallback_message"
  | "popup_enabled"
  | "popup_image_url"
  | "popup_delay_seconds"
  | "popup_display_pages"
  | "popup_frequency"
  | "popup_link_url"
  /**
   * Row version ("" in the error fallback). Exposed so session-scoped
   * features (website popup) can version their state off the settings row
   * without a second fetch.
   */
  | "updated_at"
>;

/** Admin form payload for updateSiteSettings. */
export type SiteSettingsFormValues = PublicSiteSettings & {
  /**
   * Row version marker used to adopt genuinely newer server props after
   * router.refresh() without ever regressing to stale pre-save values.
   */
  updated_at: string;
  /**
   * Server-resolved, renderable preview URL for the popup artwork (public
   * bucket URL for storage paths, absolute URL passthrough, null when unset).
   * Not stored — popup_image_url remains the persisted value.
   */
  popup_image_preview: string | null;
};

export type SiteSettingsActionResult =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      /** The row exactly as persisted — authoritative for the form state. */
      settings: SiteSettingsFormValues;
    }
  | { status: "error"; message: string };

export const idleSiteSettingsResult: SiteSettingsActionResult = { status: "idle" };
