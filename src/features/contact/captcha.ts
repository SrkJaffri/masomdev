import "server-only";

import { createMathCaptcha } from "@/lib/security/math-captcha";

/**
 * Contact-form math CAPTCHA.
 *
 * The mechanism lives in `@/lib/security/math-captcha` so every public form
 * shares one implementation; this module only binds it to the contact form's
 * own cookie namespace. The cookie name is unchanged, so challenges issued
 * before this refactor keep verifying.
 *
 * See the shared module for the security model (HMAC-signed HttpOnly cookie,
 * server-owned answer, rotation on every attempt).
 */
const contactCaptcha = createMathCaptcha("masom_contact_captcha");

export type { CaptchaChallenge, CaptchaVerifyResult } from "@/lib/security/math-captcha";

/** Pure generation — safe in Server Components (no cookie write). */
export const generateChallenge = contactCaptcha.generateChallenge;

/** Action-only: store the signed challenge in an HttpOnly cookie. */
export const applyChallenge = contactCaptcha.applyChallenge;

/** Action-only convenience: generate + apply in one step. */
export const createCaptchaChallenge = contactCaptcha.createCaptchaChallenge;

/**
 * Verify a submitted answer. ALWAYS rotates the challenge afterwards
 * (wrong answer ⇒ new question; correct answer ⇒ token consumed).
 */
export const verifyCaptchaAnswer = contactCaptcha.verifyCaptchaAnswer;
