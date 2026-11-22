import { Fragment } from "react";
import { parseMarkdownBlocks, type InlineToken } from "@/lib/markdown";

function renderInline(tokens: InlineToken[]) {
  return tokens.map((token, idx) => {
    switch (token.type) {
      case "bold":
        return (
          <strong key={idx} className="font-semibold text-[#15181e]">
            {token.text}
          </strong>
        );
      case "italic":
        return (
          <em key={idx} className="italic text-[#2c303a]">
            {token.text}
          </em>
        );
      case "code":
        return (
          <code
            key={idx}
            className="rounded-[4px] bg-[#eef1f6] px-1.5 py-[1px] font-mono text-[11.5px] text-[#1d2330]"
          >
            {token.text}
          </code>
        );
      case "link":
        return (
          <a
            key={idx}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#1a56c4] underline decoration-[#1a56c4]/40 underline-offset-2 hover:decoration-[#1a56c4]"
          >
            {token.label}
          </a>
        );
      default:
        return <Fragment key={idx}>{token.text}</Fragment>;
    }
  });
}

export function MarkdownContent({
  content,
  testid = "text-ai-answer",
}: {
  content: string;
  testid?: string;
}) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-2.5 text-[13px] leading-[1.62] text-[#24272d]" data-testid={testid}>
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          const sizeCls =
            block.level === 1
              ? "text-[14.5px] font-semibold text-[#14171d]"
              : block.level === 2
                ? "text-[13.5px] font-semibold text-[#161920]"
                : "text-[13px] font-semibold text-[#1c2029]";
          return (
            <h4 key={idx} className={`${sizeCls} pt-0.5`}>
              {renderInline(block.tokens)}
            </h4>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-[#c8d4ea] pl-3 text-[12.5px] text-[#4c5360]"
            >
              {renderInline(block.tokens)}
            </blockquote>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={idx} className="space-y-1.5 pl-4 list-disc marker:text-[#8a92a3]">
              {block.items.map((itemTokens, itemIdx) => (
                <li key={itemIdx} className="pl-0.5">
                  {renderInline(itemTokens)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={idx} className="space-y-1.5 pl-5 list-decimal marker:text-[#6b7280] marker:font-medium">
              {block.items.map((itemTokens, itemIdx) => (
                <li key={itemIdx} className="pl-0.5">
                  {renderInline(itemTokens)}
                </li>
              ))}
            </ol>
          );
        }

        return <p key={idx}>{renderInline(block.tokens)}</p>;
      })}
    </div>
  );
}
