"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/guard";
import { logAdminActivity } from "@/lib/cms/activity";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/cms/validation";

import { DONATION_INTENT_STATUSES, type DonationIntentStatus } from "./types";

/**
 * Admin donation-intent mutations. STATUS ONLY — intents are never deleted,
 * and there is deliberately no action that marks anything as paid: this
 * application processes no payments, so it cannot truthfully confirm one.
 *
 * Timestamp semantics:
 * - reviewed          → sets reviewed_at (once)
 * - archived          → sets archived_at
 * - registered        → clears both (back to the open list)
 * - awaiting_payment  → leaves timestamps alone (still open)
 */
export async function setDonationIntentStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = formData.get("id");
  const nextStatusRaw = formData.get("status");

  if (typeof id !== "string" || id.length === 0) {
    return { status: "error", message: "Missing donation id." };
  }
  if (
    typeof nextStatusRaw !== "string" ||
    !DONATION_INTENT_STATUSES.includes(nextStatusRaw as DonationIntentStatus)
  ) {
    return { status: "error", message: "Invalid status value." };
  }
  const nextStatus = nextStatusRaw as DonationIntentStatus;

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: selectError } = await supabase
    .from("donation_intents")
    .select("id, name, status, reviewed_at")
    .eq("id", id)
    .maybeSingle();

  if (selectError || !existing) {
    logCmsError(
      "donationIntents:setStatus:lookup",
      selectError ?? new Error("Donation intent not found."),
    );
    return { status: "error", message: "Could not update the entry. Please try again." };
  }

  if (existing.status === nextStatus) {
    return { status: "success", message: "Entry is already in that state." };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "reviewed" && !existing.reviewed_at) update.reviewed_at = now;
  if (nextStatus === "archived") update.archived_at = now;
  if (nextStatus === "registered") {
    update.reviewed_at = null;
    update.archived_at = null;
  }

  const { error: updateError } = await supabase
    .from("donation_intents")
    .update(update)
    .eq("id", id);

  if (updateError) {
    logCmsError("donationIntents:setStatus", updateError);
    return { status: "error", message: "Could not update the entry. Please try again." };
  }

  // Description names the donor, never the amount or the note.
  await logAdminActivity("donation", `marked ${nextStatus}`, id, `Intent from ${existing.name}`);

  revalidatePath("/admin/donation-intents");
  revalidatePath("/admin");
  return { status: "success", message: "Donation entry updated." };
}
