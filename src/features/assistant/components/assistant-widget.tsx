"use client";

import { MessageCircleIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Launcher + lazy panel host.
 *
 * The chat panel (transcript, composer, fetch logic) is a separate chunk that
 * is only requested when the visitor actually opens the assistant, so a normal
 * page visit ships nothing but this small button.
 *
 * Floating stack, bottom-right, no overlap:
 *   Back-to-Top   right-5 bottom-5      (44px tall, z-50)
 *   WhatsApp      right-5 bottom-19     (52-56px tall, z-40)
 *   Assistant     right-5 bottom-37     (52-56px tall, z-40)  ← this button
 */
const ChatPanel = dynamic(() => import("./chat-panel").then((mod) => mod.ChatPanel), {
  ssr: false,
});

export function AssistantWidget({
  assistantName,
  welcomeMessage,
}: {
  assistantName: string;
  welcomeMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Focus must come back to the control that opened the dialog.
    launcherRef.current?.focus();
  }, []);

  // Escape closes from anywhere, including before the panel has focus.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? `Close ${assistantName}` : `Open ${assistantName}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="masom-assistant-panel"
        className={cn(
          "fixed right-5 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-40 sm:bottom-[8.5rem]",
          "group grid size-13 cursor-pointer place-items-center rounded-full sm:size-14",
          "bg-brand-500 text-white shadow-elevated",
          "transition-all duration-300 ease-brand",
          "hover:scale-105 hover:bg-brand-600 hover:shadow-lg",
          "active:scale-95",
          "focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
          "motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        )}
      >
        {open ? (
          <XIcon className="size-6 sm:size-7" aria-hidden="true" />
        ) : (
          <MessageCircleIcon className="size-6 sm:size-7" aria-hidden="true" />
        )}

        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-full mr-3 hidden rounded-lg bg-ink-900 px-3 py-1.5",
            "text-sm font-medium whitespace-nowrap text-white opacity-0 shadow-elevated sm:block",
            "translate-x-1 transition-all duration-200 ease-brand",
            "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            "motion-reduce:translate-x-0 motion-reduce:transition-none",
          )}
        >
          {assistantName}
        </span>
      </button>

      {open ? (
        <ChatPanel
          assistantName={assistantName}
          welcomeMessage={welcomeMessage}
          onClose={close}
        />
      ) : null}
    </>
  );
}
