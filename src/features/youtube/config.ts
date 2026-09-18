import "server-only";

/**
 * Official MASOM Islamic Center YouTube channel. This is the source of truth
 * for the homepage "Live & Recent Streams" section — never use another channel
 * and never resolve by display name.
 */
export const YOUTUBE_CHANNEL_ID = "UCLE_Z6NZIg05Zzz1tn209sg";

/** Official YouTube channel streams URL, used for the fallback CTA. */
export const YOUTUBE_CHANNEL_STREAMS_URL =
  "https://www.youtube.com/@MASOMIslamicCenter/streams";

/**
 * LIVE-STATUS freshness — the shared server-side cache window for live
 * detection. Every visitor reads from this one cache, so homepage traffic
 * never scales YouTube API usage; the API is refreshed roughly once per
 * window, which keeps end-to-end live discovery at about 60 seconds.
 */
export const YOUTUBE_LIVE_REVALIDATE_SECONDS = 60;

/**
 * RECENT-VIDEOS freshness — shared cache window for the uploads snapshot and
 * the "Previous Live Streams" grid. Recent content does not need 60-second
 * freshness; 15 minutes keeps the quota cost negligible.
 */
export const YOUTUBE_RECENT_REVALIDATE_SECONDS = 900;

/**
 * How many of the newest uploads are batched into the single live-status
 * videos.list call. A broadcast that just went live is the newest upload, so
 * a small window is sufficient.
 */
export const YOUTUBE_LIVE_CANDIDATE_COUNT = 6;

/**
 * Carousel target: uploads pages are walked until this many broadcasts have
 * been collected (or after YOUTUBE_MAX_UPLOADS_PAGES pages).
 */
export const YOUTUBE_MAX_RESULTS = 10;

/** Uploads playlist pages walked per recent-videos refresh (50 items each). */
export const YOUTUBE_MAX_UPLOADS_PAGES = 2;

/** Timeout for a single outbound YouTube Data API request. */
export const YOUTUBE_REQUEST_TIMEOUT_MS = 8_000;

/**
 * Circuit-breaker window: after one failed API call all YouTube calls are
 * suppressed for this long so error storms (quota exhaustion, rate limits,
 * Google 5xx) cannot be amplified by visitor traffic.
 */
export const YOUTUBE_RETRY_DEFERRAL_MS = 60_000;

/**
 * How long the last-known-good homepage snapshot may be served while YouTube
 * is unreachable, before the section degrades to its static fallback UI.
 */
export const YOUTUBE_LAST_KNOWN_GOOD_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Reads the server-only YouTube Data API key. Refuses to run in the browser so
 * the key can never leak into client bundles or rendered HTML.
 */
export function getYouTubeApiKey(): string | null {
  if (typeof window !== "undefined") {
    throw new Error("YOUTUBE_API_KEY must never be read in the browser.");
  }

  const value = process.env.YOUTUBE_API_KEY?.trim();
  return value ? value : null;
}
