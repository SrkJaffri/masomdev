"use client";

import {
  CheckCircleIcon,
  ClipboardListIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { refreshPrivateProgramCaptcha, submitPrivateProgramApplication } from "../actions";
import {
  ADVERTISEMENT_OPTIONS,
  AGREEMENT_TEXT,
  CONGREGATION_AREA_OPTIONS,
  FOOD_SERVICE_OPTIONS,
  LOGISTICS_OPTIONS,
  MASOM_GUIDELINES,
  OFFICE_USE_FIELDS,
  RECURRENCE_OPTIONS,
  SUMMARY_MAX_LENGTH,
} from "../constants";
import { privateProgramSchema, type PrivateProgramValues } from "../schema";

type FormValues = {
  recurrence: string;
  otherSchedule: string;
  startDate: string;
  endDate: string;
  programTitle: string;
  startTime: string;
  endTime: string;
  summary: string;
  speaker: string;
  attendees: string;
  congregationAreas: string[];
  foodService: string[];
  logistics: string[];
  advertisement: string[];
  agreement: boolean;
  applicantName: string;
  electronicSignature: string;
  agreementDate: string;
  phone: string;
  email: string;
};

type PrivateProgramFormProps = {
  /**
   * Today's date (America/Chicago) computed on the server. Passed in rather
   * than derived from `new Date()` during render so the server and client
   * produce identical markup on first paint.
   */
  defaultAgreementDate: string;
};

function emptyValues(agreementDate: string): FormValues {
  return {
    recurrence: "",
    otherSchedule: "",
    startDate: "",
    endDate: "",
    programTitle: "",
    startTime: "",
    endTime: "",
    summary: "",
    speaker: "",
    attendees: "",
    congregationAreas: [],
    foodService: [],
    logistics: [],
    advertisement: [],
    agreement: false,
    applicantName: "",
    electronicSignature: "",
    agreementDate,
    phone: "",
    email: "",
  };
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 font-heading text-sm font-bold text-brand-600"
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-xl leading-snug font-bold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

/** Shared choice-card chrome for the radio and checkbox controls. */
const choiceCardClass =
  "group flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3.5 text-sm transition-all hover:border-brand-500/50 hover:bg-brand-500/5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500/10 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";

// ---------------------------------------------------------------------------

/**
 * Private Program application form.
 *
 * Mirrors the MASOM paper form section by section. Client-side validation runs
 * the SAME Zod schema the server action uses, purely for instant feedback —
 * the server re-validates every submission and is the real boundary.
 *
 * The "For MASOM Office Use Only" card is rendered OUTSIDE the <form> element
 * and its inputs are disabled, so those accounting fields cannot be part of a
 * submission even in principle.
 */
export function PrivateProgramForm({ defaultAgreementDate }: PrivateProgramFormProps) {
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  // Guards a double server invocation (Enter key + button click race): the ref
  // flips synchronously before the first await, so a second onSubmit running in
  // the same tick exits immediately.
  const submittingRef = useRef(false);
  // Read from the DOM rather than react-hook-form: the honeypot must never
  // appear in validated values, but its value still has to reach the server.
  const honeypotRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: emptyValues(defaultAgreementDate) });

  // Create the challenge (generate + apply cookie) in ONE action so the
  // displayed question always matches the signed answer server-side.
  useEffect(() => {
    void refreshPrivateProgramCaptcha().then(setCaptchaQuestion);
  }, []);

  const recurrence = watch("recurrence");
  const startDate = watch("startDate");
  const summary = watch("summary");

  const refreshCaptcha = () => {
    setCaptchaAnswer("");
    void refreshPrivateProgramCaptcha().then(setCaptchaQuestion);
  };

  const onSubmit = async (values: FormValues) => {
    // Exactly ONE server invocation per user submit.
    if (submittingRef.current) return;

    // Honeypot: a bot that filled the hidden field gets the success screen and
    // never reaches the server. (The action re-checks it for crafted requests
    // that skip this component entirely.)
    const honeypot = honeypotRef.current?.value ?? "";
    if (honeypot.length > 0) {
      setSubmitted(true);
      return;
    }

    const parsed = privateProgramSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          setError(field as keyof FormValues, { type: "manual", message: issue.message });
        }
      }
      setErrorMessage("Please correct the highlighted fields and try again.");
      return;
    }

    if (!captchaAnswer.trim()) {
      setErrorMessage("Please answer the security question.");
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setErrorMessage(null);

    const data: PrivateProgramValues = parsed.data;
    const formData = new FormData();
    const setIf = (key: string, value: string) => formData.set(key, value);

    setIf("recurrence", data.recurrence);
    setIf("otherSchedule", data.otherSchedule);
    setIf("startDate", data.startDate);
    setIf("endDate", data.endDate);
    setIf("programTitle", data.programTitle);
    setIf("startTime", data.startTime);
    setIf("endTime", data.endTime);
    setIf("summary", data.summary);
    setIf("speaker", data.speaker);
    setIf("attendees", data.attendees);
    setIf("applicantName", data.applicantName);
    setIf("electronicSignature", data.electronicSignature);
    setIf("agreementDate", data.agreementDate);
    setIf("phone", data.phone);
    setIf("email", data.email);
    setIf("agreement", data.agreement ? "true" : "false");
    setIf("captchaAnswer", captchaAnswer);
    setIf("website", honeypot);
    for (const area of data.congregationAreas) formData.append("congregationAreas", area);
    for (const item of data.foodService) formData.append("foodService", item);
    for (const item of data.logistics) formData.append("logistics", item);
    for (const item of data.advertisement) formData.append("advertisement", item);

    const result = await submitPrivateProgramApplication({ status: "idle" }, formData);

    submittingRef.current = false;
    setPending(false);

    if (result.status === "success") {
      reset(emptyValues(defaultAgreementDate));
      refreshCaptcha();
      setSubmitted(true);
      return;
    }

    if (result.status === "error") {
      // The server rotated the challenge on every attempt — pick up the fresh
      // question for the next try.
      refreshCaptcha();
      setErrorMessage(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (field in values) {
            setError(field as keyof FormValues, { type: "server", message });
          }
        }
      }
    }
  };

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center rounded-2xl border border-brand-500/30 bg-brand-500/5 px-6 py-14 text-center sm:px-10"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
          <CheckCircleIcon className="size-8" aria-hidden="true" />
        </span>
        <h2 className="mt-6 font-heading text-2xl font-bold text-foreground">
          Application Submitted
        </h2>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
          Thank you. Your Private Program Application has been sent to MASOM. Submission of
          this application does not constitute final approval. A MASOM representative will
          contact you after review.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="cta" size="pill" className="h-11 rounded-xl px-7">
            <Link href="/">Return to Home</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="pill"
            className="h-11 rounded-xl px-7"
            onClick={() => {
              setSubmitted(false);
              setErrorMessage(null);
            }}
          >
            Submit Another Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {errorMessage ? (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        {/* ---------------- 1. Program Schedule ---------------- */}
        <FormSection
          step={1}
          title="Program Schedule"
          description="Tell us how often the program runs and the dates it covers."
        >
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">
              How often does this program repeat?
              <RequiredMark />
            </legend>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {RECURRENCE_OPTIONS.map((option) => (
                <label key={option.value} className={choiceCardClass}>
                  <input
                    type="radio"
                    value={option.value}
                    className="mt-0.5 size-4 shrink-0 accent-brand-500"
                    {...register("recurrence")}
                  />
                  <span className="font-medium text-foreground">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-2">
              <FieldError id="pp-recurrence-error" message={errors.recurrence?.message} />
            </div>
          </fieldset>

          {recurrence === "other" ? (
            <div className="mt-5 space-y-2">
              <Label htmlFor="pp-other-schedule">
                Other Schedule
                <RequiredMark />
              </Label>
              <Input
                id="pp-other-schedule"
                type="text"
                placeholder="Describe the schedule"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.otherSchedule ? true : undefined}
                aria-describedby={errors.otherSchedule ? "pp-other-schedule-error" : undefined}
                {...register("otherSchedule")}
              />
              <FieldError id="pp-other-schedule-error" message={errors.otherSchedule?.message} />
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pp-start-date">
                Start Date
                <RequiredMark />
              </Label>
              <Input
                id="pp-start-date"
                type="date"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.startDate ? true : undefined}
                aria-describedby={errors.startDate ? "pp-start-date-error" : undefined}
                {...register("startDate", {
                  onChange: (event) => {
                    // A One Time program ends the day it starts unless the
                    // applicant says otherwise — prefill rather than nag.
                    const value = event.target.value;
                    if (recurrence === "one-time" && value) {
                      setValue("endDate", value, { shouldValidate: false });
                    }
                  },
                })}
              />
              <FieldError id="pp-start-date-error" message={errors.startDate?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pp-end-date">
                End Date
                <RequiredMark />
              </Label>
              <Input
                id="pp-end-date"
                type="date"
                min={startDate || undefined}
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.endDate ? true : undefined}
                aria-describedby={errors.endDate ? "pp-end-date-error" : undefined}
                {...register("endDate")}
              />
              <FieldError id="pp-end-date-error" message={errors.endDate?.message} />
              <p className="text-xs text-muted-foreground">
                For a one-time program, this can be the same as the start date.
              </p>
            </div>
          </div>
        </FormSection>

        {/* ---------------- 2. Program Information ---------------- */}
        <FormSection
          step={2}
          title="Program Information"
          description="What the program is about, who is speaking and how many people to expect."
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pp-title">
                Program Title
                <RequiredMark />
              </Label>
              <Input
                id="pp-title"
                type="text"
                placeholder="e.g. Majlis-e-Aza"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.programTitle ? true : undefined}
                aria-describedby={errors.programTitle ? "pp-title-error" : undefined}
                {...register("programTitle")}
              />
              <FieldError id="pp-title-error" message={errors.programTitle?.message} />
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-foreground">
                Program Timings
                <RequiredMark />
              </legend>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pp-start-time">Start Time</Label>
                  <Input
                    id="pp-start-time"
                    type="time"
                    className="h-11 rounded-xl px-4"
                    aria-invalid={errors.startTime ? true : undefined}
                    aria-describedby={errors.startTime ? "pp-start-time-error" : undefined}
                    {...register("startTime")}
                  />
                  <FieldError id="pp-start-time-error" message={errors.startTime?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-end-time">End Time</Label>
                  <Input
                    id="pp-end-time"
                    type="time"
                    className="h-11 rounded-xl px-4"
                    aria-invalid={errors.endTime ? true : undefined}
                    aria-describedby={errors.endTime ? "pp-end-time-error" : undefined}
                    {...register("endTime")}
                  />
                  <FieldError id="pp-end-time-error" message={errors.endTime?.message} />
                </div>
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="pp-summary">
                Summary
                <RequiredMark />
              </Label>
              <Textarea
                id="pp-summary"
                rows={5}
                maxLength={SUMMARY_MAX_LENGTH}
                placeholder="Briefly describe the purpose and format of the program…"
                className="min-h-32 rounded-xl px-4 py-3"
                aria-invalid={errors.summary ? true : undefined}
                aria-describedby={
                  errors.summary ? "pp-summary-error pp-summary-count" : "pp-summary-count"
                }
                {...register("summary")}
              />
              <div className="flex items-start justify-between gap-4">
                <FieldError id="pp-summary-error" message={errors.summary?.message} />
                <p id="pp-summary-count" className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {(summary ?? "").length} / {SUMMARY_MAX_LENGTH}
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pp-speaker">Speaker</Label>
                <Input
                  id="pp-speaker"
                  type="text"
                  placeholder="Name of the speaker (if known)"
                  className="h-11 rounded-xl px-4"
                  aria-invalid={errors.speaker ? true : undefined}
                  aria-describedby={errors.speaker ? "pp-speaker-error" : undefined}
                  {...register("speaker")}
                />
                <FieldError id="pp-speaker-error" message={errors.speaker?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pp-attendees">Estimated Number of Attendees</Label>
                <Input
                  id="pp-attendees"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="e.g. 120"
                  className="h-11 rounded-xl px-4"
                  aria-invalid={errors.attendees ? true : undefined}
                  aria-describedby={errors.attendees ? "pp-attendees-error" : undefined}
                  {...register("attendees")}
                />
                <FieldError id="pp-attendees-error" message={errors.attendees?.message} />
              </div>
            </div>
          </div>
        </FormSection>

        {/* ---------------- 3. Facility & Services ---------------- */}
        <FormSection
          step={3}
          title="Facility &amp; Services"
          description="Which areas of the Imambargah you need, and what support the program requires."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">
                Congregation Area(s)
                <RequiredMark />
              </legend>
              <p className="mt-1 text-xs text-muted-foreground">Select all that apply</p>
              <div className="mt-3 space-y-2.5">
                {CONGREGATION_AREA_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    // Media Hall and Library sit inside the Basement on the
                    // original form — keep that relationship visible.
                    className={`${choiceCardClass} ${option.parent ? "ml-5 sm:ml-7" : ""}`}
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      className="mt-0.5 size-4 shrink-0 rounded accent-brand-500"
                      aria-invalid={errors.congregationAreas ? true : undefined}
                      {...register("congregationAreas")}
                    />
                    <span className="font-medium text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2">
                <FieldError
                  id="pp-areas-error"
                  message={errors.congregationAreas?.message}
                />
              </div>
            </fieldset>

            <div className="space-y-8">
              <fieldset>
                <legend className="text-sm font-semibold text-foreground">
                  Taburruk / Food Service
                </legend>
                <p className="mt-1 text-xs text-muted-foreground">Select all that apply</p>
                <div className="mt-3 space-y-2.5">
                  {FOOD_SERVICE_OPTIONS.map((option) => (
                    <label key={option.value} className={choiceCardClass}>
                      <input
                        type="checkbox"
                        value={option.value}
                        className="mt-0.5 size-4 shrink-0 rounded accent-brand-500"
                        {...register("foodService")}
                      />
                      <span className="font-medium text-foreground">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-foreground">
                  Logistical Components
                </legend>
                <p className="mt-1 text-xs text-muted-foreground">Select all that apply</p>
                <div className="mt-3 space-y-2.5">
                  {LOGISTICS_OPTIONS.map((option) => (
                    <label key={option.value} className={choiceCardClass}>
                      <input
                        type="checkbox"
                        value={option.value}
                        className="mt-0.5 size-4 shrink-0 rounded accent-brand-500"
                        {...register("logistics")}
                      />
                      <span className="font-medium text-foreground">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-foreground">Advertisement</legend>
                <div className="mt-3 space-y-2.5">
                  {ADVERTISEMENT_OPTIONS.map((option) => (
                    <label key={option.value} className={choiceCardClass}>
                      <input
                        type="checkbox"
                        value={option.value}
                        className="mt-0.5 size-4 shrink-0 rounded accent-brand-500"
                        {...register("advertisement")}
                      />
                      <span className="font-medium text-foreground">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        </FormSection>

        {/* ---------------- 4. MASOM Guidelines ---------------- */}
        <FormSection
          step={4}
          title="MASOM Guidelines"
          description="Please review before submitting. These apply to every private program held at MASOM."
        >
          <ol className="space-y-4">
            {MASOM_GUIDELINES.map((guideline, index) => (
              <li key={guideline} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="mt-px flex size-6 shrink-0 items-center justify-center rounded-lg bg-sand-100 font-heading text-xs font-bold text-ink-800"
                >
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">{guideline}</p>
              </li>
            ))}
          </ol>
        </FormSection>

        {/* ---------------- 5. Agreement & Applicant ---------------- */}
        <FormSection
          step={5}
          title="Applicant Agreement &amp; Contact Information"
          description="The agreement below is the same one printed on the MASOM paper form."
        >
          <div className="rounded-xl border border-border/70 bg-muted/30 p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{AGREEMENT_TEXT}</p>
          </div>

          <div className="mt-5 space-y-2">
            <label htmlFor="pp-agreement" className={choiceCardClass}>
              <input
                id="pp-agreement"
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded accent-brand-500"
                aria-invalid={errors.agreement ? true : undefined}
                aria-describedby={errors.agreement ? "pp-agreement-error" : undefined}
                {...register("agreement")}
              />
              <span className="font-semibold text-foreground">
                I/we hereby agree to abide by the rules above.
                <RequiredMark />
              </span>
            </label>
            <FieldError id="pp-agreement-error" message={errors.agreement?.message} />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pp-name">
                Name(s)
                <RequiredMark />
              </Label>
              <Input
                id="pp-name"
                type="text"
                autoComplete="name"
                placeholder="Full name of the applicant(s)"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.applicantName ? true : undefined}
                aria-describedby={errors.applicantName ? "pp-name-error" : undefined}
                {...register("applicantName")}
              />
              <FieldError id="pp-name-error" message={errors.applicantName?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pp-signature">
                Electronic Signature
                <RequiredMark />
              </Label>
              <Input
                id="pp-signature"
                type="text"
                autoComplete="off"
                placeholder="Type your full name"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.electronicSignature ? true : undefined}
                aria-describedby="pp-signature-hint"
                {...register("electronicSignature")}
              />
              <p id="pp-signature-hint" className="text-xs text-muted-foreground">
                Type your full name as your electronic signature.
              </p>
              <FieldError id="pp-signature-error" message={errors.electronicSignature?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pp-agreement-date">
                Date
                <RequiredMark />
              </Label>
              <Input
                id="pp-agreement-date"
                type="date"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.agreementDate ? true : undefined}
                aria-describedby={errors.agreementDate ? "pp-agreement-date-error" : undefined}
                {...register("agreementDate")}
              />
              <FieldError id="pp-agreement-date-error" message={errors.agreementDate?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pp-phone">
                Phone
                <RequiredMark />
              </Label>
              <Input
                id="pp-phone"
                type="tel"
                autoComplete="tel"
                placeholder="(312) 555-0190"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? "pp-phone-error" : undefined}
                {...register("phone")}
              />
              <FieldError id="pp-phone-error" message={errors.phone?.message} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pp-email">
                Email
                <RequiredMark />
              </Label>
              <Input
                id="pp-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11 rounded-xl px-4"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "pp-email-error" : undefined}
                {...register("email")}
              />
              <FieldError id="pp-email-error" message={errors.email?.message} />
            </div>
          </div>

          {/* Honeypot — hidden from humans, tempting for bots. Its value is
              read straight off the DOM and sent with the payload so the server
              can silently discard a bot submission. */}
          <div
            className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            <label htmlFor="pp-website" className="sr-only">
              Website
            </label>
            <input
              ref={honeypotRef}
              id="pp-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Security Check — simple server-verified math CAPTCHA. */}
          <div className="mt-6 space-y-2">
            <Label htmlFor="pp-captcha">
              Security Check
              <RequiredMark />
            </Label>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-11 min-w-16 place-items-center rounded-xl border border-border/70 bg-muted/40 px-3 font-heading text-base font-bold tracking-wide text-foreground select-none"
              >
                {captchaQuestion || "…"} =
              </span>
              <Input
                id="pp-captcha"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Your answer"
                value={captchaAnswer}
                onChange={(event) => setCaptchaAnswer(event.target.value.replace(/[^\d]/g, ""))}
                className="h-11 max-w-32 rounded-xl px-4"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="New question"
                title="New question"
                onClick={refreshCaptcha}
                disabled={pending}
              >
                <RefreshCwIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-muted-foreground sm:max-w-md">
              Submitting this application does not confirm or reserve the facility. MASOM will
              review the request and contact you.
            </p>
            <Button
              type="submit"
              variant="cta"
              size="pill"
              disabled={pending}
              className="h-12 w-full rounded-xl px-8 text-sm font-bold sm:w-auto"
            >
              {pending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  Submitting Application…
                </>
              ) : (
                <>
                  Submit Application
                  <SendIcon className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </FormSection>
      </form>

      {/*
        6. For MASOM Office Use Only — rendered OUTSIDE the <form> on purpose.
        These accounting fields exist so the online page mirrors the paper
        document; they are disabled, carry no name attribute, are not part of
        the submitted payload, and have no key in the server schema.
      */}
      <section
        aria-labelledby="pp-office-use-heading"
        className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-6 sm:p-8"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-800"
          >
            <ClipboardListIcon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2
              id="pp-office-use-heading"
              className="font-heading text-xl leading-snug font-bold text-foreground"
            >
              For MASOM Office Use Only
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Received with thanks. These fields are completed internally by the MASOM office
              after the application is reviewed — applicants do not fill them in.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICE_USE_FIELDS.map((field) => (
            <div key={field.label} className="space-y-2">
              <span className="block text-sm font-medium text-muted-foreground">
                {field.label}
              </span>
              <Input
                type="text"
                disabled
                readOnly
                tabIndex={-1}
                value=""
                placeholder={field.placeholder}
                aria-label={`${field.label} — MASOM office use only`}
                className="h-11 rounded-xl px-4"
              />
            </div>
          ))}
        </div>

        <p className="mt-6 flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          The $100 deposit referred to in guideline 10 is arranged directly with the MASOM
          Secretary; no payment is collected on this page.
        </p>
      </section>
    </>
  );
}
