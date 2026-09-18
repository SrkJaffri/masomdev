import "server-only";

import { getActiveAnnouncements } from "@/features/announcements/queries";
import { getUpcomingPrograms } from "@/features/programs/queries";

import { searchKnowledge } from "../knowledge";
import {
  getAnnouncementsSchema,
  getUpcomingProgramsSchema,
  searchSiteKnowledgeSchema,
} from "../schema";

import { type AssistantTool, invalidArguments } from "./types";

/**
 * Site-content tools: programs, announcements and the curated page knowledge.
 *
 * These read the SAME queries the website renders, so the assistant can never
 * describe a program or announcement that is not actually published.
 */

// ---------------------------------------------------------------------------
// getUpcomingPrograms
// ---------------------------------------------------------------------------

export const getUpcomingProgramsTool: AssistantTool = {
  definition: {
    name: "getUpcomingPrograms",
    description:
      "List MASOM's published upcoming programs and events (title, date, time, " +
      "location). Use for 'what programs are coming up', 'agla program kab hai', " +
      "majlis/jashn schedule questions. Never invent a program.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "How many upcoming programs to return (1-10). Default 5.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  async execute(input) {
    const parsed = getUpcomingProgramsSchema.safeParse(input);
    if (!parsed.success) {
      return invalidArguments(parsed.error.issues[0]?.message ?? "bad input");
    }

    const limit = parsed.data.limit ?? 5;
    const programs = await getUpcomingPrograms();

    if (programs.length === 0) {
      return {
        ok: true,
        data: {
          found: false,
          instruction:
            "MASOM has no upcoming programs published right now. Say so plainly and " +
            "suggest checking the Programs page later. Do NOT invent a program.",
          programsPath: "/programs",
        },
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        totalUpcoming: programs.length,
        // Only a bounded slice reaches the model — never the whole table.
        programs: programs.slice(0, limit).map((program) => ({
          title: program.title,
          date: program.startDate,
          time: program.timeLabel,
          location: program.location,
          description: program.description,
        })),
        programsPath: "/programs",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// getAnnouncements
// ---------------------------------------------------------------------------

export const getAnnouncementsTool: AssistantTool = {
  definition: {
    name: "getAnnouncements",
    description:
      "Get MASOM's currently active announcements (the notices shown on the website). " +
      "Use for 'any announcements?', 'koi nayi khabar hai?', or latest-news questions.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  async execute(input) {
    const parsed = getAnnouncementsSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return invalidArguments(parsed.error.issues[0]?.message ?? "bad input");
    }

    const announcements = await getActiveAnnouncements();

    if (announcements.length === 0) {
      return {
        ok: true,
        data: {
          found: false,
          instruction:
            "There are no active announcements right now. Say so plainly. Do NOT " +
            "repeat an old announcement or make one up.",
        },
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        announcements: announcements.slice(0, 10).map((item) => ({
          message: item.message,
          link: item.href,
          linkLabel: item.linkLabel,
        })),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// searchSiteKnowledge
// ---------------------------------------------------------------------------

export const searchSiteKnowledgeTool: AssistantTool = {
  definition: {
    name: "searchSiteKnowledge",
    description:
      "Search MASOM's website information: mission and goals, about/history, committee " +
      "members, sub-committees, contact details, address, membership and other forms, " +
      "donation methods, services, and which page covers what. Use this for anything " +
      "that is NOT a date, prayer timing, program or announcement.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "What the visitor is asking about, e.g. 'MASOM mission', 'president', " +
            "'address', 'membership form', 'how to donate'.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  async execute(input) {
    const parsed = searchSiteKnowledgeSchema.safeParse(input);
    if (!parsed.success) {
      return invalidArguments(parsed.error.issues[0]?.message ?? "bad input");
    }

    const matches = searchKnowledge(parsed.data.topic);

    if (matches.length === 0) {
      return {
        ok: true,
        data: {
          found: false,
          instruction:
            "MASOM's website information does not cover this. Say you do not have that " +
            "information and offer the Contact page or WhatsApp. Do NOT answer from your " +
            "own knowledge about MASOM.",
          contactPath: "/contacts",
        },
      };
    }

    return {
      ok: true,
      data: {
        found: true,
        sections: matches.map((match) => ({
          title: match.title,
          path: match.path,
          content: match.content,
        })),
        note:
          "Answer only from these sections. If they do not contain the answer, say so " +
          "instead of filling the gap.",
      },
    };
  },
};
