"use client";

import { CheckCircleIcon, Loader2Icon, SendIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { submitContactForm } from "../actions";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./turnstile-widget";

const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.email("Please enter a valid email address."),
  message: z.string().trim().min(1, "Please enter your message.").max(5000),
  consent: z
    .boolean()
    .refine((value) => value === true, {
      message: "Please agree before submitting.",
    }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

/**
 * Contact form backed by the submitContactForm server action: the message is
 * validated server-side, protected by Turnstile + honeypot + rate limiting,
 * stored in the database (system of record) and emailed to the MASOM
 * secretary. Same visual design as the approved form — only a Turnstile
 * widget, loading state and real feedback were added.
 */
export function ContactForm() {
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileHandle = useRef<TurnstileWidgetHandle | null>(null);
  // Guards against a double server invocation (Enter key + button click race):
  // a ref flips synchronously before the first await, so a second onSubmit
  // running in the same tick exits immediately.
  const submittingRef = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ContactFormValues>({
    defaultValues: { name: "", email: "", message: "", consent: false },
  });

  const onSubmit = async (values: ContactFormValues) => {
    // Exactly ONE server invocation per user submit.
    if (submittingRef.current) return;

    const parsed = contactFormSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ContactFormValues;
        setError(field, { type: "manual", message: issue.message });
      }
      return;
    }

    // Missing Turnstile token: fail fast client-side with the precise message
    // (never a misleading rate-limit error). The server still enforces it —
    // this is UX, not the security boundary.
    if (!turnstileToken) {
      setErrorMessage("Please complete the security verification.");
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("email", values.email);
    formData.set("message", values.message);
    formData.set("consent", values.consent ? "true" : "false");
    formData.set("turnstileToken", turnstileToken);

    const result = await submitContactForm({ status: "idle" }, formData);

    submittingRef.current = false;
    setPending(false);
    if (result.status === "success") {
      // Success: clear the form and reset the consumed token.
      reset();
      setTurnstileToken("");
      turnstileHandle.current?.reset();
      setSubmitted(true);
    } else if (result.status === "error") {
      // A failed VERIFICATION consumes the token, so recover it for a retry.
      // Validation/rate-limit errors keep the (still valid) token untouched.
      if (result.message.startsWith("Security verification")) {
        setTurnstileToken("");
        turnstileHandle.current?.reset();
      }
      setErrorMessage(result.message);
    }
  };

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-8 flex flex-col items-center rounded-2xl border border-brand-500/30 bg-brand-500/5 px-8 py-12 text-center"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
          <CheckCircleIcon className="size-7" aria-hidden="true" />
        </span>
        <h3 className="mt-5 font-heading text-xl font-bold text-foreground">Thank you.</h3>
        <p className="mt-2 max-w-sm text-base leading-relaxed text-muted-foreground">
          Your message has been submitted successfully. The MASOM team will get back to you soon.
        </p>
        <Button
          type="button"
          variant="outline"
          size="pill"
          className="mt-7"
          onClick={() => setSubmitted(false)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-8 space-y-5"
    >
      {errorMessage ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="contact-name">Your Name</Label>
        <Input
          id="contact-name"
          type="text"
          autoComplete="name"
          placeholder="Your full name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
          className="h-11 rounded-xl px-4"
          {...register("name")}
        />
        {errors.name ? (
          <p id="contact-name-error" role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-email">Your E-mail</Label>
        <Input
          id="contact-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
          className="h-11 rounded-xl px-4"
          {...register("email")}
        />
        {errors.email ? (
          <p id="contact-email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          rows={5}
          placeholder="Write your message…"
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className="min-h-32 rounded-xl px-4 py-3"
          {...register("message")}
        />
        {errors.message ? (
          <p id="contact-message-error" role="alert" className="text-sm text-destructive">
            {errors.message.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="contact-consent"
          className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground"
        >
          <input
            id="contact-consent"
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded accent-brand-500"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "contact-consent-error" : undefined}
            {...register("consent")}
          />
          <span>I agree that my submitted data is being collected and stored.</span>
        </label>
        {errors.consent ? (
          <p id="contact-consent-error" role="alert" className="text-sm text-destructive">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot — hidden from humans, tempting for bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <Label htmlFor="contact-website" className="sr-only">
          Website
        </Label>
        <Input id="contact-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Cloudflare Turnstile — token is required by the server action. */}
      <TurnstileWidget
        handleRef={(handle) => {
          turnstileHandle.current = handle;
        }}
        onToken={setTurnstileToken}
        onReset={() => setTurnstileToken("")}
      />

      <Button
        type="submit"
        variant="cta"
        size="pill"
        disabled={pending}
        className="h-11 w-full rounded-xl px-7 text-sm font-bold sm:w-auto"
      >
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          <>
            Send Message
            <SendIcon className="size-4" aria-hidden="true" />
          </>
        )}
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Your message will be securely submitted to the MASOM team. We&apos;ll use your
        email address only to reply to your message.
      </p>
    </form>
  );
}
