/**
 * Provider-agnostic AI types for the MASOM Assistant.
 *
 * Deliberately minimal and vendor-neutral so the assistant's business logic
 * (tools, grounding rules, donation flow) never depends on one provider's
 * wire format. The adapter in ./provider.ts translates these to/from the
 * configured provider.
 */

/** Plain assistant/user text. */
export type AiTextPart = {
  type: "text";
  text: string;
};

/** The model asking to run one of OUR approved, typed tools. */
export type AiToolUsePart = {
  type: "tool_use";
  /** Provider-assigned call id, echoed back with the result. */
  id: string;
  name: string;
  /** Raw arguments — ALWAYS re-validated with zod before use. */
  input: unknown;
};

/** Our answer to a tool_use, fed back into the next turn. */
export type AiToolResultPart = {
  type: "tool_result";
  toolUseId: string;
  /** JSON-encoded tool output. Never contains secrets or raw DB dumps. */
  content: string;
  isError?: boolean;
};

export type AiContentPart = AiTextPart | AiToolUsePart | AiToolResultPart;

export type AiMessage = {
  role: "user" | "assistant";
  content: AiContentPart[];
};

/**
 * A tool the model may call. `parameters` is a JSON Schema object with FIXED
 * typed arguments — there is no free-form query/SQL field anywhere.
 */
export type AiToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** Token accounting, when the provider reports it. Diagnostics only. */
export type AiUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type AiCompletion = {
  /** Concatenated text parts of the assistant turn (may be empty). */
  text: string;
  /** Tool calls the model requested this turn. */
  toolUses: AiToolUsePart[];
  /** Normalized stop reason: "tool_use" | "end" | "max_tokens" | "other". */
  stopReason: "tool_use" | "end" | "max_tokens" | "other";
  usage: AiUsage | null;
};

export type AiGenerateOptions = {
  system: string;
  messages: AiMessage[];
  tools: AiToolDefinition[];
  maxTokens: number;
  temperature: number;
  /**
   * Whether the model may call tools this turn. "none" is how the orchestrator
   * forces a written answer on the final round.
   */
  toolChoice?: "auto" | "none";
  /** Aborts the upstream request so a hung provider can't hold the route open. */
  signal?: AbortSignal;
};

export type AiProvider = {
  /** Provider id, for diagnostics only. Never includes credentials. */
  readonly id: string;
  readonly model: string;
  generate(options: AiGenerateOptions): Promise<AiCompletion>;
};
