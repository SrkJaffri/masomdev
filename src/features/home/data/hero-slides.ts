import type { HeroSlide } from "@/features/home/types";

/**
 * Approved default hero blurb. Used only when CMS data is unavailable (local
 * fallback banners) or no slide is loaded — never forced onto a CMS banner
 * whose description is intentionally empty.
 */
export const DEFAULT_HERO_DESCRIPTION =
  "An Imambargah in Chicago serving the Shia community with majalis, Islamic education, programs and services.";

/**
 * Approved default hero eyebrow + CTA buttons. Used to backfill existing rows
 * in the migration, as fallback-hero values when CMS data is unavailable, and
 * when no slide is loaded. Never forced onto a CMS banner that intentionally
 * hides/empties these elements.
 */
export const HERO_DEFAULTS = {
  eyebrow: "MASOM · Chicago, Illinois",
  primaryCta: { label: "View Programs", href: "/events-schedule" },
  secondaryCta: { label: "Prayer Calendar", href: "/hijricalendar2026" },
} as const;

/**
 * Real MASOM banner assets (formerly served through Revolution Slider), stored
 * locally in /public/hero. Swapping this to a Supabase-backed Banner Manager
 * later only requires replacing this array with fetched data of the same shape.
 */
export const heroSlides: HeroSlide[] = [
  {
    id: "gathering",
    image: { src: "/hero/hero-1.jpg", width: 1024, height: 683 },
    alt: "MASOM Imambargah community gathering",
  },
  {
    id: "majlis",
    image: { src: "/hero/hero-2.jpg", width: 2560, height: 1707 },
    alt: "Majlis at MASOM Imambargah",
  },
  {
    id: "event",
    image: { src: "/hero/hero-3.jpeg", width: 1600, height: 900 },
    alt: "MASOM community event",
  },
  {
    id: "imam-mehdi",
    image: { src: "/hero/hero-4.webp", width: 1024, height: 541 },
    alt: "Imam Mehdi (as) commemorative banner",
  },
];
