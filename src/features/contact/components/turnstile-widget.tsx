"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Cloudflare Turnstile widget (explicit rendering, load-once script).
 *
 * The site key is the only public value (NEXT_PUBLIC_TURNSTILE_SITE_KEY);
 * the secret never leaves the server. The widget renders before the submit
 * button, exposes the token via onToken, and can be reset after a submit
 * (success or verification failure) via the returned reset function.
 */

// Narrow the global for the explicit-render API.
type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileLoading?: Promise<TurnstileApi>;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (window.__turnstileLoading) return window.__turnstileLoading;

  window.__turnstileLoading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile loaded but API missing"));
    });
    script.addEventListener("error", () => reject(new Error("Turnstile script failed to load")));
    document.head.appendChild(script);
  });
  return window.__turnstileLoading;
}

export type TurnstileWidgetHandle = { reset: () => void };

export function TurnstileWidget({
  onToken,
  onReset,
  handleRef,
}: {
  /** Called with the token whenever the widget solves a challenge. */
  onToken: (token: string) => void;
  /** Called when the token is cleared (expired / error / reset). */
  onReset?: () => void;
  /** Parent stores this to call reset() after submit/failure. */
  handleRef?: (handle: TurnstileWidgetHandle | null) => void;
}) {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  // Stable callbacks through refs so the widget is rendered exactly once.
  const onTokenRef = useRef(onToken);
  const onResetRef = useRef(onReset);
  onTokenRef.current = onToken;
  onResetRef.current = onReset;

  useEffect(() => {
    if (!siteKey) {
      setState("error");
      return;
    }

    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          "error-callback": () => {
            onResetRef.current?.();
            setState("error");
          },
          "expired-callback": () => {
            onResetRef.current?.();
          },
          theme: "auto",
        });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== undefined) {
        try {
          window.turnstile?.remove(widgetIdRef.current);
        } catch {
          // Widget already gone (e.g. unmount during navigation).
        }
        widgetIdRef.current = undefined;
      }
    };
  }, [siteKey]);

  // Expose reset to the parent.
  useEffect(() => {
    if (!handleRef) return;
    handleRef({
      reset: () => {
        onResetRef.current?.();
        try {
          if (widgetIdRef.current !== undefined) window.turnstile?.reset(widgetIdRef.current);
        } catch {
          // Ignore reset races on unmount.
        }
      },
    });
    return () => handleRef(null);
  }, [handleRef]);

  if (!siteKey || state === "error") {
    // Config problem: render nothing instead of blocking the form visually.
    // The server still enforces verification (fail-closed), so the form will
    // explain via its error message if the token is missing.
    return null;
  }

  return (
    <div className={cn("turnstile-slot")}>
      <div
        id={containerId}
        ref={containerRef}
        role="presentation"
        aria-label="Cloudflare security verification"
      />
      {state === "loading" ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Loading security verification…
        </p>
      ) : null}
    </div>
  );
}
