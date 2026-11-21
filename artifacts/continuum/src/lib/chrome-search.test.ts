import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchIntent,
  resolveChromeVisualization,
  getCuratedChromeContent,
  computeCenteredPlateRect,
  pickBestImageForMarquee,
  EIFFEL_PLATE_ASPECT,
} from "./chrome-search";

test("normalizes 'effie tower' and common variants to Eiffel Tower exhibit", () => {
  const typo = normalizeSearchIntent("effie tower");
  assert.equal(typo.effectiveQuery, "Eiffel Tower");
  assert.equal(typo.correctedFrom, "effie tower");
  assert.equal(typo.matchedExhibit, "eiffel");
  assert.equal(typo.wikiTitle, "Eiffel Tower");

  const exact = normalizeSearchIntent("Eiffel Tower");
  assert.equal(exact.effectiveQuery, "Eiffel Tower");
  assert.equal(exact.correctedFrom, null);
  assert.equal(exact.matchedExhibit, "eiffel");

  const zh = normalizeSearchIntent("埃菲尔铁塔");
  assert.equal(zh.matchedExhibit, "eiffel");
});

test("resolves Chrome visualizations for known exhibits and returns null for unknown queries", () => {
  assert.equal(resolveChromeVisualization("effie tower"), "eiffel");
  assert.equal(resolveChromeVisualization("mars"), "mars");
  assert.equal(resolveChromeVisualization("plant cell"), "plant-cell");
  assert.equal(resolveChromeVisualization("neuron"), "neuron");
  assert.equal(resolveChromeVisualization("jensen huang"), "jensen-video");
  assert.equal(resolveChromeVisualization("quantum chromodynamics"), null);
});

test("Eiffel Tower SERP content leads with the uncropped 1884 elevation plate and knowledge panel", () => {
  const content = getCuratedChromeContent(normalizeSearchIntent("effie tower"));
  assert.ok(content.images.length >= 4);
  assert.equal(content.images[0]?.id, "eiffel-plate");
  assert.ok(content.images[0]?.src.includes("55_elevation_plate.jpg"));
  assert.equal(content.knowledge?.title, "Eiffel Tower");
  assert.ok(content.results.some((r) => r.wikiTitle === "Eiffel Tower"));
  assert.ok(content.results.some((r) => r.viewModel === "eiffel"));
});

test("computeCenteredPlateRect centers the 1884 plate with intact aspect ratio above bottom timeline", () => {
  const rect = computeCenteredPlateRect(1440, 900);
  assert.ok(rect.w > 200 && rect.h > 400);
  assert.ok(Math.abs(rect.w / rect.h - EIFFEL_PLATE_ASPECT) < 0.02);
  assert.ok(Math.abs((rect.x + rect.w / 2) - 720) <= 2);
  assert.ok(rect.y >= 24 && rect.y + rect.h <= 900 - 80);
});

test("pickBestImageForMarquee picks the candidate with largest overlap area", () => {
  const chosen = pickBestImageForMarquee(
    { x: 100, y: 100, w: 120, h: 180 },
    [
      { id: "a", rect: { x: 400, y: 100, w: 100, h: 100 } },
      { id: "b", rect: { x: 90, y: 90, w: 140, h: 200 } },
    ],
  );
  assert.equal(chosen?.id, "b");
  assert.equal(pickBestImageForMarquee({ x: 0, y: 0, w: 20, h: 20 }, [{ id: "a", rect: { x: 200, y: 200, w: 50, h: 50 } }]), null);
});
