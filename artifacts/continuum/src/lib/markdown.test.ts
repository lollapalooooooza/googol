import test from "node:test";
import assert from "node:assert/strict";
import { parseInlineMarkdown, parseMarkdownBlocks } from "./markdown";

test("parseInlineMarkdown converts **bold**, *italic*, and `code` into structured tokens", () => {
  const tokens = parseInlineMarkdown("A **plant cell** has a *vacuole* and `cellulose` wall.");
  assert.deepEqual(tokens, [
    { type: "text", text: "A " },
    { type: "bold", text: "plant cell" },
    { type: "text", text: " has a " },
    { type: "italic", text: "vacuole" },
    { type: "text", text: " and " },
    { type: "code", text: "cellulose" },
    { type: "text", text: " wall." },
  ]);
});

test("parseInlineMarkdown supports Chinese bold phrases without leaving raw ** markers", () => {
  const tokens = parseInlineMarkdown("**叶绿体**负责光合作用，**液泡**维持细胞膨压。");
  assert.equal(tokens.filter((t) => t.type === "bold").length, 2);
  assert.equal(
    tokens.some((t) => t.type === "text" && t.text.includes("**")),
    false,
  );
});

test("parseInlineMarkdown allows https links and strips unsafe javascript: URLs", () => {
  const safe = parseInlineMarkdown("Read [Wikipedia](https://en.wikipedia.org/wiki/Plant_cell)");
  assert.deepEqual(safe[1], {
    type: "link",
    label: "Wikipedia",
    href: "https://en.wikipedia.org/wiki/Plant_cell",
  });

  const unsafe = parseInlineMarkdown("Click [here](javascript:alert(1))");
  assert.deepEqual(unsafe[1], { type: "text", text: "here" });
});

test("parseMarkdownBlocks structures headings, unordered lists, ordered lists, and paragraphs", () => {
  const md = [
    "### Key Organelles",
    "",
    "Plant cells contain specialized structures:",
    "",
    "- **Chloroplasts**: convert sunlight into chemical energy",
    "- **Cell wall**: provides rigid structural support",
    "",
    "1. First phase",
    "2. Second phase",
  ].join("\n");

  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[1].type, "paragraph");
  assert.equal(blocks[2].type, "ul");
  if (blocks[2].type === "ul") {
    assert.equal(blocks[2].items.length, 2);
    assert.deepEqual(blocks[2].items[0][0], { type: "bold", text: "Chloroplasts" });
  }
  assert.equal(blocks[3].type, "ol");
  if (blocks[3].type === "ol") {
    assert.equal(blocks[3].items.length, 2);
  }
});
