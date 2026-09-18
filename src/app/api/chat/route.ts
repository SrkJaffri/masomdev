import { NextResponse } from "next/server";

import { headers } from "next/headers";

import { siteConfig } from "@/config/site";
import { ASSISTANT_MESSAGES, ASSISTANT_LIMITS } from "@/features/assistant/config";
import { runAssistant } from "@/features/assistant/run";
import { chatRequestSchema } from "@/features/assistant/schema";
import { getAssistantSettings } from "@/features/assistant/settings";
import type { ChatResponseBody } from "@/features/assistant/types";
import { isAiConfigured } from "@/lib/ai/provider";
import { hashIp, resolveClientIp } from "@/lib/http/client-identity";
import { createBurstLimiter } from "@/lib/rate-limit";

/**
 * POST /api/chat — the ONLY endpoint the MASOM Assistant uses.
 *
 * Security model:
 * - The AI key lives in a server-side env var read inside the provider module,
 *   which is `server-only`. Nothing about the provider reaches the browser.
 * - Input is zod-validated (role, length, history size) before any AI call.
 * - Abuse: per-IP AND per-session burst limits, so one client cannot spend AI
 *   tokens without bound, and a shared IP cannot lock out a whole household.
 * - The model reaches the database only through the fixed typed tool registry.
 * - Errors are generic: no provider name, status, stack, or SQL ever leaks.
 */

export const runtime = "nodejs";
// Never cached: every reply depends on live data and the visitor's own turn.
export const dynamic = "force-dynamic";

/** Per-IP budget: generous for a real conversation, hard stop for a script. */
const ipLimiter = createBurstLimiter("assistant-ip", 20, 60_000);
/** Per-session budget: a single tab cannot outrun a human typist. */
const sessionLimiter = createBurstLimiter("assistant-session", 12, 60_000);

function json(body: ChatResponseBody, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  // 1. Feature flag — the CMS can switch the assistant off entirely.
  const settings = await getAssistantSettings();
  if (!settings.enabled) {
    return json({ ok: false, error: ASSISTANT_MESSAGES.disabled }, 503);
  }

  // 2. Provider configured? If not, serve the CMS fallback, not an error page.
  if (!isAiConfigured()) {
    return json({ ok: false, error: settings.fallbackMessage }, 503);
  }

  // 3. Parse + validate. Malformed JSON is a client error, nothing is logged.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: ASSISTANT_MESSAGES.empty }, 400);
  }

  const parsed = chatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const tooLong = issue?.code === "too_big";
    return json(
      { ok: false, error: tooLong ? ASSISTANT_MESSAGES.tooLong : ASSISTANT_MESSAGES.empty },
      400,
    );
  }

  const { messages, sessionId } = parsed.data;

  // The last turn must be the visitor's — a client cannot make the model
  // "continue" an assistant turn it wrote itself.
  if (messages[messages.length - 1]?.role !== "user") {
    return json({ ok: false, error: ASSISTANT_MESSAGES.empty }, 400);
  }

  // 4. Rate limit (before any AI spend).
  const ip = await resolveClientIp();
  if (!ipLimiter.take(ip).allowed || !sessionLimiter.take(sessionId).allowed) {
    return json({ ok: false, error: ASSISTANT_MESSAGES.rateLimited }, 429);
  }

  // 5. Run. Context is server-derived only — the model never supplies it.
  const userAgent = (await headers()).get("user-agent");
  const result = await runAssistant({
    assistantName: settings.name,
    history: messages.slice(-ASSISTANT_LIMITS.maxHistoryMessages),
    context: {
      sessionId,
      ipHash: hashIp(ip),
      userAgent,
    },
  });

  if (!result.ok) {
    return json(
      {
        ok: false,
        error:
          result.reason === "not_configured"
            ? settings.fallbackMessage
            : ASSISTANT_MESSAGES.unavailable,
      },
      503,
    );
  }

  const reply = result.reply.trim();
  if (!reply) {
    return json({ ok: false, error: ASSISTANT_MESSAGES.genericError }, 502);
  }

  const paymentCard = paymentCardForTools(result.usedTools);
  return json(
    {
      ok: true,
      reply,
      usedTools: result.usedTools,
      ...(paymentCard ? { paymentCard } : {}),
    },
    200,
  );
}

/**
 * Deterministic Zelle payment card, attached ONLY when a donation/payment tool
 * answered this turn. Fields come from the central donation config — never
 * from model output — so the QR shown in chat is always the approved asset at
 * the approved path, and cannot be faked or redirected by the model.
 */
function paymentCardForTools(usedTools: string[]) {
  const relevant = usedTools.some((tool) =>
    ["getDonationInfo", "registerDonationIntent"].includes(tool),
  );
  if (!relevant) return undefined;

  return {
    method: "Zelle / Quickpay",
    email: siteConfig.donation.zelleEmail,
    qrSrc: siteConfig.donation.zelleQr.src,
    qrAlt: siteConfig.donation.zelleQrAlt,
    qrWidth: siteConfig.donation.zelleQr.width,
    qrHeight: siteConfig.donation.zelleQr.height,
    donatePath: siteConfig.links.donate,
  } as const;
}

/** Only POST is supported — no GET probe surface. */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
