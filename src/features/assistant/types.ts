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

/**
 * Deterministic payment card the client renders under an assistant reply when
 * the server saw a relevant donation tool run. Server-derived only: fields
 * are copied from the central donation config, never model output, so the QR
 * cannot be faked or redirected by the model.
 */
export type PaymentCard = {
  method: string;
  email: string;
  qrSrc: string;
  qrAlt: string;
  qrWidth: number;
  qrHeight: number;
  donatePath: string;
};

export type ChatResponseBody =
  | {
      ok: true;
      reply: string;
      /** Tool names actually executed — surfaced for debugging/QA only. */
      usedTools: string[];
      /** Present only when a donation/payment tool answered this turn. */
      paymentCard?: PaymentCard;
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
