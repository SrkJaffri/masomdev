import "server-only";

import type { AiToolDefinition } from "@/lib/ai/types";

import type { ToolResult } from "../types";

/** Request-scoped, server-derived context. Never supplied by the model. */
export type ToolContext = {
  /** Opaque client session id, used for idempotency + rate limiting. */
  sessionId: string;
  /** Salted hash of the caller's IP — never the raw address. */
  ipHash: string | null;
  userAgent: string | null;
};

export type AssistantTool = {
  definition: AiToolDefinition;
  execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
};

/** Standard shape for a zod failure, phrased for the model (not the visitor). */
export function invalidArguments(message: string): ToolResult {
  return { ok: false, error: `Invalid tool arguments: ${message}` };
}

/** Standard shape for an unavailable data source. */
export function unavailable(what: string): ToolResult {
  return {
    ok: false,
    error: `${what} could not be read right now. Tell the visitor you cannot confirm this and offer the Contact page.`,
  };
}
