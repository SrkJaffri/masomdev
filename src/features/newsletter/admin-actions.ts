"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/guard";
import { logAdminActivity } from "@/lib/cms/activity";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/cms/validation";

/**
 * Admin newsletter mutations. Both are status changes only — subscriber rows
 * are never deleted (history is preserved). Each call is fully guarded by
 * requireAdmin() plus the admin RLS update policy in the database.
 */
export async function setSubscriberStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = formData.get("id");
  const nextStatus = formData.get("status");

  if (typeof id !== "string" || id.length === 0) {
    return { status: "error", message: "Missing subscriber id." };
  }
  if (nextStatus !== "subscribed" && nextStatus !== "unsubscribed") {
    return { status: "error", message: "Invalid status value." };
  }

  const supabase = await createSupabaseServerClient();

  // Read the current record first (also tells us whether anything changed).
  const { data: existing, error: selectError } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status")
    .eq("id", id)
    .maybeSingle();

  if (selectError || !existing) {
    logCmsError("newsletter:setStatus:lookup", selectError ?? new Error("Subscriber not found."));
    return { status: "error", message: "Could not update the subscriber. Please try again." };
  }

  if (existing.status === nextStatus) {
    return { status: "success", message: "Subscriber is already in that state." };
  }

  const { error: updateError } = await supabase
    .from("newsletter_subscribers")
    .update({
      status: nextStatus,
      unsubscribed_at: nextStatus === "unsubscribed" ? new Date().toISOString() : null,
      // Re-subscribing via the admin re-affirms consent the same way the
      // public form does; unsubscribing keeps the historical consent flag.
      ...(nextStatus === "subscribed" ? { consent: true, subscribed_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);

  if (updateError) {
    logCmsError("newsletter:setStatus", updateError);
    return { status: "error", message: "Could not update the subscriber. Please try again." };
  }

  await logAdminActivity(
    "newsletter",
    nextStatus === "subscribed" ? "resubscribed" : "unsubscribed",
    id,
    existing.email,
  );

  revalidatePath("/admin/newsletter");
  revalidatePath("/admin");
  return {
    status: "success",
    message:
      nextStatus === "unsubscribed"
        ? "Subscriber marked as unsubscribed."
        : "Subscriber re-activated.",
  };
}
