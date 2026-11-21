import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTPOST_COLLIDERS,
  OUTPOST_PADS,
  WORLD_PLAY_RADIUS,
  clampOutpostTarget,
  isClearedForOutpost,
  marsHeightAt,
  marsNormalAt,
  sampleRoverTrack,
} from "./mars-terrain.ts";
import { LANDMARK_ORDER, OUTPOST_ZONES } from "./mars-data.ts";

test("outpost pads stay leveled flat across structure footprints", () => {
  for (const pad of OUTPOST_PADS) {
    const centerH = marsHeightAt(pad.x, pad.z);
    assert.ok(Math.abs(centerH - pad.baseHeight) < 0.06, `${pad.id} center should sit at baseHeight`);
    const rimH = marsHeightAt(pad.x + pad.flatRadius * 0.65, pad.z);
    assert.ok(Math.abs(rimH - pad.baseHeight) < 0.06, `${pad.id} inner pad should remain flat`);
  }
});

test("terrain normal points upward across the basin", () => {
  for (const [x, z] of [[0, 0], [12.5, 6.5], [-2, -26], [-18, 12], [28, -22]]) {
    const [nx, ny, nz] = marsNormalAt(x, z);
    const len = Math.hypot(nx, ny, nz);
    assert.ok(Math.abs(len - 1) < 1e-4);
    assert.ok(ny > 0.7, `expected upward normal at (${x}, ${z}), got ${ny}`);
  }
});

test("rover patrol loop is continuous, finite, and grounded on terrain", () => {
  const samples = Array.from({ length: 24 }, (_, i) => sampleRoverTrack(i / 24));
  for (const s of samples) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z));
    assert.ok(Number.isFinite(s.headingRad) && Number.isFinite(s.pitchRad) && Number.isFinite(s.rollRad));
    assert.ok(Math.abs(s.y - marsHeightAt(s.x, s.z)) < 1e-6);
    assert.ok(Math.abs(s.pitchRad) < 0.5 && Math.abs(s.rollRad) < 0.5);
  }
  const wrapStart = sampleRoverTrack(0);
  const wrapEnd = sampleRoverTrack(1);
  assert.ok(Math.hypot(wrapStart.x - wrapEnd.x, wrapStart.z - wrapEnd.z) < 1e-5);
});

test("rock exclusion zones clear pads and main rover track", () => {
  assert.equal(isClearedForOutpost(12.5, 6.5), true);
  assert.equal(isClearedForOutpost(-2.0, -26.0), true);
  assert.equal(isClearedForOutpost(-1.6, 0.0), true);
  assert.equal(isClearedForOutpost(-34, 24), false);
});

test("camera target clamping prevents clipping into buildings and keeps basin bounds", () => {
  for (const col of OUTPOST_COLLIDERS) {
    const clamped = clampOutpostTarget(col.x + 0.1, col.z + 0.1, 1.0);
    const dist = Math.hypot(clamped.x - col.x, clamped.z - col.z);
    assert.ok(dist >= col.radius + 0.99, `expected target pushed outside ${col.id}`);
  }
  const far = clampOutpostTarget(120, -120);
  assert.ok(Math.hypot(far.x, far.z) <= WORLD_PLAY_RADIUS + 1e-6);
});

test("all camera presets target unobstructed valid positions", () => {
  assert.ok(LANDMARK_ORDER.length >= 5);
  for (const id of LANDMARK_ORDER) {
    const zone = OUTPOST_ZONES[id];
    assert.ok(zone.name.length > 0 && zone.specs.length >= 3);
    assert.ok(zone.cameraPos[1] > marsHeightAt(zone.cameraPos[0], zone.cameraPos[2]));
  }
});
