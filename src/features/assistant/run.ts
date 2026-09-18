import "server-only";

import { chicagoTodayISO } from "@/features/calendar/queries";
import { AiProviderError } from "@/lib/ai/errors";
import { getAiProvider } from "@/lib/ai/provider";
import type { AiContentPart, AiMessage } from "@/lib/ai/types";
import { logCmsError } from "@/lib/cms/logging";

import { ASSISTANT_LIMITS, ASSISTANT_TEMPERATURE } from "./config";
import { buildSystemPrompt } from "./system-prompt";
import { executeTool, getToolDefinitions } from "./tools";
import type { ToolContext } from "./tools/types";
import type { ChatMessage } from "./types";

/**
 * The orchestrator: a BOUNDED tool loop.
 *
 * The model may ask for tools; this module decides whether to run them, runs
 * only registry tools, and feeds the results back. Hard ceilings on rounds,
 * calls per round, tokens and wall-clock mean a single visitor message can
 * never fan out into unbounded AI spend or an infinite tool loop.
 */

export type RunResult =
  | { ok: true; reply: string; usedTools: string[] }
  | {
      ok: false;
      /**
       * "busy" covers provider rate limits, exhausted free quota and
       * timeouts — cases where trying again shortly may work. "unavailable"
       * covers configuration and hard provider failures.
       */
      reason: "not_configured" | "busy" | "unavailable";
    };

/** Serialize a tool result for the model — always a string, always bounded. */
function serializeToolResult(result: Awaited<ReturnType<typeof executeTool>>): {
  content: string;
  isError: boolean;
} {
  if (!result.ok) return { content: result.error, isError: true };
  return { content: JSON.stringify(result.data).slice(0, 12_000), isError: false };
}

export async function runAssistant(options: {
  assistantName: string;
  history: ChatMessage[];
  context: ToolContext;
}): Promise<RunResult> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, reason: "not_configured" };

  const system = buildSystemPrompt({
    assistantName: options.assistantName,
    todayISO: chicagoTodayISO(),
  });

  const messages: AiMessage[] = options.history.map((message) => ({
    role: message.role,
    content: [{ type: "text", text: message.content }],
  }));

  const tools = getToolDefinitions();
  const usedTools: string[] = [];

  // One controller for the whole exchange: the timeout covers every round, so
  // a chain of slow rounds cannot keep the route open indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSISTANT_LIMITS.requestTimeoutMs);

  try {
    for (let round = 0; round < ASSISTANT_LIMITS.maxToolRounds; round += 1) {
      const isFinalRound = round === ASSISTANT_LIMITS.maxToolRounds - 1;

      const completion = await provider.generate({
        system,
        messages,
        tools,
        // On the last permitted round tools are withdrawn, forcing a written
        // answer instead of yet another tool request.
        toolChoice: isFinalRound ? "none" : "auto",
        maxTokens: ASSISTANT_LIMITS.maxTokens,
        temperature: ASSISTANT_TEMPERATURE,
        signal: controller.signal,
      });

      if (completion.toolUses.length === 0) {
        return { ok: true, reply: completion.text, usedTools };
      }

      const requested = completion.toolUses.slice(0, ASSISTANT_LIMITS.maxToolCallsPerRound);

      messages.push({
        role: "assistant",
        content: [
          ...(completion.text ? [{ type: "text" as const, text: completion.text }] : []),
          ...requested,
        ],
      });

      const resultParts: AiContentPart[] = [];
      for (const use of requested) {
        const result = await executeTool(use.name, use.input, options.context);
        const { content, isError } = serializeToolResult(result);
        if (!isError) usedTools.push(use.name);
        resultParts.push({
          type: "tool_result",
          toolUseId: use.id,
          content,
          isError,
        });
      }

      messages.push({ role: "user", content: resultParts });
    }

    // Every round used a tool and none produced prose — ask once more, without
    // tools, so the visitor still gets an answer built from what was gathered.
    const final = await provider.generate({
      system,
      messages,
      tools: [],
      toolChoice: "none",
      maxTokens: ASSISTANT_LIMITS.maxTokens,
      temperature: ASSISTANT_TEMPERATURE,
      signal: controller.signal,
    });

    return { ok: true, reply: final.text, usedTools };
  } catch (error) {
    if (error instanceof AiProviderError) {
      // Kind + status only. The upstream body was never read, so nothing
      // sensitive can reach the log, and nothing reaches the visitor at all.
      logCmsError("assistant:run", `${error.kind}${error.status ? ` ${error.status}` : ""}`);
      const busy =
        error.kind === "rate_limit" ||
        error.kind === "credits" ||
        error.kind === "timeout" ||
        error.kind === "server";
      return { ok: false, reason: busy ? "busy" : "unavailable" };
    }

    logCmsError("assistant:run", error);
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
