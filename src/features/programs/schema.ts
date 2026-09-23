import { z } from "zod";

import {
  boolFromForm,
  optionalDate,
  optionalHttpUrl,
  optionalText,
  optionalTime,
  requiredDate,
  requiredText,
  sortOrderFromForm,
  type ProgramFormEcho,
} from "@/lib/cms/validation";

/**
 * Text/date fields of the Program form (the poster file is validated
 * separately). Shared by the server action (parse + validate) and the client
 * (echoed values → controlled defaults after a validation error), so both
 * sides always agree on field names and transforms.
 */
export const programFormSchema = z
  .object({
    title: requiredText(200),
    description: optionalText(4000),
    start_date: requiredDate,
    end_date: optionalDate,
    start_time: optionalTime,
    end_time: optionalTime,
    location: optionalText(300),
    link_url: optionalHttpUrl,
    is_published: boolFromForm,
    sort_order: sortOrderFromForm,
  })
  .refine((values) => !values.end_date || values.end_date >= values.start_date, {
    message: "End date cannot be before the start date.",
    path: ["end_date"],
  });

export type ProgramFormValues = z.infer<typeof programFormSchema>;

/**
 * Normalizes arbitrary form entries into the string echo shape sent back to
 * the client on a validation error. Unknown/malformed entries become "" (or
 * "0" for sort order), matching what an untouched field would contain.
 */
export function programFormEchoFrom(
  source: Record<string, unknown>,
): ProgramFormEcho {
  const text = (key: string): string => {
    const value = source[key];
    return typeof value === "string" ? value : "";
  };
  const sortOrder = source.sort_order;
  const rawPublished = source.is_published;
  return {
    title: text("title"),
    description: text("description"),
    start_date: text("start_date"),
    end_date: text("end_date"),
    start_time: text("start_time"),
    end_time: text("end_time"),
    location: text("location"),
    link_url: text("link_url"),
    sort_order:
      typeof sortOrder === "string" && sortOrder.trim() !== "" ? sortOrder : "0",
    // Mirrors boolFromForm's form-value semantics ("on" from the checkbox).
    is_published:
      rawPublished === true || rawPublished === "true" || rawPublished === "on",
  };
}

export type { ProgramFormEcho };
