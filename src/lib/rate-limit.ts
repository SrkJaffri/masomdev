/**
 * Pure, dependency-free submission rate limiter (in-memory, single instance).
 *
 * Semantics (deliberately split so failed attempts never consume cooldown):
 * - `check(key, now)`   → reads without writing. Blocks only while a
 *   previously ACCEPTED submission is inside its cooldown window.
 * - `reserve(key, now)` → stamps the cooldown. Called ONLY after a submission
 *   has passed validation + Turnstile and is genuinely being processed.
 *
 * Each feature creates its OWN limiter instance (`contact:`, `donation:`,
 * `newsletter:` namespaces), so a recent action in one module can never block
 * another module.
 */

const RATE_LIMIT_MS = 20_000;
const MAX_IP_ENTRIES = 2_000;

export type RateLimiter = {
  /** True while the key is inside a cooldown stamped by a previous reserve(). */
  isLimited: (key: string, now?: number) => boolean;
  /** Stamp the cooldown for an ACCEPTED submission. */
  reserve: (key: string, now?: number) => void;
};

export function createRateLimiter(
  /** Namespace label, e.g. "contact" — used in key prefixes and log lines. */
  namespace: string,
  windowMs = RATE_LIMIT_MS,
): RateLimiter {
  const lastAcceptedAt = new Map<string, number>();

  function sweep(now: number) {
    if (lastAcceptedAt.size <= MAX_IP_ENTRIES) return;
    for (const [key, at] of lastAcceptedAt) {
      if (now - at >= windowMs) lastAcceptedAt.delete(key);
    }
  }

  return {
    isLimited(key, now = Date.now()) {
      const last = lastAcceptedAt.get(key);
      // A key that was never reserved is never limited — the first valid
      // submission from any client always passes.
      return last !== undefined && now - last < windowMs;
    },
    reserve(key, now = Date.now()) {
      sweep(now);
      lastAcceptedAt.set(key, now);
    },
  };
}
