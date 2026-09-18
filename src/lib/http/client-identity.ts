import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

/**
 * Client identity for abuse controls — shared by every public write path
 * (contact form, donation intents, assistant chat) so there is exactly ONE
 * implementation of "who is this request from".
 *
 * The raw address is used only in memory for rate-limit bucketing; anything
 * persisted uses the salted one-way hash.
 */

export async function resolveClientIp(): Promise<string> {
  const headersList = await headers();

  // Cloudflare (the edge this site is served through) provides the original
  // visitor address directly; it cannot be spoofed past Cloudflare itself.
  const cfIp = headersList.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  // Standard proxy chain — take the FIRST (leftmost = original client) entry.
  const forwarded = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Local development usually has no proxy headers at all. All local requests
  // would collapse onto one bucket and repeatedly trip the production
  // cooldown, so dev gets a stable, clearly-marked local key.
  if (process.env.NODE_ENV === "development") return "local-dev";

  return "unknown";
}

/**
 * One-way hash of the client IP — abuse correlation without storing the raw
 * address. Salted with the service-role key so the hash is not reversible via
 * rainbow tables; the salt never leaves the server.
 */
export function hashIp(ip: string): string | null {
  if (ip === "unknown") return null;
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
