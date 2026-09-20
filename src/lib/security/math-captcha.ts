import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

/**
 * Tiny server-verified math CAPTCHA shared by the public forms.
 *
 * The expected answer never touches the client: the server generates two
 * random operands and stores the answer in an HMAC-signed, HttpOnly,
 * same-site cookie (the signature prevents tampering; HttpOnly keeps JS from
 * reading it; sameSite=lax matches the form's own site). The submit action
 * reads the cookie, verifies the signature and expiry, compares the submitted
 * answer, and always rotates the challenge afterwards.
 *
 * Next.js only allows cookie WRITES inside Server Actions / Route Handlers,
 * so generation is split:
 * - `generateChallenge()`     → pure, page-safe: returns question + signed token.
 * - `applyChallenge(token)`   → action-only: writes the cookie.
 * - `createCaptchaChallenge()`→ action-only convenience (generate + apply).
 *
 * Each form creates its own instance with a DISTINCT cookie name, so a submit
 * on one page can never rotate (and therefore invalidate) the challenge a
 * visitor is currently looking at on another page.
 *
 * No new environment variables: the signing key derives from the server-only
 * service-role key already present in the environment.
 */

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes to finish the form

function signingKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "masom-dev-fallback";
}

/** `answer:expires` HMAC-signed — the client can read the blob but not forge it. */
function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

export type CaptchaChallenge = {
  /** Display text, e.g. "4 + 7". */
  question: string;
  /** Signed server-owned blob handed to applyChallenge(). */
  token: string;
};

export type CaptchaVerifyResult = "ok" | "missing" | "wrong";

export type MathCaptcha = {
  generateChallenge: () => CaptchaChallenge;
  applyChallenge: (token: string) => Promise<void>;
  createCaptchaChallenge: () => Promise<CaptchaChallenge>;
  verifyCaptchaAnswer: (submitted: string) => Promise<CaptchaVerifyResult>;
};

export function createMathCaptcha(cookieName: string): MathCaptcha {
  /** Pure generation — safe in Server Components (no cookie write). */
  function generateChallenge(): CaptchaChallenge {
    const a = randomInt(1, 10);
    const b = randomInt(1, 10);
    const payload = `${a + b}:${Date.now() + CHALLENGE_TTL_MS}`;
    return { question: `${a} + ${b}`, token: `${payload}.${sign(payload)}` };
  }

  /** Action-only: store the signed challenge in an HttpOnly cookie. */
  async function applyChallenge(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: CHALLENGE_TTL_MS / 1000,
      path: "/",
    });
  }

  /** Action-only convenience: generate + apply in one step. */
  async function createCaptchaChallenge(): Promise<CaptchaChallenge> {
    const challenge = generateChallenge();
    await applyChallenge(challenge.token);
    return challenge;
  }

  /**
   * Verify a submitted answer. ALWAYS rotates the challenge afterwards
   * (wrong answer ⇒ new question; correct answer ⇒ token consumed).
   */
  async function verifyCaptchaAnswer(submitted: string): Promise<CaptchaVerifyResult> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(cookieName)?.value;

    // Rotate first so every attempt leaves a fresh challenge behind.
    await createCaptchaChallenge();

    if (!raw) return "missing";
    const [payload, signature] = raw.split(".", 2);
    if (!payload || !signature) return "missing";
    if (sign(payload) !== signature) return "missing";

    const [answerRaw, expiresRaw] = payload.split(":");
    if (!answerRaw || !expiresRaw) return "missing";
    if (Number(expiresRaw) < Date.now()) return "missing";

    const expected = answerRaw.trim();
    const given = submitted.trim();
    if (!given) return "missing";
    if (expected.length !== given.length) return "wrong";
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return "wrong";
    return "ok";
  }

  return { generateChallenge, applyChallenge, createCaptchaChallenge, verifyCaptchaAnswer };
}
