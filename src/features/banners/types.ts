export type BannerImageSource = "storage" | "external";

export type BannerRow = {
  id: string;
  title: string | null;
  /** Visible hero description (display copy) — separate from image_alt. */
  description: string | null;
  /** Small text shown above the hero heading; null = intentionally hidden. */
  eyebrow: string | null;
  /** Per-banner primary/secondary CTA buttons (null label/url = not configured). */
  primary_cta_label: string | null;
  primary_cta_url: string | null;
  show_primary_cta: boolean;
  secondary_cta_label: string | null;
  secondary_cta_url: string | null;
  show_secondary_cta: boolean;
  /** Storage object path — only for image_source === "storage" (nullable). */
  image_path: string | null;
  image_source: BannerImageSource;
  /** Approved external https URL — only for image_source === "external". */
  external_url: string | null;
  image_alt: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  /** Whether the hero slider renders the heading for this banner. Default ON. */
  show_title: boolean;
  created_at: string;
  updated_at: string;
};

/** Admin list row with a resolved preview URL for the thumbnail. */
export type BannerAdminItem = BannerRow & { previewUrl: string | null };

/** A hero CTA button resolved for rendering; null when hidden or incomplete. */
export type HeroBannerCta = { label: string; href: string };

/** Public display model consumed by the hero slider. */
export type HeroBanner = {
  id: string;
  src: string;
  alt: string;
  /** Optional CMS-provided title; the slider uses it as the hero headline. */
  title: string | null;
  /** Whether the slider renders the heading for this banner. Default ON. */
  showTitle: boolean;
  /** Visible hero description for this banner; null renders no paragraph. */
  description: string | null;
  /** Eyebrow line above the heading; null renders no eyebrow. */
  eyebrow: string | null;
  /** Resolved CTA buttons; null when hidden or missing label/URL. */
  primaryCta: HeroBannerCta | null;
  secondaryCta: HeroBannerCta | null;
  href: string | null;
  /**
   * True when src is an external https URL. External images are rendered with
   * a plain responsive <img> (arbitrary validated hosts), while storage/local
   * images keep using next/image optimization.
   */
  external: boolean;
};
