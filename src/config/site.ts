import { getSiteUrl } from "@/config/env";

export const siteConfig = {
  name: "MASOM",
  legalName: "Midwest Association of Shia Organized Muslims",
  title: "MASOM – Midwest Association of Shia Organized Muslims: Official Website",
  locale: "en-US",
  ogLocale: "en_US",
  url: getSiteUrl(),
  legacyOrigin: "https://masom.com",
  contact: {
    phone: "(773) 283-9718",
    phoneHref: "tel:+17732839718",
    email: "secretary@masom.com",
    address: {
      street: "4353 West Lawrence Avenue",
      city: "Chicago",
      region: "IL",
      postalCode: "60630",
      country: "US",
      full: "4353 West Lawrence Avenue, Chicago, IL 60630",
      lines: ["4353 West Lawrence Avenue", "Chicago, IL 60630"],
      mapUrl:
        "https://www.google.com/maps/place/4353+W+Lawrence+Ave,+Chicago,+IL+60630,+USA/@41.967852,-87.739688,17z/data=!4m5!3m4!1s0x880fcc2d48ef0251:0xf12ee185a1fe53f8!8m2!3d41.967852!4d-87.7374993?hl=en",
      /** Public Google Maps link used for the "Get Directions" / "Open in
       * Google Maps" calls to action. */
      mapsLink: "https://maps.app.goo.gl/cgDdRUN1wkEiXba59",
      /** Keyless Google Maps embed (output=embed) centred on the Imambargah. */
      mapEmbedUrl:
        "https://www.google.com/maps?q=41.9678899,-87.7374608&hl=en&z=16&output=embed",
    },
  },
  assets: {
    logoDark: { src: "/brand/headlogon4.webp", width: 910, height: 270 },
    logoLight: { src: "/brand/logomobilefoot.webp", width: 500, height: 132 },
    logoCompact: { src: "/brand/logomobilefoot-300x79.png", width: 300, height: 79 },
    qrCode: { src: "/brand/qr-code-masom.webp", width: 500, height: 500 },
    /** Dedicated social preview image (1200x670), built from the official
     * MASOM logo on the brand dark background. Relative path — Next resolves
     * it against metadataBase so production URLs use the deployed domain.
     * Distinct filename from the original /og-image.png so Facebook/WhatsApp
     * caches pick up the new artwork immediately. */
    ogImage: "/og-image-masom.png",
    /** Favicon + Apple touch icon (re-encoded from the official artwork). */
    favicon: "/favicon.png",
    appleTouchIcon: "/apple-touch-icon.png",
  },
  social: {
    facebook: "https://www.facebook.com/share/18Bg8qJvu9/?mibextid=wwXIfr",
    instagram:
      "https://www.instagram.com/imambargahmasom?igsh=d21ycWQxYzFuN3Zn&utm_source=qr",
    youtube: "https://www.youtube.com/channel/UCLE_Z6NZIg05Zzz1tn209sg",
    whatsapp: "https://chat.whatsapp.com/LbReeM8ts7VJoC7yMOPqSI",
  },
  /**
   * Approved donation payment data — the single source of truth shared by the
   * Donate page, the AI donation tool and the chat UI. The Zelle QR is the
   * client-supplied APPROVED payment QR (/donations/zelle-masom-qr.jpeg); it
   * is deliberately a different asset from assets.qrCode, which stays the
   * WEBSITE QR used in the footer.
   */
  donation: {
    zelleEmail: "donate@masom.com",
    zelleQr: { src: "/donations/zelle-masom-qr.jpeg", width: 556, height: 677 },
    zelleQrAlt: "MASOM Zelle payment QR code",
    mailingAddress: "MASOM, 4353 W Lawrence Ave, Chicago, IL, 60630",
  },
  links: {
    donate: "/donate",
    constitution: "https://masom.com/org/masomByLaws.pdf",
    newsletterArchive:
      "https://us13.campaign-archive.com/home/?u=01dfc250f2762204df48c0230&id=06a230bfd1",
  },
  copyright: {
    holder: "MASOM Imambargah",
    notice: "All rights reserved.",
  },
} as const;

export type SiteConfig = typeof siteConfig;
