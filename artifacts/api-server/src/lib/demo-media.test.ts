import test from "node:test";
import assert from "node:assert/strict";
import { byteRange, openDemoMedia, resolveLocalMediaPath } from "./demo-media";

async function collectBytes(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

test("resolves bundled Jensen Huang video and poster from local media storage", async () => {
  const videoPath = resolveLocalMediaPath("jensen-timeline.mp4");
  const posterPath = resolveLocalMediaPath("jensen-poster.jpg");
  assert.ok(videoPath && videoPath.endsWith("jensen-timeline.mp4"));
  assert.ok(posterPath && posterPath.endsWith("jensen-poster.jpg"));

  const video = openDemoMedia("jensen-timeline.mp4");
  const [videoMeta] = await video.getMetadata();
  const size = Number(videoMeta.size);
  assert.ok(size > 1_000_000);

  const header = await collectBytes(video.createReadStream({ start: 0, end: 11 }));
  assert.equal(header.length, 12);
  assert.equal(header.subarray(4, 8).toString("ascii"), "ftyp");

  const poster = openDemoMedia("jensen-poster.jpg");
  const [posterMeta] = await poster.getMetadata();
  assert.ok(Number(posterMeta.size) > 10_000);
  const jpegSig = await collectBytes(poster.createReadStream({ start: 0, end: 1 }));
  assert.equal(jpegSig[0], 0xff);
  assert.equal(jpegSig[1], 0xd8);
});

test("byteRange handles open-ended, bounded, suffix, and invalid HTTP ranges", () => {
  assert.equal(byteRange(undefined, 1000), null);
  assert.deepEqual(byteRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(byteRange("bytes=500-", 1000), { start: 500, end: 999 });
  assert.deepEqual(byteRange("bytes=-200", 1000), { start: 800, end: 999 });
  assert.equal(byteRange("bytes=1000-1005", 1000), false);
  assert.equal(byteRange("bytes=50-20", 1000), false);
});
