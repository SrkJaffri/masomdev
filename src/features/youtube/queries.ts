import "server-only";

import { logCmsError } from "@/lib/cms/logging";

import {
  YOUTUBE_CHANNEL_ID,
  YOUTUBE_LIVE_CANDIDATE_COUNT,
  YOUTUBE_LIVE_REVALIDATE_SECONDS,
  YOUTUBE_LAST_KNOWN_GOOD_TTL_MS,
  YOUTUBE_MAX_RESULTS,
  YOUTUBE_MAX_UPLOADS_PAGES,
  YOUTUBE_RECENT_REVALIDATE_SECONDS,
  YOUTUBE_REQUEST_TIMEOUT_MS,
  YOUTUBE_RETRY_DEFERRAL_MS,
  getYouTubeApiKey,
} from "./config";
import type { YouTubeLiveStatus, YouTubeStream, YouTubeStreamsResult } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/** Uploads playlist page size (the API maximum is 50). */
const PLAYLIST_PAGE_SIZE = 50;

/** Live-status refresh window in ms (shared server-side freshness). */
const LIVE_WINDOW_MS = YOUTUBE_LIVE_REVALIDATE_SECONDS * 1000;

/** Recent-videos refresh window in ms (shared server-side freshness). */
const RECENT_WINDOW_MS = YOUTUBE_RECENT_REVALIDATE_SECONDS * 1000;

type YouTubePlaylistItem = {
  snippet?: {
    publishedAt?: string;
    title?: string;
    resourceId?: { videoId?: string };
    thumbnails?: YouTubeThumbnails;
  };
};

type YouTubePlaylistResponse = {
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
  error?: { message?: string };
};

type YouTubeVideoItem = {
  id?: string;
  snippet?: {
    publishedAt?: string;
    title?: string;
    thumbnails?: YouTubeThumbnails;
    liveBroadcastContent?: YouTubeLiveStatus;
  };
  liveStreamingDetails?: {
    actualStartTime?: string;
    actualEndTime?: string;
    scheduledStartTime?: string;
  };
};

type YouTubeVideoResponse = {
  items?: YouTubeVideoItem[];
  error?: { message?: string; errors?: { reason?: string }[] };
};

type YouTubeThumbnails = {
  default?: { url?: string };
  medium?: { url?: string };
  high?: { url?: string };
  standard?: { url?: string };
  maxres?: { url?: string };
};

/**
 * The uploads playlist for a channel is always `UU` + the channel id with the
 * leading `UC` replaced. The mapping is deterministic and the playlist id is
 * effectively immutable, so it is derived locally — no API call is needed to
 * discover it.
 */
function uploadsPlaylistId(channelId: string): string {
  return `UU${channelId.slice(2)}`;
}

/**
 * Builds a YouTube Data API URL from query params. Accepting a plain object
 * keeps call sites free of auth handling: the API key is NEVER placed in the
 * URL — it travels only in the `x-goog-api-key` request header — so no URL
 * string anywhere (logs, Next.js fetch-cache serialization, RSC debug
 * payloads) can ever contain the key.
 */
function apiUrl(path: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `${YOUTUBE_API_BASE}/${path}?${search.toString()}`;
}

/**
 * Single outbound API call: JSON, timeout-guarded, key sent via header (never
 * the URL), and the URL itself never logged.
 */
async function callYouTube<T>(url: string, apiKey: string, revalidateSeconds: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YOUTUBE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "x-goog-api-key": apiKey },
      // Next.js fetch cache deduplicates refresh attempts across server
      // instances; the module-level window gate below is what actually bounds
      // how often this fetch runs.
      next: { revalidate: revalidateSeconds, tags: ["youtube"] },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`YouTube API responded with ${response.status}`);
    }
    const data = (await response.json()) as T & { error?: { message?: string } };
    if (data.error?.message) {
      throw new Error(data.error.message);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tracks API health so a failure storm cannot be amplified by visitor traffic:
 * after the first failure every YouTube refresh attempt is skipped for
 * YOUTUBE_RETRY_DEFERRAL_MS and the last-known-good snapshot keeps the
 * homepage section populated while the circuit is open.
 */
let circuitOpenUntil = 0;

/**
 * Per-path shared state. `data` is the last-known-good snapshot (served stale
 * during outages), `lastAttemptAt` bounds refresh attempts to one per window
 * even when the Next.js cache layer masks the underlying error, and
 * `inFlight` deduplicates concurrent renders onto a single refresh cycle.
 */
type PathState = {
  data: YouTubeStream[] | null;
  resolvedAt: number;
  lastAttemptAt: number;
  inFlight: Promise<YouTubeStream[] | null> | null;
};

function freshPathState(): PathState {
  return { data: null, resolvedAt: 0, lastAttemptAt: 0, inFlight: null };
}

const paths: { live: PathState; recent: PathState } = {
  live: freshPathState(),
  recent: freshPathState(),
};

function noteFailure(): void {
  circuitOpenUntil = Date.now() + YOUTUBE_RETRY_DEFERRAL_MS;
}

function noteSuccess(): void {
  circuitOpenUntil = 0;
}

/**
 * Returns this path's cached data, refreshing it at most once per freshness
 * window per server process. The window gate is the primary traffic shield:
 * within the window no fetch happens at all (not even a cache revalidation),
 * so homepage traffic — however large — cannot scale YouTube API usage. After
 * a failed attempt the circuit breaker suppresses further attempts for the
 * deferral window. Concurrent callers share one in-flight refresh.
 */
async function resolve(
  path: "live" | "recent",
  windowMs: number,
  loader: (apiKey: string) => Promise<YouTubeStream[]>,
): Promise<YouTubeStream[] | null> {
  const state = paths[path];
  if (state.inFlight) return state.inFlight;

  const now = Date.now();
  if (now < circuitOpenUntil || now < state.lastAttemptAt + windowMs) {
    return state.data;
  }

  const run = (async () => {
    try {
      const apiKey = getYouTubeApiKey();
      if (!apiKey) return null;

      const result = await loader(apiKey);
      state.data = result;
      state.resolvedAt = Date.now();
      noteSuccess();
      return result;
    } catch (error) {
      // Timeout, network, quota, 429, 5xx — all suppress further attempts for
      // the deferral window so error storms cannot be amplified by traffic.
      noteFailure();
      logCmsError(`youtube:${path}`, error);
      return state.data;
    } finally {
      state.lastAttemptAt = Date.now();
    }
  })();

  state.inFlight = run;
  try {
    return await run;
  } finally {
    state.inFlight = null;
  }
}

/**
 * LIVE-STATUS PATH (shared ~60s freshness).
 *
 * Reads the newest uploads from the channel's uploads playlist, then resolves
 * those candidate video ids with ONE batched videos.list call carrying
 * `snippet,liveStreamingDetails`. A broadcast that just went live is the
 * newest upload, so a small candidate window detects active lives within the
 * 60-second cache window — with ZERO search.list usage.
 */
async function loadLiveStatus(apiKey: string): Promise<YouTubeStream[]> {
  const playlist = await callYouTube<YouTubePlaylistResponse>(
    apiUrl("playlistItems", {
      part: "snippet",
      playlistId: uploadsPlaylistId(YOUTUBE_CHANNEL_ID),
      maxResults: String(Math.max(YOUTUBE_LIVE_CANDIDATE_COUNT, 1)),
    }),
    apiKey,
    YOUTUBE_LIVE_REVALIDATE_SECONDS,
  );

  const videoIds: string[] = [];
  for (const item of playlist.items ?? []) {
    const videoId = item.snippet?.resourceId?.videoId;
    if (videoId) videoIds.push(videoId);
  }
  if (videoIds.length === 0) return [];

  // One batched videos.list resolves status for every candidate at once.
  const videos = await callYouTube<YouTubeVideoResponse>(
    apiUrl("videos", {
      part: "snippet,liveStreamingDetails",
      id: videoIds.join(","),
    }),
    apiKey,
    YOUTUBE_LIVE_REVALIDATE_SECONDS,
  );

  const streams: YouTubeStream[] = [];
  for (const item of videos.items ?? []) {
    const videoId = item.id;
    const title = item.snippet?.title?.trim();
    const thumbnailUrl = pickThumbnail(item.snippet?.thumbnails);
    if (!videoId || !title || !thumbnailUrl) continue;

    const details = item.liveStreamingDetails;
    const broadcast = item.snippet?.liveBroadcastContent ?? "none";
    let liveStatus: YouTubeLiveStatus = "none";

    if (broadcast === "live" || broadcast === "upcoming") {
      liveStatus = broadcast;
    } else if (details?.actualStartTime && !details.actualEndTime) {
      // `liveBroadcastContent` can lag; a started-but-never-ended broadcast is
      // still live even if the enum has not caught up yet.
      liveStatus = "live";
    }

    streams.push({
      id: videoId,
      videoId,
      title,
      publishedAt: item.snippet?.publishedAt ?? "",
      thumbnailUrl,
      liveStatus,
    });
  }

  // Newest first (playlist order is newest-first; batch response order is not).
  streams.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return streams;
}

/**
 * RECENT-VIDEOS PATH (shared ~15m freshness).
 *
 * Walks a bounded number of uploads-playlist pages (newest first), batch
 * resolving each page's ids through videos.list to keep only real broadcasts
 * (an upload is a broadcast only when it has live-streaming details). The page
 * cap keeps one refresh at a fixed handful of API calls no matter how the
 * channel grows.
 */
async function loadRecentStreams(apiKey: string): Promise<YouTubeStream[]> {
  const streams: YouTubeStream[] = [];
  let pageToken: string | undefined;

  for (
    let page = 0;
    page < YOUTUBE_MAX_UPLOADS_PAGES && streams.length < YOUTUBE_MAX_RESULTS;
    page++
  ) {
    const pageParams: Record<string, string> = {
      part: "snippet",
      playlistId: uploadsPlaylistId(YOUTUBE_CHANNEL_ID),
      maxResults: String(PLAYLIST_PAGE_SIZE),
    };
    if (pageToken) pageParams.pageToken = pageToken;

    const playlist = await callYouTube<YouTubePlaylistResponse>(
      apiUrl("playlistItems", pageParams),
      apiKey,
      YOUTUBE_RECENT_REVALIDATE_SECONDS,
    );

    const videoIds: string[] = [];
    for (const item of playlist.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (videoId) videoIds.push(videoId);
    }
    if (videoIds.length === 0) break;

    const videos = await callYouTube<YouTubeVideoResponse>(
      apiUrl("videos", {
        part: "snippet,liveStreamingDetails",
        id: videoIds.join(","),
      }),
      apiKey,
      YOUTUBE_RECENT_REVALIDATE_SECONDS,
    );

    for (const item of videos.items ?? []) {
      const videoId = item.id;
      const title = item.snippet?.title?.trim();
      const thumbnailUrl = pickThumbnail(item.snippet?.thumbnails);
      // Normal uploads (no live-streaming details) are not streams — skip them.
      if (!videoId || !title || !thumbnailUrl || !item.liveStreamingDetails) continue;

      const { actualStartTime, actualEndTime } = item.liveStreamingDetails;
      streams.push({
        id: videoId,
        videoId,
        title,
        publishedAt: item.snippet?.publishedAt ?? "",
        thumbnailUrl,
        // Still streaming right now if it started but never ended.
        liveStatus: actualStartTime && !actualEndTime ? "live" : "none",
      });
    }

    // Only continue to the next page when one exists AND this page still
    // left us short of the carousel target — after this page is processed.
    pageToken = playlist.nextPageToken;
    if (!pageToken || streams.length >= YOUTUBE_MAX_RESULTS) break;
  }

  streams.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return streams.slice(0, YOUTUBE_MAX_RESULTS);
}

/** Picks the highest-resolution thumbnail URL available for a snippet. */
function pickThumbnail(thumbs: YouTubeThumbnails | undefined): string | null {
  if (!thumbs) return null;
  // `maxres` is not always present; fall back through the available sizes.
  const sizes = [thumbs.maxres, thumbs.standard, thumbs.high, thumbs.medium, thumbs.default];
  for (const size of sizes) {
    if (size?.url) return size.url;
  }
  return null;
}

/** Deduplicates streams by video ID, keeping the first occurrence. */
function uniqueById(streams: YouTubeStream[]): YouTubeStream[] {
  const seen = new Set<string>();
  return streams.filter((stream) => {
    if (seen.has(stream.videoId)) return false;
    seen.add(stream.videoId);
    return true;
  });
}

/** Cached data for a path, or null once the last-known-good snapshot ages out. */
function usable(state: PathState): YouTubeStream[] | null {
  if (!state.data) return null;
  if (Date.now() - state.resolvedAt > YOUTUBE_LAST_KNOWN_GOOD_TTL_MS) return null;
  return state.data;
}

/**
 * Loads the homepage stream data for the MASOM channel.
 *
 * Two independent cached paths (no shared cache, no search.list anywhere):
 *  - live status: uploads playlist + ONE batched videos.list, ~60s freshness
 *  - recent videos: bounded uploads scan, ~15m freshness
 *
 * The featured slot shows an active live broadcast first, then the most recent
 * completed broadcast, then (only when nothing else exists) an upcoming one.
 * Failures serve the last-known-good snapshot while it is fresh and finally
 * the section's static fallback UI — the homepage always renders, never throws.
 */
export async function getYouTubeStreams(): Promise<YouTubeStreamsResult> {
  const empty: YouTubeStreamsResult = { featured: null, recent: [], isLive: false };

  const apiKey = getYouTubeApiKey();
  if (!apiKey) return empty;

  await Promise.all([
    resolve("live", LIVE_WINDOW_MS, loadLiveStatus),
    resolve("recent", RECENT_WINDOW_MS, loadRecentStreams),
  ]);

  const liveData = usable(paths.live);
  const recentData = usable(paths.recent);
  if (liveData === null && recentData === null) return empty;

  const liveStreams = uniqueById(liveData ?? []).filter((s) => s.liveStatus === "live");
  const recentStreams = uniqueById(recentData ?? []);
  const upcomingStreams = uniqueById(liveData ?? []).filter((s) => s.liveStatus === "upcoming");

  // Feature an active live broadcast when present.
  if (liveStreams.length > 0) {
    const featured = liveStreams[0];
    return {
      featured,
      recent: recentStreams.filter((s) => s.videoId !== featured.videoId),
      isLive: true,
    };
  }

  // Otherwise feature the most recent completed broadcast.
  if (recentStreams.length > 0) {
    const featured = recentStreams[0];
    return { featured, recent: recentStreams.slice(1), isLive: false };
  }

  // Only when there are no streams at all, offer upcoming content.
  if (upcomingStreams.length > 0) {
    const featured = upcomingStreams[0];
    return { featured, recent: upcomingStreams.slice(1), isLive: false };
  }

  return empty;
}
