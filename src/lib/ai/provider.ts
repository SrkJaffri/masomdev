import "server-only";

import { getSiteUrl } from "@/config/env";

import { generateOpenAiCompatible } from "./openai-compatible";
import type { AiProvider } from "./types";

/**
 * Server-only AI provider selection for the MASOM Assistant.
 *
 * ACTIVE PROVIDER: OpenRouter (OpenAI-compatible REST, no SDK).
 *
 * SINGLE PROVIDER — deliberately. There is no secondary provider and no
 * automatic failover: if OpenRouter is unreachable or rate-limits us, the
 * visitor gets the approved unavailable message from the CMS. Nothing is ever
 * silently re-routed to another (potentially paid) provider, so AI spend can
 * only change when the environment changes.
 *
 * SECURITY
 *   - The key is read from a NON-public env var inside this server-only module
 *     and is never returned, logged, rendered or included in an error. There is
 *     no NEXT_PUBLIC_* variable involved, so it cannot reach the client bundle.
 *   - "server-only" makes importing this file from a Client Component a build
 *     error — the compile-time guarantee that the key never ships.
 *
 * NO LOCK-IN
 *   - Business logic (tools, grounding, donation rules) lives in the assistant
 *     feature and speaks only the vendor-neutral types in ./types.ts.
 *   - Only the transport module knows a wire format, and only this module knows
 *     a URL or a key. Moving to another OpenAI-compatible gateway is an
 *     environment change (AI_BASE_URL / AI_MODEL), not a code change.
 *
 * CONFIGURATION (all server-side; none are NEXT_PUBLIC)
 *   OPENROUTER_API_KEY  the OpenRouter secret (AI_API_KEY is accepted as an
 *                       alias for gateways that use that name).
 *   AI_BASE_URL         endpoint override.
 *   AI_MODEL            model override.
 *   AI_PROVIDER         must resolve to "openrouter" (the default). Any other
 *                       value is reported as unconfigured rather than being
 *                       used to reach a different vendor.
 */

export type ProviderId = "openrouter";

const DEFAULTS = {
  baseUrl: "https://openrouter.ai/api/v1",
  // Free endpoint approved for the initial integration. A paid model is NEVER
  // substituted automatically — changing it is an explicit env change.
  model: "deepseek/deepseek-v4-flash-0731:free",
} as const;

type ProviderConfig = {
  id: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
};

/**
 * Only OpenRouter is a valid runtime provider. An unknown or legacy
 * AI_PROVIDER value (for example a leftover "anthropic") is treated as
 * unconfigured so the assistant serves the CMS fallback instead of dialling
 * a provider this build does not ship.
 */
function readProviderId(): ProviderId | null {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  // Empty (unset) or "openrouter" are both OpenRouter.
  if (raw === "" || raw === "openrouter") return "openrouter";
  return null;
}

function readApiKey(): string {
  return process.env.OPENROUTER_API_KEY?.trim() || process.env.AI_API_KEY?.trim() || "";
}

function readProviderConfig(): ProviderConfig | null {
  // Belt-and-braces: "server-only" already prevents this, but an explicit
  // guard means a stray import can never read the secret in a browser build.
  if (typeof window !== "undefined") return null;

  const id = readProviderId();
  if (!id) return null;

  const apiKey = readApiKey();
  if (!apiKey) return null;

  const baseUrl = (process.env.AI_BASE_URL?.trim() || DEFAULTS.baseUrl).replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || DEFAULTS.model;

  return { id, apiKey, model, baseUrl };
}

/** True when a provider key is configured. Decides fallback vs live assistant. */
export function isAiConfigured(): boolean {
  return readProviderConfig() !== null;
}

/**
 * Non-secret description of the active configuration, for server diagnostics
 * and the capability-test script. Deliberately contains NO key material.
 */
export function describeAiProvider(): { id: ProviderId; model: string; baseUrl: string } | null {
  const config = readProviderConfig();
  if (!config) return null;
  return { id: config.id, model: config.model, baseUrl: config.baseUrl };
}

/** OpenRouter attribution headers — server-side only, no secrets. */
function openRouterHeaders(): Record<string, string> {
  return {
    "HTTP-Referer": getSiteUrl(),
    "X-Title": "MASOM Assistant",
  };
}

/**
 * Returns the configured provider, or null when no key is set so the caller
 * can serve the CMS fallback message instead of erroring.
 */
export function getAiProvider(): AiProvider | null {
  const config = readProviderConfig();
  if (!config) return null;

  return {
    id: config.id,
    model: config.model,
    generate: (options) =>
      generateOpenAiCompatible({ ...config, extraHeaders: openRouterHeaders() }, options),
  };
}
