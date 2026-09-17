import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { logCmsError } from "./logging";

/** Modules that are tracked in the admin activity log. */
export type ActivityModule =
  | "banner"
  | "program"
  | "announcement"
  | "calendar"
  | "newsletter"
  | "contact";

export type ActivityRecord = {
  id: string;
  module: ActivityModule;
  action: string;
  entity_id: string | null;
  description: string | null;
  created_at: string;
  /** Admin display identity (email), joined for the dashboard card. */
  admin_email: string | null;
};

export type AdminLoginRecord = {
  id: string;
  ip_address: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  region: string | null;
  user_agent_summary: string | null;
  created_at: string;
};

/**
 * Centralized activity logger. Server actions call this after a successful
 * mutation; the record is written through the security-definer RPC
 * `log_admin_activity` (RLS-gated, admin-only, append-only). Logging is
 * best-effort: a failure never fails or rolls back the actual mutation, it is
 * only logged for diagnostics.
 */
export async function logAdminActivity(
  module: ActivityModule,
  action: string,
  entityId?: string | null,
  description?: string | null,
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("log_admin_activity", {
      p_module: module,
      p_action: action,
      p_entity_id: entityId ?? null,
      p_description: description ?? null,
    });
    if (error) throw error;
  } catch (error) {
    logCmsError("activity:log", error);
  }
}

/** Latest activity records for the dashboard card (small limit, newest first).
 * Emails come from the security-definer RPC (auth.users is not otherwise
 * exposed through PostgREST). */
export async function getRecentActivity(limit = 5): Promise<ActivityRecord[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_recent_admin_activity", {
      p_limit: limit,
    });

    if (error) throw error;

    return ((data ?? []) as Array<{
      id: string;
      module: ActivityModule;
      action: string;
      entity_id: string | null;
      description: string | null;
      created_at: string;
      admin_email: string | null;
    }>).map((row) => ({
      id: row.id,
      module: row.module,
      action: row.action,
      entity_id: row.entity_id,
      description: row.description,
      created_at: row.created_at,
      admin_email: row.admin_email,
    }));
  } catch (error) {
    // Table may not exist yet (migration not applied) — degrade to empty.
    logCmsError("activity:recent", error);
    return [];
  }
}

/** The current admin's most recent login record, if one exists. */
export async function getLatestLogin(userId: string): Promise<AdminLoginRecord | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("admin_logins")
      .select("id, ip_address, country_code, country_name, city, region, user_agent_summary, created_at")
      .eq("admin_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as AdminLoginRecord | null) ?? null;
  } catch (error) {
    logCmsError("activity:login", error);
    return null;
  }
}
