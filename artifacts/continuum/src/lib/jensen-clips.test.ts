import { strict as assert } from "node:assert";
import { test } from "node:test";
import { clipBounds, FULL_VIDEO_SELECTION, JENSEN_CLIPS, pickJensenClips, topicsInSelection } from "./jensen-clips.ts";

test("reviewed scenes have safe, ordered, non-overlapping source bounds", () => {
  let previousEnd = 0;
  for (const clip of JENSEN_CLIPS) {
    assert.ok(clip.start >= previousEnd);
    assert.ok(clip.end > clip.start + 2);
    assert.ok(clip.end < 60.998005);
    previousEnd = clip.end;
  }
});
test("specific timeline entries select relevant clips, never the whole source", () => {
  assert.deepEqual(pickJensenClips(["apology"]).clips.map(c => c.id), ["apology"]);
  assert.deepEqual(pickJensenClips(["meeting"]).clips.map(c => c.id), ["meeting", "dating"]);
  assert.deepEqual(pickJensenClips(["marriage"]).clips.map(c => c.id), ["wedding", "first-child", "family"]);
});
test("multi-entry selections deduplicate and play in video order", () => {
  assert.deepEqual(pickJensenClips(["family", "meeting", "marriage", "apology", "meeting"]).clips.map(c => c.id),
    ["meeting", "dating", "wedding", "first-child", "family", "apology"]);
  assert.deepEqual(pickJensenClips(["overview", "apology"]).clips.map(c => c.id), ["apology"]);
});
test("unmatched selections play the entire video while keeping context qualified", () => {
  const none = pickJensenClips(["philanthropy", "employees"]);
  assert.equal(none.mode, "full");
  assert.deepEqual(none.clips, FULL_VIDEO_SELECTION.clips);
  assert.equal(none.unmatched.length, 2);
  assert.equal(none.notes.length, 2);
  assert.equal(pickJensenClips(["investigation"]).clips[0].id, "later-relationship");
  assert.match(pickJensenClips(["investigation"]).notes[0], /does not show the board investigation/);
  assert.equal(pickJensenClips(["unrecognised", "constructor"]).mode, "full");
  assert.equal(pickJensenClips([]).mode, "full");
  assert.equal(pickJensenClips(["overview"]).mode, "full");
  assert.equal(pickJensenClips(["apology", "employees"]).mode, "clips");
});
test("selection geometry handles dates, multiple rows, scroll coordinates and incidental edges", () => {
  const candidates = [
    { topic: "meeting", bounds: { x: 300, y: 100, w: 600, h: 100 } },
    { topic: "marriage", bounds: { x: 300, y: 200, w: 600, h: 100 } },
    { topic: "philanthropy", bounds: { x: 300, y: 300, w: 600, h: 100 } },
  ];
  assert.deepEqual(topicsInSelection({ x: 310, y: 120, w: 70, h: 40 }, candidates), ["meeting"]);
  assert.deepEqual(topicsInSelection({ x: 310, y: 125, w: 200, h: 130 }, candidates), ["meeting", "marriage"]);
  assert.deepEqual(topicsInSelection({ x: 310, y: 210, w: 200, h: 91 }, candidates), ["marriage"]);
  assert.deepEqual(topicsInSelection({ x: 20, y: 110, w: 60, h: 70 }, candidates), []);
  assert.deepEqual(topicsInSelection({ x: 310, y: 120, w: 100, h: 50 },
    [{ topic: "leadership employees", bounds: candidates[0].bounds }]), ["leadership", "employees"]);
});
test("clip-local seek limits clamp to the actual media duration", () => {
  assert.deepEqual(clipBounds(JENSEN_CLIPS[0], 61), { start: 21, end: 25.4, length: 25.4 - 21 });
  assert.deepEqual(clipBounds(JENSEN_CLIPS[0], 24), { start: 21, end: 24, length: 3 });
  assert.deepEqual(clipBounds(FULL_VIDEO_SELECTION.clips[0], 60.998005), { start: 0, end: 60.998005, length: 60.998005 });
  assert.deepEqual(clipBounds(FULL_VIDEO_SELECTION.clips[0], NaN), { start: 0, end: 0, length: 0 });
});
