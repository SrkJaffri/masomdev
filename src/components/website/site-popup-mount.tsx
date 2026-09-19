import { getPublicSiteSettings } from "@/features/site-settings/queries";

import { SitePopup, type SitePopupConfig } from "./site-popup";

/**
 * Server entry point for the CMS-controlled Website Popup.
 *
 * Mounted once in the (website) layout, next to the WhatsApp button and
 * Assistant. Reads popup config through the SAME cached public Site Settings
 * read as every other public surface — one shared fetch per request, no
 * cookies(), no headers(), no per-user DB access, no dynamic rendering. When
 * disabled (or the migration has not run yet) this renders NOTHING.
 */
export async function SitePopupMount() {
  const settings = await getPublicSiteSettings();

  const config: SitePopupConfig = {
    enabled: settings.popup_enabled,
    imageUrl: settings.popup_image_url
      ? resolvePopupImageSrc(settings.popup_image_url)
      : "",
    delaySeconds: settings.popup_delay_seconds,
    displayPages: settings.popup_display_pages ?? [],
    frequency:
      settings.popup_frequency === "always" ? ("always" as const) : ("session" as const),
    linkUrl: settings.popup_link_url ?? "",
    // Settings row version — re-arms the session popup when the CMS config
    // changes (updated_at bumps on every admin save via the DB trigger).
    version: settings.updated_at,
  };

  return <SitePopup config={config} />;
}

/**
 * Popup artwork src: absolute https URL passthrough; storage object paths
 * resolve to the public 'popup' bucket URL (same convention as
 * lib/media/storage.resolveImageSrc, kept inline here because that helper is
 * server-only and this module must be importable from a client component).
 */
function resolvePopupImageSrc(path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return path;
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/popup/${encodeURI(path)}`;
}
