/**
 * MASOM Assistant — shared configuration.
 *
 * Client-safe: this module holds only limits and copy, no secrets and no
 * server imports, so both the chat panel and the API route can use it.
 */

/** Approved defaults, mirrored by the site_settings migration. */
export const ASSISTANT_DEFAULTS = {
  name: "MASOM Assistant",
  welcomeMessage:
    "Assalam-o-Alaikum! I’m the MASOM Assistant. I can help you with programs, prayer and Hijri calendar information, Islamic events, donations, and other MASOM website information. How can I help?",
  fallbackMessage:
    "MASOM Assistant is temporarily unavailable. You can still contact us through the Contact page or WhatsApp.",
} as const;

/** Hard limits — enforced server-side, mirrored client-side for UX. */
export const ASSISTANT_LIMITS = {
  /** Max characters per visitor message. */
  maxMessageLength: 1000,
  /** Max turns kept in one conversation (older turns are dropped). */
  maxHistoryMessages: 24,
  /** Max tool rounds per request: bounds AI calls and stops any tool loop. */
  maxToolRounds: 4,
  /** Max tool calls executed in a single round. */
  maxToolCallsPerRound: 4,
  /** Provider token ceiling per AI call. */
  maxTokens: 1024,
  /** Upstream timeout so a hung provider can't hold the route open. */
  requestTimeoutMs: 30_000,
} as const;

/** Grounded answers should not drift — near-deterministic sampling. */
export const ASSISTANT_TEMPERATURE = 0.2;

/** Visitor-facing failure copy (never leaks provider or stack details). */
export const ASSISTANT_MESSAGES = {
  rateLimited:
    "You’re sending messages a little too quickly. Please wait a few seconds and try again.",
  tooLong: `Please keep your message under ${ASSISTANT_LIMITS.maxMessageLength} characters.`,
  empty: "Please type a question so I can help.",
  disabled:
    "MASOM Assistant is currently unavailable. Please use the Contact page or WhatsApp to reach us.",
  /**
   * Approved copy for ANY upstream AI failure (rate limit, exhausted free
   * quota, timeout, provider outage). Never names a provider or a status.
   */
  unavailable:
    "MASOM Assistant is temporarily unavailable. Please try again shortly or contact MASOM through the Contact page.",
  genericError:
    "Something went wrong on our side. Please try again in a moment, or contact us through the Contact page.",
} as const;

/** Suggested opening questions shown as chips in an empty chat. */
export const ASSISTANT_SUGGESTIONS = [
  "Aaj ki namaz ki timings kya hain?",
  "Wiladat Imam Hasan Askari (AS) kab hai?",
  "What programs are coming up?",
  "How can I donate to MASOM?",
] as const;
