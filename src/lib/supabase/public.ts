import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/config/env";

/** Seconds to cache public Supabase reads (fetch-level revalidation). Admin
 * edits call `revalidatePath(...)` and `revalidateTag(...)` on every public
 * path, which purges these cache entries immediately, so a long TTL is safe
 * and keeps navigation fast. */
const PUBLIC_READ_REVALIDATE_SECONDS = 3600;

/**
 * Creates a fetch wrapper that routes Supabase reads through Next.js fetch
 * caching with an optional cache tag for explicit invalidation via
 * `revalidateTag(tag)`. Without this, every page render hits Supabase over
 * the network, which is the main cost of the 1–2s per-navigation server time.
 */
function createCachedPublicFetch(tags?: string[]) {
  return function cachedPublicFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const nextInit: RequestInit = { ...init };
    // Supabase-js may tag its own cache strategy; force Next's revalidate cache.
    nextInit.cache = undefined;
    (nextInit as RequestInit & { next?: Record<string, unknown> }).next = {
      revalidate: PUBLIC_READ_REVALIDATE_SECONDS,
      ...(tags ? { tags } : {}),
    };
    return fetch(input, nextInit);
  };
}

const defaultFetch = createCachedPublicFetch();

/** Always-network fetch — never served from Next's Data Cache. */
async function noStoreFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}

/**
 * Read-only Supabase client for cached PUBLIC content (programs). It uses the
 * anon key and no cookies/session, so public queries do not read `cookies()`
 * and therefore do not opt pages into dynamic rendering. Results refresh
 * through `revalidateTag("programs")` / `revalidatePath(...)` after admin
 * changes.
 *
 * Only the public RLS policies (the `anon` role) apply here, which is exactly
 * what public content needs. Never use this client for admin reads or any
 * mutation — those must go through the session-aware server client so that
 * `is_admin()` RLS is enforced.
 */
export function createSupabasePublicClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: defaultFetch },
  });
}

/**
 * Uncached variant for content that MUST reflect admin changes on the very
 * next request (banners, announcements). Bypasses Next's fetch/Data Cache
 * entirely (`cache: "no-store"`) so every call goes straight to Postgres —
 * no ISR window, no stale tag dependency, no out-of-band-edit blind spot.
 * Still anon/RLS-only and session-free; still safe for statically-friendly
 * code paths that simply need fresh values.
 */
export function createSupabaseFreshPublicClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  });
}

/**
 * Tagged variant of the public client used for Program queries. Fetch results
 * are tagged with `"programs"` so that `revalidateTag("programs")` from admin
 * server actions immediately invalidates stale data on both the homepage and
 * `/events-schedule` without relying solely on `revalidatePath`.
 */
export function createSupabaseProgramClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createCachedPublicFetch(["programs"]) },
  });
}

/**
 * Tagged variant of the public client used for Calendar queries (prayer days,
 * Hijri months, overrides, events). Fetch results are tagged with `"calendar"`
 * so `revalidateTag("calendar")` from the admin calendar server actions purges
 * every cached calendar read at once — including reads on pages that
 * `revalidatePath` alone cannot reach (e.g. the ?month=/?year= query-param
 * variants of the public calendar). Without the tag, out-of-band data changes
 * (migrations, seed scripts) would stay stale for the full 1-hour TTL.
 */
export function createSupabaseCalendarClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createCachedPublicFetch(["calendar"]) },
  });
}
