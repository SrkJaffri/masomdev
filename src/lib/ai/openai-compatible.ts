import "server-only";

import { AiProviderError, classifyStatus, isAbortError } from "./errors";
import type {
  AiCompletion,
  AiGenerateOptions,
  AiToolUsePart,
  AiUsage,
} from "./types";

/**
 * OpenAI-compatible Chat Completions transport.
 *
 * This is the ONLY module that knows the wire format and the ONLY place a
 * provider URL or key is used. It mirrors the standard Chat Completions
 * contract, so the transport is not specific to one vendor: the active
 * provider is chosen entirely by `baseUrl` / `model` / headers in
 * ./provider.ts.
 *
 * There is exactly ONE configured provider at a time and NO automatic
 * failover — a provider failure surfaces as the CMS unavailable message.
 */

// ===========================================================================
// Strict types for the subset of the response we actually read.
// ===========================================================================

type OpenAiToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type OpenAiResponseMessage = {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
};

type OpenAiChoice = {
  index?: number;
  finish_reason?: string | null;
  message?: OpenAiResponseMessage;
};

type OpenAiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

/**
 * OpenRouter can return HTTP 200 with an `error` object in the body (upstream
 * model failures, moderation, provider routing errors), so a 2xx status alone
 * is not success.
 */
type OpenAiChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: OpenAiChoice[];
  usage?: OpenAiUsage;
  error?: { message?: string; code?: number | string; type?: string };
};

// ===========================================================================
// Request building
// ===========================================================================

type OpenAiRequestMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export function toOpenAiMessages(options: AiGenerateOptions): OpenAiRequestMessage[] {
  const messages: OpenAiRequestMessage[] = [
    { role: "system", content: options.system },
  ];

  for (const message of options.messages) {
    const text = message.content
      .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    const toolUses = message.content.filter(
      (part): part is AiToolUsePart => part.type === "tool_use",
    );
    const toolResults = message.content.filter(
      (part): part is Extract<typeof part, { type: "tool_result" }> =>
        part.type === "tool_result",
    );

    if (message.role === "assistant") {
      // The API requires content OR tool_calls (or both) — never an empty turn.
      if (text || toolUses.length > 0) {
        messages.push({
          role: "assistant",
          content: text || null,
          ...(toolUses.length > 0
            ? {
                tool_calls: toolUses.map((use) => ({
                  id: use.id,
                  type: "function" as const,
                  function: { name: use.name, arguments: JSON.stringify(use.input ?? {}) },
                })),
              }
            : {}),
        });
      }
      continue;
    }

    // Tool results are their own `tool` messages and must immediately follow
    // the assistant turn that requested them.
    for (const result of toolResults) {
      messages.push({
        role: "tool",
        tool_call_id: result.toolUseId,
        content: result.content,
      });
    }
    if (text) messages.push({ role: "user", content: text });
  }

  return messages;
}

function normalizeStop(reason: string | null | undefined): AiCompletion["stopReason"] {
  if (reason === "tool_calls" || reason === "function_call") return "tool_use";
  if (reason === "stop") return "end";
  if (reason === "length") return "max_tokens";
  return "other";
}

function readUsage(usage: OpenAiUsage | undefined): AiUsage | null {
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
  };
}

// ===========================================================================
// Transport
// ===========================================================================

export type OpenAiCompatibleConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Provider-specific extra headers (OpenRouter attribution). Server-side. */
  extraHeaders?: Record<string, string>;
};

export async function generateOpenAiCompatible(
  config: OpenAiCompatibleConfig,
  options: AiGenerateOptions,
): Promise<AiCompletion> {
  const useTools = options.tools.length > 0 && options.toolChoice !== "none";

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        ...config.extraHeaders,
      },
      // Provider calls are always live — never served from Next's Data Cache.
      cache: "no-store",
      signal: options.signal,
      body: JSON.stringify({
        model: config.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        messages: toOpenAiMessages(options),
        ...(useTools
          ? {
              tools: options.tools.map((tool) => ({
                type: "function",
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                },
              })),
              tool_choice: "auto",
            }
          : {}),
      }),
    });
  } catch (error) {
    // Abort = our own deadline. Anything else is a network-level failure.
    throw new AiProviderError(isAbortError(error) ? "timeout" : "server");
  }

  if (!response.ok) {
    // Status ONLY. The upstream body can echo the request (and in some gateway
    // configurations the key), so it is never read, logged or propagated.
    throw new AiProviderError(classifyStatus(response.status), response.status);
  }

  let payload: OpenAiChatCompletionResponse;
  try {
    payload = (await response.json()) as OpenAiChatCompletionResponse;
  } catch {
    throw new AiProviderError("malformed", response.status);
  }

  // 200 + error object: OpenRouter's way of reporting upstream model failures.
  if (payload.error) {
    const code = Number(payload.error.code);
    throw new AiProviderError(
      Number.isFinite(code) ? classifyStatus(code) : "model_unavailable",
      Number.isFinite(code) ? code : null,
    );
  }

  const choice = payload.choices?.[0];
  if (!choice) throw new AiProviderError("malformed", response.status);

  const toolUses: AiToolUsePart[] = [];
  for (const call of choice.message?.tool_calls ?? []) {
    if (!call.id || !call.function?.name) continue;
    let input: unknown = {};
    try {
      input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      // Malformed arguments fall through as {} — zod rejects it and the model
      // is told the arguments were invalid rather than the call silently running.
      input = {};
    }
    toolUses.push({ type: "tool_use", id: call.id, name: call.function.name, input });
  }

  return {
    text: (choice.message?.content ?? "").trim(),
    toolUses,
    stopReason: normalizeStop(choice.finish_reason),
    usage: readUsage(payload.usage),
  };
}
