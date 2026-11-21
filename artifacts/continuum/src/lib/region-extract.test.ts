import test from "node:test";
import assert from "node:assert/strict";
import { mapKeyboardCodeToGenieAction, rectsIntersectArea } from "./region-extract";

test("maps WASD, Arrow keys, Space, and V accurately to Genie 4 inputs", () => {
  assert.equal(mapKeyboardCodeToGenieAction("KeyW"), "key_w");
  assert.equal(mapKeyboardCodeToGenieAction("KeyA"), "key_a");
  assert.equal(mapKeyboardCodeToGenieAction("KeyS"), "key_s");
  assert.equal(mapKeyboardCodeToGenieAction("KeyD"), "key_d");
  assert.equal(mapKeyboardCodeToGenieAction("ArrowUp"), "arrow_up");
  assert.equal(mapKeyboardCodeToGenieAction("ArrowDown"), "arrow_down");
  assert.equal(mapKeyboardCodeToGenieAction("ArrowLeft"), "arrow_left");
  assert.equal(mapKeyboardCodeToGenieAction("ArrowRight"), "arrow_right");
  assert.equal(mapKeyboardCodeToGenieAction("Space"), "space");
  assert.equal(mapKeyboardCodeToGenieAction("KeyV"), "voice");
  assert.equal(mapKeyboardCodeToGenieAction("KeyQ"), null);
});

test("rectsIntersectArea calculates overlap accurately and returns 0 when disjoint", () => {
  assert.equal(
    rectsIntersectArea({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 }),
    2500,
  );
  assert.equal(
    rectsIntersectArea({ x: 0, y: 0, w: 50, h: 50 }, { x: 60, y: 60, w: 50, h: 50 }),
    0,
  );
});
