"use client";

import { AlertCircleIcon, CheckCircle2Icon, SendIcon } from "lucide-react";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";

import { subscribeNewsletter } from "@/features/newsletter/actions";
import { idleNewsletterResult } from "@/features/newsletter/types";
import { useFormStatus } from "react-dom";

/** Subscribe button — disabled + "Subscribing…" while the action runs, so
 * double submissions are impossible. Styling is unchanged from the original. */
function SubscribeButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="h-12 shrink-0 bg-brand-500 px-6 text-sm font-bold hover:bg-brand-600 sm:px-7"
    >
      {pending ? "Subscribing…" : "Subscribe"}
      <SendIcon className="size-4" aria-hidden="true" />
    </Button>
  );
}

/**
 * Homepage newsletter signup. Visually identical to the original design — the
 * only changes are behind the scenes: a real server action (newsletter
 * subscribe) instead of the previous visual-only handler, inline status
 * messages with aria-live semantics, and a hidden honeypot field.
 */
export function NewsletterSignup() {
  const emailId = useId();
  const agreeId = useId();
  const [result, formAction] = useActionState(subscribeNewsletter, idleNewsletterResult);

  // Final submitted state replaces the form (same layout footprint).
  if (result.status === "success" || result.status === "already-subscribed") {
    return (
      <div
        role="status"
        className="mx-auto flex w-full max-w-xl items-center justify-center gap-3 rounded-xl border border-brand-400/40 bg-brand-500/15 px-5 py-4 text-center text-white"
      >
        <CheckCircle2Icon className="size-5 shrink-0 text-brand-400" aria-hidden="true" />
        <span className="font-medium">{result.message}</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto w-full max-w-xl">
      {/* Honeypot — hidden from humans, tempting for bots (donation-form pattern). */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${emailId}-company`} className="sr-only">
          Company
        </label>
        <input
          id={`${emailId}-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Enter your email address"
          className="h-12 w-full flex-1 rounded-lg border border-white/20 bg-white/10 px-4 text-white backdrop-blur-sm transition-colors placeholder:text-white/50 focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
        />
        <SubscribeButton />
      </div>

      <label
        htmlFor={agreeId}
        className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-white/70"
      >
        <input
          id={agreeId}
          name="consent"
          type="checkbox"
          value="true"
          required
          className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-white/10 accent-brand-500"
        />
        <span>I agree that my submitted data is being collected and stored.</span>
      </label>

      {/* Inline status — polite live region so screen readers announce it. */}
      <div aria-live="polite">
        {result.status === "error" ? (
          <p className="mt-3 flex items-start justify-center gap-2 text-sm font-medium text-red-300">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
