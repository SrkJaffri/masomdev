"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  BanknoteIcon,
  SendHorizonalIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { ASSISTANT_LIMITS, ASSISTANT_MESSAGES, ASSISTANT_SUGGESTIONS } from "../config";
import { ChatMessageContent } from "./chat-message-content";
import type { ChatMessage, ChatResponseBody, PaymentCard } from "../types";

/**
 * The chat surface. Lazy-loaded: this chunk only downloads once a visitor
 * actually opens the assistant.
 *
 * It talks to exactly one endpoint (POST /api/chat) and knows nothing about
 * the AI provider, the model, or any key — all of that stays on the server.
 */

type PanelMessage = ChatMessage & {
  /** Error notices are shown in the transcript but never sent back as history. */
  isError?: boolean;
  /** Deterministic Zelle card — attached by the server, never model text. */
  paymentCard?: PaymentCard;
};

const SESSION_STORAGE_KEY = "masom-assistant-session";

/** One opaque id per browser tab: rate-limit bucket + idempotency seed only. */
function readSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    // Private mode / storage disabled: a per-mount id still works.
    return crypto.randomUUID();
  }
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ChatPanel({
  assistantName,
  welcomeMessage,
  onClose,
}: {
  assistantName: string;
  welcomeMessage: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  if (!sessionIdRef.current && typeof window !== "undefined") {
    sessionIdRef.current = readSessionId();
  }

  // Focus the composer on open, and drop any in-flight request on close.
  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  // Keep the newest turn in view. Honour reduced-motion by jumping instead.
  useEffect(() => {
    const smooth =
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    transcriptEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, [messages, pending]);

  // Focus trap: Tab cycles inside the panel while it is open.
  const onKeyDownCapture = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null,
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || pending) return;
      if (content.length > ASSISTANT_LIMITS.maxMessageLength) return;

      // History sent upstream excludes error notices and is capped, so a long
      // session can never grow the request without bound.
      const history: ChatMessage[] = [
        ...messages
          .filter((message) => !message.isError)
          .map<ChatMessage>(({ role, content: value }) => ({ role, content: value })),
        { role: "user" as const, content },
      ].slice(-ASSISTANT_LIMITS.maxHistoryMessages);

      setMessages((current) => [...current, { role: "user", content }]);
      setDraft("");
      setPending(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history, sessionId: sessionIdRef.current }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as ChatResponseBody;

        setMessages((current) =>
          payload.ok
            ? [
                ...current,
                {
                  role: "assistant",
                  content: payload.reply,
                  paymentCard: payload.paymentCard,
                },
              ]
            : [...current, { role: "assistant", content: payload.error, isError: true }],
        );
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        setMessages((current) => [
          ...current,
          { role: "assistant", content: ASSISTANT_MESSAGES.genericError, isError: true },
        ]);
      } finally {
        setPending(false);
        abortRef.current = null;
      }
    },
    [messages, pending],
  );

  const tooLong = draft.trim().length > ASSISTANT_LIMITS.maxMessageLength;

  return (
    <div
      ref={panelRef}
      id="masom-assistant-panel"
      role="dialog"
      aria-modal="true"
      aria-label={assistantName}
      onKeyDownCapture={onKeyDownCapture}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated",
        "inset-x-4 bottom-4 top-16",
        "sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-[calc(8.5rem+env(safe-area-inset-bottom))]",
        "sm:h-[min(32rem,calc(100vh-14rem))] sm:w-[23rem]",
        "animate-in fade-in-0 slide-in-from-bottom-4 duration-200 motion-reduce:animate-none",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-brand-500 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{assistantName}</p>
          <p className="truncate text-xs text-white/80">
            {pending ? "Typing…" : "Ask about programs, timings or donations"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${assistantName}`}
          className={cn(
            "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full",
            "transition-colors hover:bg-white/15",
            "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
            "motion-reduce:transition-none",
          )}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Transcript */}
      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <Bubble role="assistant">{welcomeMessage}</Bubble>

        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className="space-y-2">
            <Bubble role={message.role} isError={message.isError}>
              {message.content}
            </Bubble>
            {message.role === "assistant" && message.paymentCard ? (
              <PaymentCardView card={message.paymentCard} />
            ) : null}
          </div>
        ))}

        {pending ? (
          <div className="flex items-center gap-1.5 px-1" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.5 animate-pulse rounded-full bg-ink-500/50 motion-reduce:animate-none"
                style={{ animationDelay: `${dot * 150}ms` }}
              />
            ))}
          </div>
        ) : null}

        <div ref={transcriptEndRef} />
      </div>

      {/* Suggestions — only in a fresh conversation. */}
      {messages.length === 0 && !pending ? (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {ASSISTANT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              className={cn(
                "cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs",
                "text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50",
                "focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none",
                "motion-reduce:transition-none",
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {/* Composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <label htmlFor="masom-assistant-input" className="sr-only">
          Message {assistantName}
        </label>
        <textarea
          id="masom-assistant-input"
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Type your question…"
          disabled={pending}
          aria-invalid={tooLong}
          aria-describedby={tooLong ? "masom-assistant-input-error" : undefined}
          className={cn(
            "max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2",
            "text-sm text-foreground placeholder:text-ink-500/60",
            "focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400/40 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
            tooLong && "border-danger focus-visible:border-danger focus-visible:ring-danger/30",
          )}
        />
        <button
          type="submit"
          disabled={pending || tooLong || draft.trim().length === 0}
          aria-label="Send message"
          className={cn(
            "grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl",
            "bg-brand-500 text-white transition-colors hover:bg-brand-600",
            "focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "motion-reduce:transition-none",
          )}
        >
          <SendHorizonalIcon className="size-4" aria-hidden="true" />
        </button>
      </form>

      {tooLong ? (
        <p id="masom-assistant-input-error" className="px-4 pb-3 text-xs text-danger">
          {ASSISTANT_MESSAGES.tooLong}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Deterministic Zelle payment card — rendered under an assistant reply only
 * when the server attached one (donation tools ran this turn). The QR image
 * and the Zelle email come from the server's central config, never from model
 * text, and the card is kept scan-friendly: contain-fit, no masks or overlays.
 */
function PaymentCardView({ card }: { card: PaymentCard }) {
  return (
    <div className="flex justify-start" data-testid="zelle-payment-card">
      <div className="w-[85%] max-w-[21rem] overflow-hidden rounded-2xl border border-brand-500/30 bg-card shadow-card">
        <div className="flex items-center gap-2 bg-brand-500/10 px-4 py-2.5">
          <BanknoteIcon className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
          <p className="truncate text-sm font-semibold text-ink-800">{card.method}</p>
        </div>
        <div className="flex flex-col items-center gap-3 px-4 py-4">
          <Image
            src={card.qrSrc}
            alt={card.qrAlt}
            width={card.qrWidth}
            height={card.qrHeight}
            className="h-auto w-56 object-contain sm:w-60"
            sizes="240px"
          />
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Scan the QR code using your bank&apos;s Zelle-enabled app, or send your donation to{" "}
            <a
              href={`mailto:${card.email}`}
              className="font-semibold break-all text-brand-600 transition-colors hover:text-brand-500"
            >
              {card.email}
            </a>
          </p>
          <Link
            href={card.donatePath}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white",
              "transition-colors hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none",
              "motion-reduce:transition-none",
            )}
          >
            Open Donate Page
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  isError,
  children,
}: {
  role: "user" | "assistant";
  isError?: boolean;
  children: string;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          // User text stays literal; assistant text uses the safe markdown
          // renderer which supplies its own paragraph/list structure.
          isUser && "whitespace-pre-wrap",
          isUser
            ? "rounded-br-sm bg-brand-500 text-white"
            : "rounded-bl-sm bg-brand-100/60 text-ink-800",
          isError && "flex items-start gap-2 bg-danger/10 text-ink-800",
        )}
      >
        {isError ? (
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        ) : null}
        {isUser || isError ? <span>{children}</span> : <ChatMessageContent content={children} />}
      </div>
    </div>
  );
}
