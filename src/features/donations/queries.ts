import "server-only";

import { cache } from "react";

import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DonationIntent } from "./types";

/**
 * Admin donation-intent reads.
 *
 * Every read goes through the session-aware server client, so the admin-only
 * RLS policy (public.is_admin()) is what actually grants access — the public
 * anon role has NO select policy on this table at all. requireAdmin() guards
 * the calling page on top of that.
 */

// ip_hash, user_agent and idempotency_key are never selected: the admin UI has
// no use for them, so they never leave the database.
const LIST_COLUMNS =
  "id,name,email,phone,amount,donation_type,note,source,status,submitted_at,reviewed_at,archived_at,created_at,updated_at";

/** Admin: every registered intent, newest first. */
export async function getDonationIntents(): Promise<DonationIntent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("donation_intents")
    .select(LIST_COLUMNS)
    .order("submitted_at", { ascending: false });

  if (error) {
    logCmsError("donationIntents:getAll", error);
    return [];
  }
  return (data as DonationIntent[] | null) ?? [];
}

/**
 * Lean count of intents still needing attention (registered / awaiting
 * payment) for the sidebar badge. React-cached so the layout and any other
 * caller share ONE fetch per request.
 */
export const getOpenDonationIntentCount = cache(async (): Promise<number> => {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("donation_intents")
    .select("id", { count: "exact", head: true })
    .in("status", ["registered", "awaiting_payment"]);

  if (error) {
    logCmsError("donationIntents:openCount", error);
    return 0;
  }
  return count ?? 0;
});
