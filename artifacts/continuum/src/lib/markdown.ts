export type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; label: string; href: string };

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; tokens: InlineToken[] }
  | { type: "paragraph"; tokens: InlineToken[] }
  | { type: "ul"; items: InlineToken[][] }
  | { type: "ol"; items: InlineToken[][] }
  | { type: "blockquote"; tokens: InlineToken[] };

const SAFE_URL_RE = /^https?:\/\/[^\s<>"']+$/i;

/**
 * Parses inline markdown syntax (`**bold**`, `__bold__`, `*italic*`, `` `code` ``,
 * and `[label](https://...)`) into safe structured tokens without raw HTML.
 */
export function parseInlineMarkdown(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern =
    /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(__[^_\n]+?__)|(\[([^\]\n]+)\]\(([^)\s]+)\))|(\*[^*\n]+?\*)|(_[^_\n]+?_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: input.slice(lastIndex, match.index) });
    }

    const [full, codeMatch, boldStar, boldUnder, linkFull, linkLabel, linkHref, italicStar, italicUnder] = match;

    if (codeMatch) {
      tokens.push({ type: "code", text: codeMatch.slice(1, -1) });
    } else if (boldStar) {
      tokens.push({ type: "bold", text: boldStar.slice(2, -2) });
    } else if (boldUnder) {
      tokens.push({ type: "bold", text: boldUnder.slice(2, -2) });
    } else if (linkFull && linkLabel && linkHref) {
      if (SAFE_URL_RE.test(linkHref)) {
        tokens.push({ type: "link", label: linkLabel, href: linkHref });
      } else {
        tokens.push({ type: "text", text: linkLabel });
      }
    } else if (italicStar) {
      tokens.push({ type: "italic", text: italicStar.slice(1, -1) });
    } else if (italicUnder) {
      tokens.push({ type: "italic", text: italicUnder.slice(1, -1) });
    } else {
      tokens.push({ type: "text", text: full });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: "text", text: input.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", text: input }];
}

/**
 * Parses a Markdown response string into clean block elements (headings,
 * paragraphs, unordered/ordered lists, and blockquotes) for user-friendly display.
 */
export function parseMarkdownBlocks(raw: string): MarkdownBlock[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Heading (#, ##, ###)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
      blocks.push({
        type: "heading",
        level,
        tokens: parseInlineMarkdown(headingMatch[2].trim()),
      });
      i++;
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        tokens: parseInlineMarkdown(quoteLines.join(" ").trim()),
      });
      continue;
    }

    // Unordered list (- item, * item, • item)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: InlineToken[][] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*•]\s+/, "");
        items.push(parseInlineMarkdown(itemText));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list (1. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: InlineToken[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(parseInlineMarkdown(itemText));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph (join consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("> ")
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        tokens: parseInlineMarkdown(paraLines.join(" ")),
      });
    }
  }

  return blocks;
}
