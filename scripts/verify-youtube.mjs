/**
 * End-to-end verification of the MASOM YouTube data layer.
 *
 * Mirrors the exact request flow of src/features/youtube/queries.ts against
 * the YouTube Data API — uploads playlist (playlistItems.list) + one batched
 * videos.list with liveStreamingDetails. NO search.list is used, matching the
 * production homepage path, so this script costs 2 quota units per run.
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-youtube.mjs
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_CHANNEL_ID = "UCLE_Z6NZIg05Zzz1tn209sg";
const CANDIDATE_COUNT = 10;

const apiKey = process.env.YOUTUBE_API_KEY?.trim();

if (!apiKey) {
  console.error(
    "YOUTUBE_API_KEY is not set in .env.local.\n" +
      "Create a key in Google Cloud Console (YouTube Data API v3 enabled), then\n" +
      "add YOUTUBE_API_KEY=<your key> to .env.local and re-run this script.",
  );
  process.exit(1);
}

/** uploads playlist = UU + channel id without the leading UC. */
function uploadsPlaylistId(channelId) {
  return `UU${channelId.slice(2)}`;
}

/**
 * Mirrors callYouTube in queries.ts: key via the `x-goog-api-key` header —
 * never the URL — so no console/log output can contain the key.
 */
async function callApi(path, params) {
  const search = new URLSearchParams(params);
  const url = `${YOUTUBE_API_BASE}/${path}?${search.toString()}`;
  console.log(`\n== ${path} ==`);
  console.log(url);

  const response = await fetch(url, {
    headers: { accept: "application/json", "x-goog-api-key": apiKey },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  const data = await response.json();
  if (data.error?.message) {
    throw new Error(`API error: ${data.error.message}`);
  }
  return data;
}

function pickThumbnail(thumbs) {
  if (!thumbs) return null;
  return (
    thumbs.maxres?.url ??
    thumbs.standard?.url ??
    thumbs.high?.url ??
    thumbs.medium?.url ??
    thumbs.default?.url ??
    null
  );
}

/** Mirrors loadLiveStatus classification exactly. */
function classify(item) {
  const details = item.liveStreamingDetails;
  const broadcast = item.snippet?.liveBroadcastContent ?? "none";
  if (broadcast === "live" || broadcast === "upcoming") return broadcast;
  if (details?.actualStartTime && !details.actualEndTime) return "live";
  return "none";
}

function truncate(text, length = 60) {
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

// 1) Newest uploads from the uploads playlist.
const playlist = await callApi("playlistItems", {
  part: "snippet",
  playlistId: uploadsPlaylistId(YOUTUBE_CHANNEL_ID),
  maxResults: String(CANDIDATE_COUNT),
});

const videoIds = (playlist.items ?? [])
  .map((item) => item.snippet?.resourceId?.videoId)
  .filter(Boolean);

console.log(`\nNewest uploads found: ${videoIds.length}`);
if (videoIds.length === 0) {
  console.warn("WARNING: uploads playlist returned no items.");
  process.exit(1);
}

// 2) One batched videos.list with liveStreamingDetails.
const videos = await callApi("videos", {
  part: "snippet,liveStreamingDetails",
  id: videoIds.join(","),
});

const rows = (videos.items ?? []).map((item) => ({
  videoId: item.id,
  title: item.snippet?.title,
  publishedAt: item.snippet?.publishedAt,
  thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
  liveStatus: classify(item),
  scheduledStartTime: item.liveStreamingDetails?.scheduledStartTime ?? null,
  actualStartTime: item.liveStreamingDetails?.actualStartTime ?? null,
  actualEndTime: item.liveStreamingDetails?.actualEndTime ?? null,
  isBroadcast: Boolean(item.liveStreamingDetails),
}));

rows.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

const live = rows.filter((r) => r.liveStatus === "live");
const upcoming = rows.filter((r) => r.liveStatus === "upcoming");
const completed = rows.filter((r) => r.isBroadcast && r.liveStatus !== "live" && r.liveStatus !== "upcoming");
const ordinary = rows.filter((r) => !r.isBroadcast);

function printRows(label, list) {
  console.log(`\n${label} (${list.length}):`);
  if (list.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const r of list) {
    console.log(`  [${r.liveStatus}] ${r.videoId}  ${truncate(r.title)}  (${r.publishedAt})`);
  }
}

printRows("LIVE", live);
printRows("UPCOMING", upcoming);
printRows("COMPLETED BROADCASTS", completed);
printRows("ORDINARY UPLOADS (skipped)", ordinary);

console.log("\n== Result (mirrors getYouTubeStreams) ==");
const featured = live[0] ?? completed[0] ?? upcoming[0] ?? null;
const isLive = Boolean(live[0]);
console.log(`isLive:   ${isLive}`);
console.log(`featured: ${featured ? `${featured.videoId} — ${truncate(featured.title, 70)}` : "null"}`);
const recentPool = rows.filter((r) => r.isBroadcast && (!featured || r.videoId !== featured.videoId));
console.log(`recent:   ${Math.min(recentPool.length, 9)} stream(s)`);

if (!featured) {
  console.warn("\nWARNING: no live, completed, or upcoming broadcasts among recent uploads.");
} else {
  console.log("\nOK: uploads-playlist + videos.list flow verified against the live API (0 search.list calls).");
}
