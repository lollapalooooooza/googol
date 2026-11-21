import { strict as assert } from "node:assert";
import { test } from "node:test";
import { defaultBrowserBounds, fitBrowserBounds, resizeBrowserBounds, windowPadding } from "./browser-width-layout.ts";

test("default width preserves desktop and phone proportions", () => {
  assert.equal(defaultBrowserBounds(1000).w, 820);
  assert.equal(defaultBrowserBounds(400).w, 384);
});
test("right edge resizes without moving the left edge", () => {
  assert.deepEqual(resizeBrowserBounds({ x: 100, w: 800 }, "right", -200, 1200), { x: 100, w: 600 });
});
test("left edge resizes while the right edge stays anchored", () => {
  assert.deepEqual(resizeBrowserBounds({ x: 100, w: 800 }, "left", 200, 1200), { x: 300, w: 600 });
});
test("either edge stops at the usable minimum and viewport boundary", () => {
  for (const edge of ["left", "right"] as const) {
    for (const delta of [-10000, 10000]) {
      const b = resizeBrowserBounds({ x: 100, w: 800 }, edge, delta, 1200);
      assert.ok(b.w >= 420);
      assert.ok(b.x >= 12);
      assert.ok(b.x + b.w <= 1188);
    }
  }
});
test("a resized window remains on screen after viewport shrink", () => {
  for (const viewport of [320, 402, 768]) {
    const b = fitBrowserBounds({ x: 200, w: 1000 }, viewport);
    assert.ok(b.x >= windowPadding(viewport));
    assert.ok(b.x + b.w <= viewport - windowPadding(viewport) + 0.001);
  }
});
