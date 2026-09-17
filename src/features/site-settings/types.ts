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
>;

/** Admin form payload for updateSiteSettings. */
export type SiteSettingsFormValues = PublicSiteSettings & {
  /**
   * Row version marker used to adopt genuinely newer server props after
   * router.refresh() without ever regressing to stale pre-save values.
   */
  updated_at: string;
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
