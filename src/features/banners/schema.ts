import { z } from "zod";

import {
  boolFromForm,
  optionalExternalImageUrl,
  optionalHttpUrl,
  optionalText,
  sortOrderFromForm,
} from "@/lib/cms/validation";

/** How the banner image is provided: uploaded to Storage, or an external CDN URL. */
export const bannerImageSourceSchema = z.enum(["storage", "external"]).catch("storage");

const HTTP_URL = /^https?:\/\/.+/i;

/**
 * Optional CTA/button URL: internal routes ("/path") or absolute http(s):// —
 * never other schemes (javascript:, data:, etc.). "" -> null.
 */
const optionalCtaUrl = z
  .string()
  .trim()
  .max(2048)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine(
    (value) =>
      value === null ||
      (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) ||
      HTTP_URL.test(value),
    { message: "Enter an internal path (/route) or an https:// URL." },
  );

/**
 * Text fields of the banner form (the image file is validated separately).
 * image_source selects how the image is provided; external_url is only valid
 * (and only used) when the source is "external" — enforced in the server
 * action, since the DB itself requires a URL for external rows.
 */
export const bannerFormSchema = z.object({
  title: optionalText(200),
  show_title: boolFromForm,
  /** Visible hero description — display copy, never used as alt text. */
  description: optionalText(500),
  /** Eyebrow line above the heading; "" -> null = intentionally hidden. */
  eyebrow: optionalText(120),
  /** Per-banner CTA buttons. Hidden buttons keep their stored label/url. */
  primary_cta_label: optionalText(80),
  primary_cta_url: optionalCtaUrl,
  show_primary_cta: boolFromForm,
  secondary_cta_label: optionalText(80),
  secondary_cta_url: optionalCtaUrl,
  show_secondary_cta: boolFromForm,
  /**
   * Alt/accessibility text is no longer an admin-facing field: the form does
   * not send it, and the server action derives a safe value (existing value →
   * title → eyebrow → neutral fallback). Kept optional here so a payload that
   * still includes it is validated rather than trusted blindly.
   */
  image_alt: optionalText(300),
  link_url: optionalHttpUrl,
  sort_order: sortOrderFromForm,
  is_active: boolFromForm,
  image_source: bannerImageSourceSchema,
  external_url: optionalExternalImageUrl,
});

export type BannerFormValues = z.infer<typeof bannerFormSchema>;
