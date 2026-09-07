import "server-only";

import { cache } from "react";

import { heroSlides } from "@/features/home/data/hero-slides";
import { logCmsError } from "@/lib/cms/logging";
import { CMS_BUCKETS, resolveImageSrc } from "@/lib/media/storage";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { BannerAdminItem, BannerRow, HeroBanner } from "./types";

const BUCKET = CMS_BUCKETS.banners;

/**
 * Effective image src for a banner row. Storage rows resolve through the
 * bucket; external rows return the approved URL as-is. Defensive defaults
 * (missing image_source column -> "storage") keep this working against a
 * database that has not yet received the external-source migration.
 */
function bannerSrc(
  row: Pick<BannerRow, "image_source" | "image_path" | "external_url">,
): string | null {
  const source = row.image_source ?? "storage";
  if (source === "external") {
    return row.external_url || null;
  }
  return resolveImageSrc(BUCKET, row.image_path);
}

function toHeroBanner(
  row: Pick<
    BannerRow,
    | "id"
    | "image_source"
    | "image_path"
    | "external_url"
    | "image_alt"
    | "title"
    | "link_url"
  >,
): HeroBanner | null {
  const src = bannerSrc(row);
  if (!src) return null;
  const source = row.image_source ?? "storage";
  return {
    id: row.id,
    src,
    alt: row.image_alt ?? "",
    title: row.title ?? null,
    href: row.link_url,
    external: source === "external",
  };
}

/** Real Phase 3 banners, used until the CMS holds active rows. */
function fallbackBanners(): HeroBanner[] {
  return heroSlides.map((slide) => ({
    id: slide.id,
    src: slide.image.src,
    alt: slide.alt,
    title: null,
    href: null,
    external: false,
  }));
}

/**
 * Public hero banners. Uses active CMS rows when present; otherwise falls back
 * to the local reference banners so the homepage is never broken/empty before
 * the owner has published any content.
 */
export async function getActiveBanners(): Promise<HeroBanner[]> {
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("banners")
      .select("id, image_source, image_path, external_url, image_alt, title, link_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      const banners = data
        .map(toHeroBanner)
        .filter((banner): banner is HeroBanner => banner !== null);
      if (banners.length > 0) return banners;
    }
  } catch (error) {
    logCmsError("banners:getActive", error);
  }

  return fallbackBanners();
}

/** Admin: every banner, ordered for the manager table, with preview URLs. */
export async function getAllBanners(): Promise<BannerAdminItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logCmsError("banners:getAll", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const banner = {
      ...(row as BannerRow),
      image_source: ((row as BannerRow).image_source ?? "storage") as BannerRow["image_source"],
    };
    return { ...banner, previewUrl: bannerSrc(banner) };
  });
}

/**
 * Lightweight admin counts (total + active) for the dashboard stat cards.
 * Selects only the flags — no full-table payloads, no image resolution.
 */
/**
 * Lightweight admin counts (total + active) for the dashboard stat cards and
 * the sidebar badges. Wrapped in React cache() so the admin layout and the
 * dashboard page share ONE fetch per request instead of duplicating it.
 */
export const getBannerCounts = cache(async (): Promise<{
  total: number;
  active: number;
}> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("banners")
    .select("is_active");

  if (error) {
    logCmsError("banners:counts", error);
    return { total: 0, active: 0 };
  }
  const rows = (data ?? []) as Array<{ is_active: boolean }>;
  return {
    total: rows.length,
    active: rows.filter((row) => row.is_active).length,
  };
});

export async function getBannerById(id: string): Promise<BannerRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logCmsError("banners:getById", error);
    return null;
  }
  return (data as BannerRow | null) ?? null;
}
