import test from "node:test";
import assert from "node:assert/strict";
import { isNvdaStockVideoIntent } from "./nvda-stock-intent";

test("matches direct NVDA and stock queries", () => {
  for (const q of [
    "nvda stock",
    "NVDA",
    "stock",
    "stocks",
    "nvidia stock",
    "NVDA stock price",
    "show me nvda stock",
    "what happened to nvidia stock?",
    "stock reaction",
    "market cap",
    "share price",
    "英伟达股价",
    "看看股票",
    "nvda 走势",
    "@argon nvda stock",
  ]) {
    assert.equal(isNvdaStockVideoIntent(q), true, `Expected "${q}" to trigger NVDA stock video`);
  }
});

test("does not falsely match browser commands, URLs, or unrelated article questions", () => {
  for (const q of [
    "",
    "back",
    "close tab",
    "new tab",
    "select",
    "genie nvda stock trading floor",
    "virtual tour",
    "who is Lori Huang",
    "when was NVIDIA founded?",
    "summarize the board investigation",
    "https://en.wikipedia.org/wiki/Nvidia",
  ]) {
    assert.equal(isNvdaStockVideoIntent(q), false, `Expected "${q}" NOT to trigger NVDA stock video`);
  }
});
