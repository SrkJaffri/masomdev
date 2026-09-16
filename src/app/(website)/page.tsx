import { getActiveAnnouncements } from "@/features/announcements/queries";
import { getActiveBanners } from "@/features/banners/queries";
import { AnnouncementCta } from "@/features/home/components/announcement-cta";
import { FeatureGrid } from "@/features/home/components/feature-grid";
import { HeroSlider } from "@/features/home/components/hero-slider";
import { LocationMap } from "@/features/home/components/location-map";
import { NewsTicker } from "@/features/home/components/news-ticker";
import { Newsletter } from "@/features/home/components/newsletter";
import { StayInTouch } from "@/features/home/components/stay-in-touch";
import { UpcomingPrograms } from "@/features/home/components/upcoming-programs";
import { getUpcomingPrograms } from "@/features/programs/queries";
import { getYouTubeStreams } from "@/features/youtube/queries";
import { LiveStreamsSection } from "@/features/youtube/components/live-streams-section";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata = createMetadata({
  description:
    "Midwest Association of Shia Organized Muslims (MASOM) — an Imambargah in Chicago serving the community with majalis, programs, an Islamic school, funeral services and Wadi-e-MASOM.",
  path: "/",
});

// CMS freshness: banners and announcements must reflect admin changes on the
// very next request. This renders the homepage on demand instead of serving
// the build-time static snapshot; the banner/announcement reads themselves
// additionally bypass the fetch Data Cache (cache: "no-store"). Programs,
// prayer timings and YouTube keep their tagged/cached fetches, so the extra
// per-request cost stays at two small Postgres reads.

export const revalidate = 0;

export default async function HomePage() {
  // Fetch CMS content server-side (SEO-friendly). Each query falls back to the
  // built-in reference data when the CMS is unavailable/empty, except the news
  // ticker which simply hides itself when there is nothing to show.
  const [banners, programs, announcements, streams] = await Promise.all([
    getActiveBanners(),
    getUpcomingPrograms(),
    getActiveAnnouncements(),
    getYouTubeStreams(),
  ]);

  return (
    <>
      <NewsTicker announcements={announcements} />
      <HeroSlider slides={banners} />
      <AnnouncementCta />
      <FeatureGrid />
      <UpcomingPrograms programs={programs} />
      <LiveStreamsSection streams={streams} />
      <StayInTouch />
      <Newsletter />
      <LocationMap />
    </>
  );
}
