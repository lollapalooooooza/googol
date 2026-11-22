import test from "node:test";
import assert from "node:assert/strict";
import {
  EIFFEL_GENIE_PRESETS,
  MARS_GENIE_PRESETS,
  isEiffelWorldContext,
  isMarsWorldContext,
  resolveWorldPresetGroup,
} from "./mars-genie-presets.ts";

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

test("EIFFEL_GENIE_PRESETS contains four distinct Eiffel Tower world experiences", () => {
  assert.equal(EIFFEL_GENIE_PRESETS.length, 4);
  const ids = EIFFEL_GENIE_PRESETS.map((p) => p.id);
  assert.deepEqual(ids, [
    "champ-de-mars-1889",
    "summit-breeze-sunset",
    "iron-construction-1888",
    "seine-night-sparkle",
  ]);
  for (const preset of EIFFEL_GENIE_PRESETS) {
    assert.ok(preset.imageUrl.includes("/eiffel-worlds/") && preset.imageUrl.endsWith(".jpg"));
    assert.ok(preset.worldPrompt.length > 120);
  }
});

test("isMarsWorldContext detects Mars tabs, prompts, and preset selections without matching Champ-de-Mars", () => {
  assert.equal(isMarsWorldContext({ pageTitle: "Mars" }), true);
  assert.equal(isMarsWorldContext({ customPrompt: "genie 火星水手号峡谷" }), true);
  assert.equal(isMarsWorldContext({ presetId: "olympus-lava-tube" }), true);
  assert.equal(isMarsWorldContext({ pageTitle: "Plant cell", selectedText: "Chloroplasts" }), false);
  // Regression: Eiffel Tower virtual tour mentions Champ-de-Mars and must NOT trigger Mars presets
  assert.equal(
    isMarsWorldContext({
      pageTitle: "eiffel tower",
      customPrompt: "Walk down the Champ-de-Mars esplanade toward the Eiffel Tower in 1889 Paris",
    }),
    false,
  );
});

test("isEiffelWorldContext and resolveWorldPresetGroup route Eiffel and Mars worlds accurately", () => {
  assert.equal(isEiffelWorldContext({ pageTitle: "eiffel tower" }), true);
  assert.equal(isEiffelWorldContext({ customPrompt: "埃菲尔铁塔夜景游船" }), true);
  assert.equal(isEiffelWorldContext({ presetId: "seine-night-sparkle" }), true);
  assert.equal(isEiffelWorldContext({ pageTitle: "Mars" }), false);

  const eiffelGroup = resolveWorldPresetGroup({
    pageTitle: "eiffel tower - Google Search",
    customPrompt: "Stroll along Champ-de-Mars beneath the iron arches",
  });
  assert.equal(eiffelGroup?.theme, "eiffel");
  assert.equal(eiffelGroup?.presets.length, 4);

  const marsGroup = resolveWorldPresetGroup({ pageTitle: "Mars" });
  assert.equal(marsGroup?.theme, "mars");
  assert.equal(marsGroup?.presets.length, 4);

  assert.equal(resolveWorldPresetGroup({ pageTitle: "Plant cell" }), null);
});
