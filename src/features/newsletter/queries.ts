import "server-only";

import { cache } from "react";

import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { NewsletterSubscriber } from "./types";

/**
 * Admin newsletter reads. Every function here goes through the session-aware
 * server client, so the admin RLS policy (public.is_admin()) enforces access —
 * and `requireAdmin()` guards every caller page/action on top (see actions.ts).
 */

/** Admin: every subscriber, newest subscription first. */
export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("*")
    .order("subscribed_at", { ascending: false });

  if (error) {
    logCmsError("newsletter:getAll", error);
    return [];
  }
  return (data as NewsletterSubscriber[] | null) ?? [];
}

/**
 * Lightweight counts (total + active) for the sidebar badge. Wrapped in React
 * cache() so the admin layout and any other caller share ONE fetch per request.
 */
export const getNewsletterCounts = cache(
  async (): Promise<{ total: number; subscribed: number }> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("status");

    if (error) {
      logCmsError("newsletter:counts", error);
      return { total: 0, subscribed: 0 };
    }
    const rows = (data ?? []) as Array<{ status: string }>;
    return {
      total: rows.length,
      subscribed: rows.filter((row) => row.status === "subscribed").length,
    };
  },
);
