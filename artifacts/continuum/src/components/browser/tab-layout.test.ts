import { strict as assert } from "node:assert";
import { test } from "node:test";
import { tabLayout } from "./tab-layout.ts";

test("a few tabs stay capped instead of stretching across the header", () => {
  assert.equal(tabLayout(1148, 4).width, 230);
  assert.equal(tabLayout(1148, 4).overflow, false);
});
test("tabs shrink evenly before scrolling is introduced", () => {
  const sizes = [4, 8, 12, 16].map((count) => tabLayout(1148, count));
  sizes.forEach((layout, index) => {
    assert.equal(layout.overflow, false);
    if (index) assert.ok(layout.width < sizes[index - 1].width);
  });
});
test("four tabs fit into a phone header without hiding the new-tab button", () => {
  const { width, overflow } = tabLayout(286, 4);
  assert.equal(overflow, false);
  assert.ok(width >= 56);
  assert.ok(width * 4 + 12 + 38 <= 286);
});
test("very crowded headers keep usable minimum widths and enable overflow", () => {
  for (const available of [286, 768, 1148]) {
    const layout = tabLayout(available, 100);
    assert.equal(layout.width, 56);
    assert.equal(layout.overflow, true);
  }
});
test("empty and unmeasured headers never produce invalid widths", () => {
  for (const available of [0, 150, 1148]) {
    const layout = tabLayout(available, 0);
    assert.ok(Number.isFinite(layout.width));
    assert.equal(layout.overflow, false);
  }
});
