import "server-only";

/**
 * Normalized AI transport failures.
 *
 * The visitor never sees any of this: the route maps a failure to one approved
 * sentence. The `kind` exists so the server can log a useful diagnostic and so
 * a rate limit can be told apart from a bad key WITHOUT ever echoing the
 * upstream response body (which can contain request details) or the key.
 */
export type AiErrorKind =
  | "auth" // 401/403 — key missing, invalid or not permitted
  | "credits" // 402 — no credit / free quota exhausted
  | "rate_limit" // 429 — provider throttled us
  | "model_unavailable" // 404 / model errors — configured model not served
  | "server" // 5xx
  | "timeout" // AbortController fired
  | "malformed" // 200 but the body is not a usable completion
  | "unknown";

export class AiProviderError extends Error {
  readonly kind: AiErrorKind;
  /** HTTP status when there was one. Never accompanied by the response body. */
  readonly status: number | null;

  constructor(kind: AiErrorKind, status: number | null = null) {
    super(`AI provider error (${kind}${status === null ? "" : ` ${status}`})`);
    this.name = "AiProviderError";
    this.kind = kind;
    this.status = status;
  }
}

/** Map an HTTP status onto a kind. Status only — never the body. */
export function classifyStatus(status: number): AiErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "credits";
  if (status === 404) return "model_unavailable";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "unknown";
}

/** An aborted fetch is a timeout in our model (we only abort on the deadline). */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError"
  );
}
