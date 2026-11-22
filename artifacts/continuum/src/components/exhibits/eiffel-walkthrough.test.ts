import test from "node:test";
import assert from "node:assert/strict";
import {
  BEAT_A_YIELD_SEC,
  BEAT_C_LOCK_SEC,
  CALIBRATED_PHOTO_CAMERAS,
  WALKTHROUGH_SCHEDULE,
  WALKTHROUGH_SPEED_MULTIPLIER,
  computeArchivalPlateRect,
  computePortalCanonicalCamera,
  computeStopCanonicalCamera,
  easeConstructionBeatB,
  interpolateCanonicalFlight,
} from "./eiffel-walkthrough";

test("all 11 archival stops have valid calibrated cameras and non-clipped centered plate rects", () => {
  const stageW = 1440;
  const stageH = 834;
  const archivalStops = WALKTHROUGH_SCHEDULE.filter((s) => s.photoId !== null);
  assert.equal(archivalStops.length, 11);

  for (const stop of archivalStops) {
    const id = stop.photoId!;
    assert.ok(CALIBRATED_PHOTO_CAMERAS[id], `missing calibrated camera for #${id}`);

    const rect = computeArchivalPlateRect(id, stageW, stageH);
    assert.ok(rect.w > 100 && rect.h > 100, `rect too small for #${id}`);
    assert.ok(rect.x >= 0 && rect.x + rect.w <= stageW + 1, `rect X clipped for #${id}`);
    assert.ok(rect.y >= 40 && rect.y + rect.h <= stageH, `rect Y clipped for #${id}`);

    const canonical = computePortalCanonicalCamera(id, stageW, stageH);
    assert.ok(Number.isFinite(canonical.tanHalfY) && canonical.tanHalfY > 0);
    assert.ok(Number.isFinite(canonical.shiftX) && Number.isFinite(canonical.shiftY));
    const qLen = Math.hypot(...canonical.quaternion);
    assert.ok(Math.abs(qLen - 1) < 1e-4, `quaternion not normalized for #${id}`);
  }
});

test("walkthrough pacing applies the 30% (1.3x) speed increase consistently", () => {
  assert.equal(WALKTHROUGH_SPEED_MULTIPLIER, 1.3);
  assert.ok(BEAT_A_YIELD_SEC < 0.7 && BEAT_A_YIELD_SEC > 0.5);
  assert.ok(BEAT_C_LOCK_SEC < 0.8 && BEAT_C_LOCK_SEC > 0.6);
  // Stop 1 flight was 8.8s -> 6.77s at 1.3x speed, with crisp <=0.4s settle into Beat A
  assert.ok(Math.abs(WALKTHROUGH_SCHEDULE[0].flightDurationSec - 6.77) < 0.05);
  assert.ok(WALKTHROUGH_SCHEDULE[0].holdDurationSec > 0 && WALKTHROUGH_SCHEDULE[0].holdDurationSec <= 0.4);
});

test("easeConstructionBeatB is C1 smooth, exact at endpoints, and strictly monotonic", () => {
  assert.equal(easeConstructionBeatB(0), 0);
  assert.equal(easeConstructionBeatB(1), 1);

  let prev = 0;
  for (let i = 1; i <= 50; i++) {
    const u = i / 50;
    const val = easeConstructionBeatB(u);
    assert.ok(val >= prev, `non-monotonic at u=${u}`);
    prev = val;
  }
});

test("Stop 1 (#55, step 11.0) -> Stop 2 (#13, step 0.55) performs axial rewind dive with exact endpoint locks", () => {
  const from = computeStopCanonicalCamera(1, 1440, 834);
  const to = computeStopCanonicalCamera(2, 1440, 834);

  const start = interpolateCanonicalFlight(from, to, 0, { fromPhotoId: "55", toPhotoId: "13" });
  const mid = interpolateCanonicalFlight(from, to, 0.5, { fromPhotoId: "55", toPhotoId: "13" });
  const end = interpolateCanonicalFlight(from, to, 1, { fromPhotoId: "55", toPhotoId: "13" });

  assert.deepEqual(start.position, from.position);
  assert.deepEqual(end.position, to.position);
  assert.equal(end.shiftX, to.shiftX);
  assert.equal(end.shiftY, to.shiftY);

  // Mid-flight glides down the central Champ-de-Mars axis well clear of piers
  assert.ok(mid.position[2] < from.position[2] && mid.position[2] > to.position[2]);
  assert.ok(Math.abs(mid.position[0]) < 15, `expected central axis glide, got x=${mid.position[0]}`);
  assert.ok(mid.tanHalfY > from.tanHalfY && mid.tanHalfY < to.tanHalfY);

  // Step rewinds cleanly from 11.0 down to 0.55
  const midStep = 11.0 + (0.55 - 11.0) * easeConstructionBeatB(0.5);
  assert.ok(midStep > 4.0 && midStep < 7.0, `unexpected mid-rewind step ${midStep}`);
});
