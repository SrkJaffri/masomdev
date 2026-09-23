import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: [".monkeycode-ai.live"],
  // Server Actions carry the Program poster upload. Next.js's default 1 MB
  // action body limit rejects anything larger with "Body exceeded 1 MB limit"
  // BEFORE our 5 MB validation runs, so the form showed the wrong limit (and
  // the raw framework message reached the generic boundary). 8 MB leaves
  // headroom above the true 5 MB file validation without unbounded bodies.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "masom.com" },
      { protocol: "https", hostname: "www.masom.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      // YouTube video thumbnails for the homepage Live & Recent Streams section.
      { protocol: "https", hostname: "i.ytimg.com" },
      // Pexels background photo for the homepage newsletter section.
      { protocol: "https", hostname: "images.pexels.com" },
      // NOTE: external banner images (arbitrary https hosts) are intentionally
      // NOT added here — they render via a plain responsive <img> in the hero
      // slider, so no per-domain remotePatterns entry is needed.
    ],
  },
};

export default nextConfig;
