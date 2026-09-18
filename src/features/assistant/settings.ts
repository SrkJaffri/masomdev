import "server-only";

import { getPublicSiteSettings } from "@/features/site-settings/queries";

import { ASSISTANT_DEFAULTS } from "./config";
import type { AssistantSettings } from "./types";

/**
 * CMS-controlled assistant settings.
 *
 * Content only: enabled flag, display name and messages. Provider API keys are
 * NEVER read from or written to the CMS — they are server-side environment
 * variables (see `src/lib/ai/provider.ts`).
 */
export async function getAssistantSettings(): Promise<AssistantSettings> {
  const settings = await getPublicSiteSettings();

  return {
    enabled: settings.ai_assistant_enabled,
    name: settings.ai_assistant_name?.trim() || ASSISTANT_DEFAULTS.name,
    welcomeMessage:
      settings.ai_assistant_welcome_message?.trim() || ASSISTANT_DEFAULTS.welcomeMessage,
    fallbackMessage:
      settings.ai_assistant_fallback_message?.trim() || ASSISTANT_DEFAULTS.fallbackMessage,
  };
}
