"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/features/auth/guard";
import { logAdminActivity } from "@/lib/cms/activity";
import { logCmsError } from "@/lib/cms/logging";
import type { ActionResult } from "@/lib/cms/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { calendarBasePath, hijriMonthName, supportedCalendarYears } from "./config";
import { createHijriToGregorian } from "./hijri";
import {
  calendarDayFormSchema,
  calendarEventFormSchema,
  hijriMonthFormSchema,
  hijriOverrideFormSchema,
} from "./schema";
import type { HijriMonthRow, HijriOverrideRow } from "./types";

// Every calendar mutation touches the admin module, the public calendar page,
// and the homepage (whose header bar shows today's timings). The tag purge
// invalidates every cached calendar READ — including the ?month=/?year= query
// variants of every supported year that revalidatePath cannot reach.
function revalidateCalendar() {
  revalidateTag("calendar");
  revalidatePath("/admin/calendar");
  revalidatePath(calendarBasePath);
  revalidatePath("/2026");
  for (const year of supportedCalendarYears) {
    revalidatePath(`${calendarBasePath}?year=${year}`);
  }
  revalidatePath("/");
}

function invalid(parsedError: { issues: { message: string }[] }): ActionResult {
  return { status: "error", message: parsedError.issues[0]?.message ?? "Invalid form." };
}

function requireString(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ===========================================================================
// calendar_days — keyed by gregorian_date (the primary key).
// ===========================================================================
function parseDayForm(formData: FormData) {
  return calendarDayFormSchema.safeParse({
    gregorian_date: formData.get("gregorian_date") ?? "",
    imsaak: formData.get("imsaak") ?? "",
    fajr: formData.get("fajr") ?? "",
    sunrise: formData.get("sunrise") ?? "",
    zohar: formData.get("zohar") ?? "",
    sunset: formData.get("sunset") ?? "",
    maghrib: formData.get("maghrib") ?? "",
    midnight: formData.get("midnight") ?? "",
    is_published: formData.get("is_published"),
  });
}

export async function createCalendarDay(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseDayForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("calendar_days").insert(parsed.data);
  if (error) {
    logCmsError("calendar:day:create", error);
    return { status: "error", message: "Could not save the day. A row for that date may already exist." };
  }
  await logAdminActivity("calendar", "created", parsed.data.gregorian_date, `Prayer timings for ${parsed.data.gregorian_date}`);
  revalidateCalendar();
  return { status: "success", message: "Day timings saved." };
}

export async function updateCalendarDay(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseDayForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { gregorian_date, ...fields } = parsed.data;
  const { error } = await supabase
    .from("calendar_days")
    .update(fields)
    .eq("gregorian_date", gregorian_date);
  if (error) {
    logCmsError("calendar:day:update", error);
    return { status: "error", message: "Could not update the day. Please try again." };
  }
  await logAdminActivity("calendar", "updated", gregorian_date, `Prayer timings for ${gregorian_date}`);
  revalidateCalendar();
  return { status: "success", message: "Day timings updated." };
}

export async function deleteCalendarDay(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  // DeleteConfirm submits the identity under the field name "id"; for this
  // table the identity is the date itself.
  const date = requireString(formData, "id");
  if (!date) return { status: "error", message: "Missing date." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("calendar_days").delete().eq("gregorian_date", date);
  if (error) {
    logCmsError("calendar:day:delete", error);
    return { status: "error", message: "Could not delete the day. Please try again." };
  }
  await logAdminActivity("calendar", "deleted", date, `Prayer timings for ${date}`);
  revalidateCalendar();
  return { status: "success", message: "Day deleted." };
}

// ===========================================================================
// hijri_months — keyed by uuid id.
// ===========================================================================
function parseMonthForm(formData: FormData) {
  return hijriMonthFormSchema.safeParse({
    hijri_year: formData.get("hijri_year") ?? "",
    hijri_month: formData.get("hijri_month") ?? "",
    gregorian_start: formData.get("gregorian_start") ?? "",
    is_published: formData.get("is_published"),
  });
}

export async function createHijriMonth(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseMonthForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("hijri_months")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) {
    logCmsError("calendar:month:create", error);
    return { status: "error", message: "Could not save the month boundary. It may duplicate an existing one." };
  }
  await logAdminActivity(
    "calendar",
    "created",
    inserted?.id ?? null,
    `${hijriMonthName(parsed.data.hijri_month)} ${parsed.data.hijri_year} boundary`, 
  );
  revalidateCalendar();
  return { status: "success", message: "Month boundary saved." };
}

export async function updateHijriMonth(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = requireString(formData, "id");
  if (!id) return { status: "error", message: "Missing month id." };
  const parsed = parseMonthForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("hijri_months").update(parsed.data).eq("id", id);
  if (error) {
    logCmsError("calendar:month:update", error);
    return { status: "error", message: "Could not update the month boundary. Please try again." };
  }
  await logAdminActivity(
    "calendar",
    "updated",
    id,
    `${hijriMonthName(parsed.data.hijri_month)} ${parsed.data.hijri_year} boundary`,
  );
  revalidateCalendar();
  return { status: "success", message: "Month boundary updated." };
}

export async function deleteHijriMonth(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = requireString(formData, "id");
  if (!id) return { status: "error", message: "Missing month id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("hijri_months").delete().eq("id", id);
  if (error) {
    logCmsError("calendar:month:delete", error);
    return { status: "error", message: "Could not delete the month boundary. Please try again." };
  }
  await logAdminActivity("calendar", "deleted", id, "Hijri month boundary");
  revalidateCalendar();
  return { status: "success", message: "Month boundary deleted." };
}

// ===========================================================================
// hijri_overrides — keyed by gregorian_date (the primary key).
// ===========================================================================
function parseOverrideForm(formData: FormData) {
  return hijriOverrideFormSchema.safeParse({
    gregorian_date: formData.get("gregorian_date") ?? "",
    hijri_year: formData.get("hijri_year") ?? "",
    hijri_month: formData.get("hijri_month") ?? "",
    hijri_day: formData.get("hijri_day") ?? "",
    note: formData.get("note") ?? "",
    is_published: formData.get("is_published"),
  });
}

export async function createHijriOverride(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseOverrideForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("hijri_overrides").insert(parsed.data);
  if (error) {
    logCmsError("calendar:override:create", error);
    return { status: "error", message: "Could not save the override. One may already exist for that date." };
  }
  await logAdminActivity("calendar", "created", parsed.data.gregorian_date, `Hijri override for ${parsed.data.gregorian_date}`);
  revalidateCalendar();
  return { status: "success", message: "Hijri override saved." };
}

export async function updateHijriOverride(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseOverrideForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { gregorian_date, ...fields } = parsed.data;
  const { error } = await supabase
    .from("hijri_overrides")
    .update(fields)
    .eq("gregorian_date", gregorian_date);
  if (error) {
    logCmsError("calendar:override:update", error);
    return { status: "error", message: "Could not update the override. Please try again." };
  }
  await logAdminActivity("calendar", "updated", gregorian_date, `Hijri override for ${gregorian_date}`);
  revalidateCalendar();
  return { status: "success", message: "Hijri override updated." };
}

export async function deleteHijriOverride(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  // DeleteConfirm submits the identity under "id"; here that is the date.
  const date = requireString(formData, "id");
  if (!date) return { status: "error", message: "Missing date." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("hijri_overrides").delete().eq("gregorian_date", date);
  if (error) {
    logCmsError("calendar:override:delete", error);
    return { status: "error", message: "Could not delete the override. Please try again." };
  }
  await logAdminActivity("calendar", "deleted", date, `Hijri override for ${date}`);
  revalidateCalendar();
  return { status: "success", message: "Hijri override deleted." };
}

// ===========================================================================
// calendar_events — keyed by uuid id, anchored to an authoritative Hijri date.
// ===========================================================================
function parseEventForm(formData: FormData) {
  return calendarEventFormSchema.safeParse({
    hijri_year: formData.get("hijri_year") ?? "",
    hijri_month: formData.get("hijri_month") ?? "",
    hijri_day: formData.get("hijri_day") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? "",
    is_active: formData.get("is_active"),
    sort_order: formData.get("sort_order") ?? "0",
  });
}

/**
 * Derives the current Gregorian date for a Hijri identity from the live month
 * boundaries + overrides. A NULL hijri_year is a recurring event and resolves
 * through the latest published boundary's year. Returns null when no boundary
 * resolves it (e.g. an unpublished month with no earlier boundary), in which
 * case the form should be rejected rather than saving a fabricated date.
 */
async function resolveEventGregorianDate(data: {
  hijri_year: number | null;
  hijri_month: number;
  hijri_day: number;
}): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const [monthsRes, overridesRes] = await Promise.all([
    supabase.from("hijri_months").select("*"),
    supabase.from("hijri_overrides").select("*"),
  ]);
  if (monthsRes.error) {
    logCmsError("calendar:event:resolve:months", monthsRes.error);
    return null;
  }
  if (overridesRes.error) {
    logCmsError("calendar:event:resolve:overrides", overridesRes.error);
    return null;
  }
  const toGregorian = createHijriToGregorian(
    (monthsRes.data as HijriMonthRow[] | null) ?? [],
    (overridesRes.data as HijriOverrideRow[] | null) ?? [],
  );
  return toGregorian({
    year: data.hijri_year,
    month: data.hijri_month,
    day: data.hijri_day,
  });
}

export async function createCalendarEvent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseEventForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const event_date = await resolveEventGregorianDate(parsed.data);
  if (!event_date) {
    return {
      status: "error",
      message:
        "Could not resolve a Gregorian date for this Hijri date. Check that the month's boundary is published.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("calendar_events")
    .insert({ ...parsed.data, event_date })
    .select("id")
    .single();
  if (error) {
    logCmsError("calendar:event:create", error);
    return { status: "error", message: "Could not save the event. Please try again." };
  }
  await logAdminActivity("calendar", "created", inserted?.id ?? null, parsed.data.title);
  revalidateCalendar();
  return { status: "success", message: "Event added." };
}

export async function updateCalendarEvent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = requireString(formData, "id");
  if (!id) return { status: "error", message: "Missing event id." };
  const parsed = parseEventForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const event_date = await resolveEventGregorianDate(parsed.data);
  if (!event_date) {
    return {
      status: "error",
      message:
        "Could not resolve a Gregorian date for this Hijri date. Check that the month's boundary is published.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("calendar_events")
    .update({ ...parsed.data, event_date })
    .eq("id", id);
  if (error) {
    logCmsError("calendar:event:update", error);
    return { status: "error", message: "Could not update the event. Please try again." };
  }
  await logAdminActivity("calendar", "updated", id, parsed.data.title);
  revalidateCalendar();
  return { status: "success", message: "Event updated." };
}

export async function deleteCalendarEvent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = requireString(formData, "id");
  if (!id) return { status: "error", message: "Missing event id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) {
    logCmsError("calendar:event:delete", error);
    return { status: "error", message: "Could not delete the event. Please try again." };
  }
  await logAdminActivity("calendar", "deleted", id, undefined);
  revalidateCalendar();
  return { status: "success", message: "Event deleted." };
}
