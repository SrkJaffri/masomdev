/** MASOM Assistant — shared types (client + server safe). */

/** One turn in the visitor-visible transcript. */
export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** Wire payload POSTed to /api/chat. */
export type ChatRequestBody = {
  messages: ChatMessage[];
  /** Opaque per-browser-session id used for rate limiting + idempotency. */
  sessionId: string;
};

export type ChatResponseBody =
  | {
      ok: true;
      reply: string;
      /** Tool names actually executed — surfaced for debugging/QA only. */
      usedTools: string[];
    }
  | {
      ok: false;
      /** Visitor-safe message. Never contains provider or stack details. */
      error: string;
    };

/** CMS-controlled presentation for the widget. */
export type AssistantSettings = {
  enabled: boolean;
  name: string;
  welcomeMessage: string;
  fallbackMessage: string;
};

/** Result envelope every assistant tool returns to the model. */
export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };
