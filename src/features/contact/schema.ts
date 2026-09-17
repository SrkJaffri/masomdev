import { z } from "zod";

/**
 * Public contact form (/contacts). The honeypot (`website`) mirrors the
 * donation form's pattern — bots that fill it are silently dropped. Consent
 * and the Turnstile token are validated server-side; the browser is never
 * trusted.
 */
export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(120, "Please enter a shorter name."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .max(254, "Please enter a shorter email address.")
    .pipe(z.email("Please enter a valid email address.")),
  message: z
    .string()
    .trim()
    .min(10, "Please enter your message (at least 10 characters).")
    .max(5000, "Please keep your message under 5000 characters."),
  consent: z
    .union([z.boolean(), z.enum(["true", "on"])])
    .nullish()
    .transform((value) => value === true || value === "true" || value === "on")
    .refine((value) => value, { message: "Please agree before submitting." }),
  /** Cloudflare Turnstile token from the widget. */
  turnstileToken: z
    .string()
    .min(1, "Please complete the security verification."),
  /** Honeypot field — must stay empty. */
  website: z.string().max(0, "Invalid submission."),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
