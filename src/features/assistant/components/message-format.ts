/**
 * A tiny, deterministic renderer for a SAFE subset of Markdown that the
 * MASOM Assistant is allowed to use in its replies.
 *
 * Why hand-rolled: the assistant's output is model-generated, so the renderer
 * must never interpret model text as HTML (there is no dangerouslySetInnerHTML
 * anywhere in this feature) and must never turn model-supplied URLs into
 * arbitrary links. This module produces a fixed block/inline tree that the
 * chat UI maps to React elements; nothing here touches innerHTML.
 *
 * Supported subset (everything else is plain text):
 *   **bold**                       → <strong>
 *   [text](/internal-path)         → internal link (allowed paths only)
 *   [text](https://www.masom.com/…)
 *                                  → approved-host link
 *   blank-line separated paragraphs, soft line breaks,
 *   "1. " ordered lists and "- " bullet lists.
 *
 * Malformed markdown never throws — unterminated bold/link syntax falls back
 * to readable plain text.
 */

// ---------------------------------------------------------------------------
// Link policy — the ONLY hrefs that may become clickable
// ---------------------------------------------------------------------------

/**
 * Internal paths the assistant is allowed to link to. The model is told about
 * these in the system prompt and the tools return them, but the policy is
 * enforced HERE, not by trusting the model.
 */
const ALLOWED_INTERNAL_PATHS = [
  "/donate",
  "/contacts",
  "/contact-us",
  "/events-schedule",
  "/hijricalendar2026",
  "/multimedia",
  "/online-forms",
  "/mis",
  "/about-us",
] as const;

/**
 * A link is clickable only when the href is:
 *   A. one of the approved internal paths (exact or with a trailing
 *      anchor/query), or
 *   B. an HTTPS URL on the MASOM production host (or its www-less form).
 *
 * Everything else — including javascript:, data:, vbscript:, file:, //,
 * other hosts, and malformed URLs — is rendered as literal text and can
 * never become an anchor.
 */
export function isAllowedLinkHref(href: string): boolean {
  const trimmed = href.trim();

  if (/^javascript:|^data:|^vbscript:|^file:/i.test(trimmed)) return false;

  if (trimmed.startsWith("/")) {
    const path = trimmed.split(/[?#]/, 1)[0];
    return (ALLOWED_INTERNAL_PATHS as readonly string[]).includes(path);
  }

  // Approved external host, HTTPS only.
  try {
    const url = new URL(trimmed);
    return (
      url.protocol === "https:" &&
      (url.hostname === "www.masom.com" || url.hostname === "masom.com")
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Inline parsing (bold + links)
// ---------------------------------------------------------------------------

export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: InlineNode[] }
  | { kind: "link"; href: string; text: string; allowed: boolean };

/**
 * Parse one line's inline content. `**` is matched first; inside bold text
 * links are not re-parsed (the model is told not to nest them, and
 * mis-nested input degrades to plain text instead of breaking).
 */
function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // First **…**, then […](…) — repeatedly, always resuming after the match.
  const pattern = /\*\*([^*]+)\*\*|\[([^\]\n]+)\]\(([^()\s]+)\)/g;

  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > cursor) {
      nodes.push({ kind: "text", value: line.slice(cursor, match.index) });
    }
    if (match[1] !== undefined) {
      nodes.push({ kind: "bold", children: [{ kind: "text", value: match[1] }] });
    } else {
      const href = match[3];
      nodes.push({
        kind: "link",
        href,
        text: match[2],
        allowed: isAllowedLinkHref(href),
      });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) {
    nodes.push({ kind: "text", value: line.slice(cursor) });
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Block parsing (paragraphs, breaks, lists)
// ---------------------------------------------------------------------------

export type BlockNode =
  | { kind: "paragraph"; inlines: InlineNode[]; softBreaks: number[] }
  | { kind: "orderedList"; items: InlineNode[][] }
  | { kind: "bulletList"; items: InlineNode[][] };

const ORDERED_ITEM = /^\d{1,2}[.)]\s+(.*)$/;
const BULLET_ITEM = /^[-*]\s+(.*)$/;

/**
 * Parse an assistant reply into blocks. Input is already length-capped by the
 * server (`ASSISTANT_LIMITS.maxTokens`), so this linear scan is bounded.
 */
export function parseAssistantMarkdown(source: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  // Split into blank-line separated chunks; each chunk is a paragraph or a
  // list. Soft (single) line breaks inside a chunk stay in that paragraph.
  const chunks = source.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) continue;

    const orderedLines = lines.filter((line) => ORDERED_ITEM.test(line.trim()));
    const bulletLines = lines.filter((line) => BULLET_ITEM.test(line.trim()));

    // A chunk counts as a list only when it is predominantly list items, so a
    // stray "- " inside prose still reads as prose.
    if (orderedLines.length >= 2 && orderedLines.length >= lines.length - 1) {
      blocks.push({
        kind: "orderedList",
        items: lines
          .map((line) => line.trim())
          .filter((line) => ORDERED_ITEM.test(line))
          .map((line) => parseInline(line.replace(ORDERED_ITEM, "$1"))),
      });
      continue;
    }
    if (bulletLines.length >= 2 && bulletLines.length >= lines.length - 1) {
      blocks.push({
        kind: "bulletList",
        items: lines
          .map((line) => line.trim())
          .filter((line) => BULLET_ITEM.test(line))
          .map((line) => parseInline(line.replace(BULLET_ITEM, "$1"))),
      });
      continue;
    }

    // Paragraph with the positions of its soft line breaks (for <br/>s).
    const inlines: InlineNode[] = [];
    const softBreaks: number[] = [];
    lines.forEach((line, index) => {
      if (index > 0) softBreaks.push(inlines.length);
      inlines.push(...parseInline(line.trim()));
    });
    blocks.push({ kind: "paragraph", inlines, softBreaks });
  }

  return blocks;
}
