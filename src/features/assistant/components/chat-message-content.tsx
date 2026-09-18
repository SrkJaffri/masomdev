"use client";

import Link from "next/link";
import { Fragment } from "react";

import {
  isAllowedLinkHref,
  parseAssistantMarkdown,
  type InlineNode,
} from "./message-format";

/**
 * Renders an assistant reply as React elements from the safe markdown subset
 * (see ./message-format). It never uses dangerouslySetInnerHTML and never
 * renders model-supplied HTML — malicious or unsupported markup degrades to
 * plain text. Allowed links render as next/link (internal) or a safe <a>
 * (approved MASOM https host); everything else stays literal text.
 *
 * The welcome message goes through the same component; it is CMS copy the
 * committee controls, and the same strict link policy applies to it.
 */
export function ChatMessageContent({ content }: { content: string }) {
  const blocks = parseAssistantMarkdown(content);

  return (
    <>
      {blocks.map((block, blockIndex) => {
        switch (block.kind) {
          case "orderedList":
            return (
              <ol
                key={blockIndex}
                className="my-1 list-decimal space-y-0.5 pl-5 marker:text-ink-500"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item.map(renderInline)}</li>
                ))}
              </ol>
            );
          case "bulletList":
            return (
              <ul
                key={blockIndex}
                className="my-1 list-disc space-y-0.5 pl-5 marker:text-ink-500"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item.map(renderInline)}</li>
                ))}
              </ul>
            );
          default: {
            // Paragraph: soft line breaks become <br/> at the recorded spots.
            return (
              <p key={blockIndex}>
                {block.inlines.map((node, inlineIndex) => (
                  <Fragment key={inlineIndex}>
                    {block.softBreaks.includes(inlineIndex) ? <br /> : null}
                    {renderInline(node)}
                  </Fragment>
                ))}
              </p>
            );
          }
        }
      })}
    </>
  );
}

function renderInline(node: InlineNode) {
  switch (node.kind) {
    case "bold":
      return <strong className="font-bold">{node.children.map(renderInline)}</strong>;
    case "link":
      return node.allowed ? (
        <SafeLink href={node.href}>{node.text}</SafeLink>
      ) : (
        // Disallowed or unsafe href: degrade to plain text, never an anchor.
        <span>{`${node.text} (${node.href})`}</span>
      );
    default:
      return <Fragment>{node.value}</Fragment>;
  }
}

function SafeLink({ href, children }: { href: string; children: string }) {
  if (href.startsWith("/")) {
    // Internal MASOM route: same tab, normal site navigation.
    return (
      <Link
        href={href}
        className="font-semibold text-brand-600 underline decoration-brand-400/60 underline-offset-2 transition-colors hover:text-brand-500"
      >
        {children}
      </Link>
    );
  }
  // Approved https://www.masom.com/… link: new tab with hardened rel.
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-brand-600 underline decoration-brand-400/60 underline-offset-2 transition-colors hover:text-brand-500"
    >
      {children}
    </a>
  );
}

export { isAllowedLinkHref };
