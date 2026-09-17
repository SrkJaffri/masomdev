import { z } from "zod";

/**
 * Homepage newsletter subscription. The honeypot (`company`) mirrors the
 * donation form's pattern — bots that fill it are silently dropped. The
 * consent union accepts the checkbox's form values; `true` is required and is
 * re-validated server-side.
 */
export const newsletterFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .max(254, "Please enter a shorter email address.")
    .pipe(z.email("Please enter a valid email address.")),
  consent: z
    .union([z.boolean(), z.enum(["true", "on"])])
    .nullish()
    .transform((value) => value === true || value === "true" || value === "on")
    .refine((value) => value, { message: "Please agree before subscribing." }),
  /** Honeypot field — must stay empty. */
  company: z.string().max(0, "Invalid submission."),
});

export type NewsletterFormValues = z.infer<typeof newsletterFormSchema>;

/** The server normalizes before persistence — never trust the client. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
