import { z } from "zod";

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
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

/** wa.me wants bare international digits — strip spaces/+()/-. */
export function normalizeWhatsappPhone(value: string): string {
  return value.replace(/[^\d]/g, "");
}
