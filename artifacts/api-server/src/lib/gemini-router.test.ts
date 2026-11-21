import test from "node:test";
import assert from "node:assert/strict";
import { buildFallbackWorldPrompt, selectGemini4Model } from "./gemini-router";

test("routes complex reasoning and analysis prompts to gemini-4-argon", () => {
  const en = selectGemini4Model("Compare the structural engineering trade-offs of the Eiffel Tower and modern steel skyscrapers");
  assert.equal(en.model, "gemini-4-argon");
  assert.equal(en.label, "Gemini 4 Argon");

  const zh = selectGemini4Model("请深度分析埃菲尔铁塔风荷载力学原理并对比传统石拱桥");
  assert.equal(zh.model, "gemini-4-argon");
});

test("routes quick lookups and short summaries to gemini-4-hydrogen", () => {
  const en = selectGemini4Model("What is the height of the Eiffel Tower?");
  assert.equal(en.model, "gemini-4-hydrogen");
  assert.equal(en.label, "Gemini 4 Hydrogen");

  const zh = selectGemini4Model("简短总结一下火星的大气成分");
  assert.equal(zh.model, "gemini-4-hydrogen");
});

test("respects explicit @argon / @hydrogen prefixes and preferredModel override", () => {
  const forcedArgon = selectGemini4Model("@argon hello there");
  assert.equal(forcedArgon.model, "gemini-4-argon");
  assert.equal(forcedArgon.cleanedPrompt, "hello there");

  const forcedHydrogen = selectGemini4Model("@hydrogen prove Fermat's theorem");
  assert.equal(forcedHydrogen.model, "gemini-4-hydrogen");
  assert.equal(forcedHydrogen.cleanedPrompt, "prove Fermat's theorem");

  const pref = selectGemini4Model("hi", "argon");
  assert.equal(pref.model, "gemini-4-argon");
});

test("buildFallbackWorldPrompt produces a continuous first-person POV world prompt", () => {
  const prompt = buildFallbackWorldPrompt({
    selectedText: "Champ-de-Mars iron tower in Paris 1889",
    pageTitle: "Eiffel Tower",
  });
  assert.match(prompt, /first-person/i);
  assert.match(prompt, /Champ-de-Mars/);
});
