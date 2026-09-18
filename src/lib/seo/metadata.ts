import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

type CreateMetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
};

export function createMetadata({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
}: CreateMetadataInput = {}): Metadata {
  // A real <title> on every page. Next.js merges page metadata with the root
  // layout SHALLOWLY, so returning title: undefined here would erase the
  // root title.default — which is exactly how the homepage once rendered
  // with no <title> tag at all.
  const pageTitle = title ?? siteConfig.title;
  const socialTitle = pageTitle;

  // Every page gets the dedicated MASOM social preview image by default so
  // WhatsApp/Facebook/Twitter always have a real branded preview, regardless of
  // how the page-level openGraph object merges with the root layout.
  const ogImage = image ?? siteConfig.assets.ogImage;

  return {
    // Caller-supplied titles flow through the root "%s | MASOM" template;
    // the site default is already fully branded, so it bypasses the template
    // via `absolute` (otherwise the homepage would render "... | MASOM | MASOM").
    title: title ? pageTitle : { absolute: siteConfig.title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: siteConfig.name,
      locale: siteConfig.ogLocale,
      title: socialTitle,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "MASOM — Midwest Association of Shia Organized Muslims",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [ogImage],
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
