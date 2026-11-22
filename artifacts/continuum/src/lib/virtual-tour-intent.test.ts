import assert from "node:assert/strict";
import test from "node:test";
import { buildVirtualTourRequest, isVirtualTourIntent } from "./virtual-tour-intent";

test("detects exact and conversational English virtual tour requests", () => {
  const positives = [
    "virtual tour",
    "Virtual Tour",
    "start a virtual tour",
    "can you take me on a virtual tour?",
    "Give me a 3D tour of the Eiffel Tower",
    "vr tour",
    "guided tour please",
    "walk around underneath the tower",
    "walk inside",
    "step inside the tower",
    "enter world mode",
    "launch world modal",
    "immerse me",
    "tour the tower",
  ];

  for (const input of positives) {
    assert.equal(isVirtualTourIntent(input), true, `Expected virtual tour intent for: "${input}"`);
  }
});

test("detects fuzzy misspellings of virtual tour", () => {
  const typos = [
    "virtul tour",
    "vritual tour",
    "virutal tuor",
    "vitual tor",
    "please start a virtal tour now",
  ];

  for (const input of typos) {
    assert.equal(isVirtualTourIntent(input), true, `Expected fuzzy match for typo: "${input}"`);
  }
});

test("detects Chinese virtual tour and walkthrough intents", () => {
  const chinesePositives = [
    "虚拟游览",
    "虚拟漫游",
    "开启虚拟游览",
    "我想进去看看",
    "带我逛逛铁塔",
    "身临其境体验一下",
    "进入世界模型",
    "实景漫游",
    "游览铁塔",
  ];

  for (const input of chinesePositives) {
    assert.equal(isVirtualTourIntent(input), true, `Expected Chinese virtual tour intent for: "${input}"`);
  }
});

test("does not falsely trigger on normal questions or browser commands", () => {
  const negatives = [
    "",
    "   ",
    "plant cell",
    "eiffel tower",
    "when was the eiffel tower built?",
    "how tall is the eiffel tower",
    "who designed your tower",
    "what is a plant cell",
    "open Plant cell",
    "search beaver dam",
    "back",
    "help",
    "埃菲尔铁塔多高",
    "什么是植物细胞",
  ];

  for (const input of negatives) {
    assert.equal(isVirtualTourIntent(input), false, `Expected NOT virtual tour for: "${input}"`);
  }
});

test("builds rich 1889 Paris virtual tour prompt when launched from Eiffel exhibition", () => {
  const seed = buildVirtualTourRequest({ isEiffel: true, rawInput: "virtual tour" });
  assert.equal(seed.pageTitle, "Eiffel Tower — 1889 Paris");
  assert.match(seed.sourceLabel, /Virtual Tour/i);
  assert.match(seed.customPrompt, /Champ-de-Mars/i);
  assert.match(seed.customPrompt, /1889/);
});
