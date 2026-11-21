import test from "node:test";
import assert from "node:assert/strict";
import { MARS_GENIE_PRESETS, isMarsWorldContext } from "./mars-genie-presets.ts";

test("MARS_GENIE_PRESETS contains the four curated Mars world presets", () => {
  assert.equal(MARS_GENIE_PRESETS.length, 4);
  const ids = MARS_GENIE_PRESETS.map((p) => p.id);
  assert.deepEqual(ids, [
    "jezero-crater",
    "valles-marineris",
    "arcadia-outpost",
    "olympus-lava-tube",
  ]);
  for (const preset of MARS_GENIE_PRESETS) {
    assert.ok(preset.imageUrl.endsWith(".jpg"));
    assert.ok(preset.worldPrompt.length > 80);
  }
});

test("isMarsWorldContext detects Mars tabs, prompts, and preset selections", () => {
  assert.equal(isMarsWorldContext({ pageTitle: "Mars" }), true);
  assert.equal(isMarsWorldContext({ customPrompt: "genie 火星水手号峡谷" }), true);
  assert.equal(isMarsWorldContext({ presetId: "olympus-lava-tube" }), true);
  assert.equal(isMarsWorldContext({ pageTitle: "Plant cell", selectedText: "Chloroplasts" }), false);
});
