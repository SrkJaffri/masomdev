"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/guard";
import { logAdminActivity } from "@/lib/cms/activity";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/cms/validation";

import { CONTACT_STATUSES, type ContactStatus } from "./types";

/**
 * Admin contact-message mutations. Status changes only — submissions are
 * never deleted (archive is a status; history is preserved). Each call is
 * fully guarded by requireAdmin() plus the admin RLS update policy.
 *
 * Timestamp semantics:
 * - marking Read      → sets read_at (once)
 * - marking Replied   → sets replied_at (and read_at if not already)
 * - archiving         → sets archived_at
 * - marking New       → clears all three timestamps (back to inbox)
 */
export async function setContactSubmissionStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = formData.get("id");
  const nextStatusRaw = formData.get("status");

  if (typeof id !== "string" || id.length === 0) {
    return { status: "error", message: "Missing message id." };
  }
  if (
    typeof nextStatusRaw !== "string" ||
    !CONTACT_STATUSES.includes(nextStatusRaw as ContactStatus)
  ) {
    return { status: "error", message: "Invalid status value." };
  }
  const nextStatus = nextStatusRaw as ContactStatus;

  const supabase = await createSupabaseServerClient();

  // Read the current record first (also tells us whether anything changed).
  const { data: existing, error: selectError } = await supabase
    .from("contact_submissions")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();

  if (selectError || !existing) {
    logCmsError("contact:setStatus:lookup", selectError ?? new Error("Message not found."));
    return { status: "error", message: "Could not update the message. Please try again." };
  }

  if (existing.status === nextStatus) {
    return { status: "success", message: "Message is already in that state." };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "read") update.read_at = now;
  if (nextStatus === "replied") {
    update.replied_at = now;
    // A replied message has obviously been read; keep read_at meaningful.
    update.read_at = existing.status === "new" ? now : undefined;
  }
  if (nextStatus === "archived") update.archived_at = now;
  if (nextStatus === "new") {
    update.read_at = null;
    update.replied_at = null;
    update.archived_at = null;
  }
  // Drop undefined keys (Supabase would serialize them as null otherwise).
  for (const key of Object.keys(update)) {
    if (update[key] === undefined) delete update[key];
  }

  const { error: updateError } = await supabase
    .from("contact_submissions")
    .update(update)
    .eq("id", id);

  if (updateError) {
    logCmsError("contact:setStatus", updateError);
    return { status: "error", message: "Could not update the message. Please try again." };
  }

  const actionLabel =
    nextStatus === "new"
      ? "marked new"
      : nextStatus === "read"
        ? "marked read"
        : nextStatus === "replied"
          ? "marked replied"
          : "archived";
  // Description names the visitor, never the message content.
  await logAdminActivity("contact", actionLabel, id, `Message from ${existing.name}`);

  revalidatePath("/admin/contact-messages");
  revalidatePath("/admin");
  return {
    status: "success",
    message:
      nextStatus === "new"
        ? "Message moved back to New."
        : nextStatus === "read"
          ? "Message marked as read."
          : nextStatus === "replied"
            ? "Message marked as replied."
            : "Message archived.",
  };
}
