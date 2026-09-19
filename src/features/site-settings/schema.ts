import { z } from "zod";

import { POPUP_PAGE_OPTIONS } from "./popup-pages";

/**
 * Site Settings admin form validation. Labels are length-capped so a long
 * value can't break the approved card layout; URLs must be http(s) only
 * (javascript:/data:/vbscript: are rejected before anything is rendered);
 * the WhatsApp phone accepts human-friendly formatting and is normalized to
 * bare digits for wa.me.
 */

const httpUrl = z
  .string()
  .trim()
  .min(1, "Please enter a URL.")
  .max(500, "Please enter a shorter URL.")
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "Please enter a URL starting with https://",
  )
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    },
    "Please enter a valid URL.",
  );

/**
 * Website Popup click-through: optional. Blank = not clickable. Accepts an
 * internal MASOM route (single leading slash, no scheme — resolved as-is) or
 * an approved https:// URL. javascript:, data:, vbscript: and every other
 * unsafe scheme are rejected before anything can be persisted or rendered.
 */
export const popupLinkSchema = z
  .string()
  .trim()
  .max(2048, "Please enter a shorter URL.")
  .refine(
    (value) => {
      if (value === "") return true;
      if (/^\/(?!\/)/.test(value)) {
        // Internal route: reject control characters; anything else goes.
        return !/[\u0000-\u001f\u007f]/.test(value);
      }
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    "Enter an internal path starting with / or a URL starting with https://",
  );

const popupPagePaths = new Set<string>(POPUP_PAGE_OPTIONS.map((option) => option.path));

/** Deduplicate + keep only known public routes; preserves admin's order. */
export function normalizePopupPages(pages: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const page of pages) {
    if (popupPagePaths.has(page) && !seen.has(page)) {
      seen.add(page);
      result.push(page);
    }
  }
  return result;
}

export const siteSettingsSchema = z.object({
  email_announcements_enabled: z.boolean(),
  email_announcements_label: z
    .string()
    .trim()
    .min(1, "Please enter a button text.")
    .max(80, "Please keep the button text under 80 characters."),
  email_announcements_url: httpUrl,

  whatsapp_group_enabled: z.boolean(),
  whatsapp_group_label: z
    .string()
    .trim()
    .min(1, "Please enter a button text.")
    .max(80, "Please keep the button text under 80 characters."),
  whatsapp_group_url: httpUrl,

  floating_whatsapp_enabled: z.boolean(),
  floating_whatsapp_phone: z
    .string()
    .trim()
    .min(1, "Please enter a phone number.")
    .max(30, "Please enter a shorter phone number.")
    .refine((value) => {
      const digits = value.replace(/[^\d]/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }, "Please enter a valid international phone number."),
  floating_whatsapp_message: z
    .string()
    .trim()
    .min(1, "Please enter a default message.")
    .max(300, "Please keep the default message under 300 characters."),
  floating_whatsapp_label: z
    .string()
    .trim()
    .min(1, "Please enter a hover label.")
    .max(60, "Please keep the hover label under 60 characters."),

  // Website Popup. The link is optional (empty = not clickable) and, when
  // present, must be an internal route or an https:// URL — the shared
  // popupLinkSchema rejects javascript:/data: and other unsafe schemes.
  // popup_display_pages holds ROUTE PATHS (never labels), validated against
  // the known public route list so client input can never smuggle arbitrary
  // values into the array stored in the DB.
  popup_enabled: z.boolean(),
  popup_image_url: z.string().max(2048),
  popup_delay_seconds: z.coerce
    .number()
    .int("Delay must be a whole number of seconds.")
    .min(1, "Delay must be at least 1 second.")
    .max(10, "Delay can be at most 10 seconds."),
  popup_display_pages: z
    .array(z.string())
    .max(POPUP_PAGE_OPTIONS.length, "Too many pages selected.")
    .refine(
      (pages) => pages.every((page) => popupPagePaths.has(page)),
      "Please choose pages from the provided list.",
    ),
  popup_frequency: z.enum(["session", "always"]),
  popup_link_url: popupLinkSchema,

  // AI Support Agent. Content only — provider API keys stay in environment
  // variables and are deliberately NOT editable from the CMS.
  ai_assistant_enabled: z.boolean(),
  ai_assistant_name: z
    .string()
    .trim()
    .min(1, "Please enter an assistant name.")
    .max(60, "Please keep the assistant name under 60 characters."),
  ai_assistant_welcome_message: z
    .string()
    .trim()
    .min(1, "Please enter a welcome message.")
    .max(500, "Please keep the welcome message under 500 characters."),
  ai_assistant_fallback_message: z
    .string()
    .trim()
    .min(1, "Please enter a fallback message.")
    .max(500, "Please keep the fallback message under 500 characters."),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

/** wa.me wants bare international digits — strip spaces/+()/-. */
export function normalizeWhatsappPhone(value: string): string {
  return value.replace(/[^\d]/g, "");
}
