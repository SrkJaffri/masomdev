import "server-only";

import type { AiToolDefinition } from "@/lib/ai/types";

import type { ToolResult } from "../types";

import {
  findCalendarEventTool,
  getHijriMonthDatesTool,
  getPrayerTimesTool,
} from "./calendar";
import {
  getAnnouncementsTool,
  getUpcomingProgramsTool,
  searchSiteKnowledgeTool,
} from "./content";
import { getDonationInfoTool, registerDonationIntentTool } from "./donation";
import type { AssistantTool, ToolContext } from "./types";

/**
 * The COMPLETE set of capabilities exposed to the model.
 *
 * Anything not in this registry is unreachable: there is no SQL tool, no file
 * tool, no shell tool, no HTTP tool, and no admin tool. Every entry takes fixed
 * typed arguments that are re-validated with zod before any query runs.
 *
 * Exactly one tool writes (registerDonationIntent); the rest are reads of
 * already-public website content.
 */
const ASSISTANT_TOOLS: AssistantTool[] = [
  // Structured facts first — these must win over prose for any MASOM date.
  findCalendarEventTool,
  getPrayerTimesTool,
  getHijriMonthDatesTool,
  getUpcomingProgramsTool,
  getAnnouncementsTool,
  getDonationInfoTool,
  searchSiteKnowledgeTool,
  registerDonationIntentTool,
];

const TOOL_BY_NAME = new Map(ASSISTANT_TOOLS.map((tool) => [tool.definition.name, tool]));

export function getToolDefinitions(): AiToolDefinition[] {
  return ASSISTANT_TOOLS.map((tool) => tool.definition);
}

/**
 * Runs a model-requested tool. An unknown name is reported back to the model
 * as a normal tool error — it never throws and never falls through to some
 * other execution path.
 */
export async function executeTool(
  name: string,
  input: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) {
    return {
      ok: false,
      error: `Unknown tool "${name}". Only the listed MASOM tools are available.`,
    };
  }
  return tool.execute(input, context);
}

export type { AssistantTool, ToolContext };
