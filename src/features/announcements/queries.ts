import "server-only";

import { cache } from "react";

import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseFreshPublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AnnouncementAdminItem, AnnouncementRow, AnnouncementView } from "./types";

/** Within its scheduling window right now? (Defense-in-depth over the RLS policy.) */
function isLive(row: Pick<AnnouncementRow, "starts_at" | "expires_at">): boolean {
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return false;
  return true;
}

function toView(row: AnnouncementRow): AnnouncementView {
  const href = row.link_url;
  return {
    id: row.id,
    message: row.message,
    href,
    linkLabel: href ? (row.link_label ?? "Learn more") : null,
  };
}

/**
 * Public announcements for the ticker — UNCACHED. Reads bypass Next's Data
 * Cache (cache: "no-store"), so hiding/showing/editing an announcement in the
 * CMS is reflected on the very next homepage request. Returns only active,
 * in-window rows. There is intentionally NO local fallback — the ticker is a
 * new feature, so an empty result simply hides it on the homepage (a
 * successful empty query is a valid CMS state, not an error).
 */
export async function getActiveAnnouncements(): Promise<AnnouncementView[]> {
  try {
    const supabase = createSupabaseFreshPublicClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return ((data as AnnouncementRow[] | null) ?? []).filter(isLive).map(toView);
  } catch (error) {
    logCmsError("announcements:getActive", error);
    return [];
  }
}

/** Admin: every announcement, ordered for the manager table. */
export async function getAllAnnouncements(): Promise<AnnouncementAdminItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    logCmsError("announcements:getAll", error);
    return [];
  }
  return (data as AnnouncementRow[] | null) ?? [];
}

/**
 * Lightweight admin counts (total + active) for the dashboard stat cards.
 * Selects only the flags — no full-row payloads.
 */
/**
 * Lightweight admin counts (total + active) for the dashboard stat cards and
 * the sidebar badges. Wrapped in React cache() so the admin layout and the
 * dashboard page share ONE fetch per request instead of duplicating it.
 */
export const getAnnouncementCounts = cache(async (): Promise<{
  total: number;
  active: number;
}> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("is_active");

  if (error) {
    logCmsError("announcements:counts", error);
    return { total: 0, active: 0 };
  }
  const rows = (data ?? []) as Array<{ is_active: boolean }>;
  return {
    total: rows.length,
    active: rows.filter((row) => row.is_active).length,
  };
});

export async function getAnnouncementById(id: string): Promise<AnnouncementRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logCmsError("announcements:getById", error);
    return null;
  }
  return (data as AnnouncementRow | null) ?? null;
}
