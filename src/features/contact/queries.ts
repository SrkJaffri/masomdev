import "server-only";

import { cache } from "react";

import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ContactStatus, ContactSubmission } from "./types";

/**
 * Admin contact-message reads. Every function here goes through the
 * session-aware server client, so the admin RLS policy (public.is_admin())
 * enforces access — and `requireAdmin()` guards every caller page/action on
 * top (see admin-actions.ts).
 */

const LIST_COLUMNS =
  "id,name,email,message,consent,status,source,submitted_at,read_at,replied_at,archived_at,created_at,updated_at";

/** Admin: every submission, newest first. ip_hash/user_agent never leave. */
export async function getContactSubmissions(): Promise<ContactSubmission[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contact_submissions")
    .select(LIST_COLUMNS)
    .order("submitted_at", { ascending: false });

  if (error) {
    logCmsError("contact:getAll", error);
    return [];
  }
  return (data as ContactSubmission[] | null) ?? [];
}

/**
 * Lean count of unread ('new') messages for the sidebar badge. Wrapped in
 * React cache() so the admin layout and any other caller share ONE fetch per
 * request.
 */
export const getNewContactSubmissionCount = cache(async (): Promise<number> => {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error) {
    logCmsError("contact:newCount", error);
    return 0;
  }
  return count ?? 0;
});

/** Type-safe status list shared by the admin filters. */
export function isContactStatus(value: unknown): value is ContactStatus {
  return (
    value === "new" || value === "read" || value === "replied" || value === "archived"
  );
}
