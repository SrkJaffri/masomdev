import "server-only";

import { cache } from "react";

import {
  DEFAULT_HERO_DESCRIPTION,
  HERO_DEFAULTS,
  heroSlides,
} from "@/features/home/data/hero-slides";
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

/**
 * Resolve one CTA for rendering. Hidden or incomplete (missing label/url)
 * buttons resolve to null — an incomplete button is never rendered as a
 * malformed empty link.
 */
function resolveCta(
  show: boolean,
  label: string | null | undefined,
  href: string | null | undefined,
): HeroBanner["primaryCta"] {
  const trimmedLabel = label?.trim();
  const trimmedHref = href?.trim();
  if (!show || !trimmedLabel || !trimmedHref) return null;
  return { label: trimmedLabel, href: trimmedHref };
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
    | "show_title"
    | "description"
    | "eyebrow"
    | "primary_cta_label"
    | "primary_cta_url"
    | "show_primary_cta"
    | "secondary_cta_label"
    | "secondary_cta_url"
    | "show_secondary_cta"
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
    // Defensive default ON: a DB that has not yet received the show_title
    // migration keeps the exact current hero appearance.
    showTitle: row.show_title !== false,
    // Null renders nothing — an intentionally empty value never falls back
    // to generic copy.
    description: row.description ?? null,
    eyebrow: row.eyebrow ?? null,
    // Defensive default ON for the same migration-lag reason as showTitle.
    primaryCta: resolveCta(
      row.show_primary_cta !== false,
      row.primary_cta_label,
      row.primary_cta_url,
    ),
    secondaryCta: resolveCta(
      row.show_secondary_cta !== false,
      row.secondary_cta_label,
      row.secondary_cta_url,
    ),
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
    showTitle: true,
    // CMS unavailable → the approved default hero content keeps it stable.
    description: DEFAULT_HERO_DESCRIPTION,
    eyebrow: HERO_DEFAULTS.eyebrow,
    primaryCta: { ...HERO_DEFAULTS.primaryCta },
    secondaryCta: { ...HERO_DEFAULTS.secondaryCta },
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
      .select(
        "id, image_source, image_path, external_url, image_alt, title, show_title, description, eyebrow, primary_cta_label, primary_cta_url, show_primary_cta, secondary_cta_label, secondary_cta_url, show_secondary_cta, link_url",
      )
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
