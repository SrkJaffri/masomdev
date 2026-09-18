import "server-only";

import { createHash } from "node:crypto";

import { siteConfig } from "@/config/site";
import { DONATION_PURPOSES } from "@/features/donations/schema";
import { logCmsError } from "@/lib/cms/logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { getDonationInfoSchema, registerDonationIntentSchema } from "../schema";

import { type AssistantTool, invalidArguments } from "./types";

/**
 * Donation tools.
 *
 * MASOM does NOT process payments on the website. The assistant can explain
 * the approved payment methods and it can register a donor's *intent* so the
 * committee can follow up — nothing more.
 *
 * Hard rules encoded here:
 * - No field exists for a card number, CVV, bank account, routing number or
 *   any banking credential (see the schema).
 * - A registered row is never described as paid: the status vocabulary has no
 *   'paid'/'payment_received'/'completed' value.
 * - Reads are impossible: there is no tool that returns other people's
 *   donation records, so donor data is never sent to the model.
 */

const DONATION_EMAIL = "donate@masom.com";
const MAILING_ADDRESS = "MASOM, 4353 W Lawrence Ave, Chicago, IL, 60630";

// ---------------------------------------------------------------------------
// getDonationInfo
// ---------------------------------------------------------------------------

export const getDonationInfoTool: AssistantTool = {
  definition: {
    name: "getDonationInfo",
    description:
      "Get MASOM's approved donation methods (Zelle/Quickpay and mailed checks), " +
      "the donation types accepted, and what the website can and cannot do with " +
      "payments. Use for 'how do I donate', 'chanda kaise dein', Sadaqa/Fitra questions.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  async execute(input) {
    const parsed = getDonationInfoSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return invalidArguments(parsed.error.issues[0]?.message ?? "bad input");
    }

    return {
      ok: true,
      data: {
        methods: [
          {
            name: "Zelle / Quickpay (preferred)",
            detail:
              `The donor logs in to their OWN bank or Zelle app and sends the payment to ${DONATION_EMAIL}. ` +
              "MASOM never asks for login details.",
          },
          {
            name: "Regular mail",
            detail: `Checks can be mailed to ${MAILING_ADDRESS}.`,
          },
        ],
        donationTypes: DONATION_PURPOSES.map((purpose) => purpose.label),
        memoNote:
          "For Sadaqa and Fitra, the donor should mention Syed or Non-Syed in the Zelle memo or on the check.",
        donatePath: siteConfig.links.donate,
        // Spec §32: no approved Zelle/Quickpay QR asset exists in this project,
        // so none is offered. Do not describe or invent one.
        paymentQrAvailable: false,
        rules: [
          "MASOM does NOT process payments on the website.",
          "NEVER ask for a card number, CVV, bank account number, routing number, online-banking password or Zelle login.",
          "If a visitor volunteers any of those, tell them not to share it and do not record it.",
          "The assistant can register the donor's information so the committee can follow up — that is NOT a payment.",
          `Always point the visitor to the Donate page (${siteConfig.links.donate}) alongside the payment methods.`,
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------
// registerDonationIntent — the ONLY write tool
// ---------------------------------------------------------------------------

/**
 * Stable key for one confirmed intent. Derived SERVER-side from the chat
 * session plus the normalized donor payload, so a repeated tool call (model
 * retry, double confirmation, network replay) collapses onto the same row via
 * the partial unique index instead of creating duplicates.
 */
function buildIdempotencyKey(
  sessionId: string,
  payload: { email: string; amount: string; donationType: string },
): string {
  return createHash("sha256")
    .update(
      [
        sessionId,
        payload.email.trim().toLowerCase(),
        payload.amount.trim(),
        payload.donationType.trim().toLowerCase(),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 48);
}

export const registerDonationIntentTool: AssistantTool = {
  definition: {
    name: "registerDonationIntent",
    description:
      "Register a visitor's donation information with MASOM so the committee can " +
      "follow up. This does NOT take or process any payment. Call it ONLY after you " +
      "have shown the visitor a summary of name, email, amount and donation type and " +
      "they have explicitly said yes. Never ask for card, CVV, bank account or " +
      "banking-login details — there is no field for them and they must not be collected.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Donor's full name." },
        email: { type: "string", description: "Donor's email address." },
        phone: { type: "string", description: "Donor's phone number (optional)." },
        amount: {
          type: "string",
          description: "Amount in US dollars as digits only, e.g. '100' or '50.50'.",
        },
        donationType: {
          type: "string",
          enum: DONATION_PURPOSES.map((purpose) => purpose.value),
          description: "Which MASOM donation type the donor chose.",
        },
        note: { type: "string", description: "Optional message from the donor." },
        confirmed: {
          type: "boolean",
          description:
            "Must be true, and only after the visitor explicitly confirmed the summary.",
        },
      },
      required: ["name", "email", "amount", "donationType", "confirmed"],
      additionalProperties: false,
    },
  },
  async execute(input, context) {
    const parsed = registerDonationIntentSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === "confirmed") {
        return {
          ok: false,
          error:
            "Not confirmed. Show the visitor a summary (name, email, amount, donation " +
            "type) and ask them to confirm before calling this tool again.",
        };
      }
      return invalidArguments(issue?.message ?? "bad input");
    }

    const data = parsed.data;
    const idempotencyKey = buildIdempotencyKey(context.sessionId, data);

    try {
      // Service-role client: the table has zero anon policies, so this is the
      // only write path and it exists solely on the server.
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("donation_intents").insert({
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone ?? null,
        amount: Number(data.amount),
        donation_type: data.donationType,
        note: data.note ?? null,
        source: "website-chatbot",
        // Registration only. Payment is always still outstanding here.
        status: "registered",
        idempotency_key: idempotencyKey,
        ip_hash: context.ipHash,
        user_agent: context.userAgent?.slice(0, 300) ?? null,
      });

      // 23505 = duplicate idempotency key: the same confirmed intent was
      // already stored. That is a success from the visitor's point of view.
      if (error && error.code !== "23505") throw error;

      return {
        ok: true,
        data: {
          registered: true,
          status: "registered",
          donationType: data.donationType,
          amount: data.amount,
          duplicate: error?.code === "23505",
          instruction:
            "Tell the visitor exactly: 'Your donation information has been registered.' " +
            "Then explain that MASOM has NOT taken any payment, and that they still need " +
            `to send it themselves via Zelle/Quickpay to ${DONATION_EMAIL} or by check to ` +
            `${MAILING_ADDRESS}. Also point them to the Donate page (${siteConfig.links.donate}) ` +
            "for the full details. Do NOT say 'your donation was received', 'payment " +
            "successful', 'paid', or anything implying money has changed hands.",
          paymentEmail: DONATION_EMAIL,
          mailingAddress: MAILING_ADDRESS,
          donatePath: siteConfig.links.donate,
        },
      };
    } catch (error) {
      logCmsError("assistant:registerDonationIntent", error);
      return {
        ok: false,
        error:
          "The registration could not be saved. Apologise, tell the visitor nothing was " +
          `recorded, and give them the Donate page (${siteConfig.links.donate}) and the ` +
          "Contact page instead.",
      };
    }
  },
};
