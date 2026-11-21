import { strict as assert } from "node:assert";
import { test } from "node:test";
import { once } from "node:events";
import { PassThrough, Readable, Writable, pipeline } from "node:stream";
import { pipeMediaStream } from "./pipe-media.ts";

test("normal media streams reach the response completely", async () => {
  const chunks = [];
  const response = new Writable({ write(chunk, _encoding, cb) { chunks.push(chunk); cb(); } });
  const finished = once(response, "finish");
  pipeMediaStream(Readable.from(["first", "second"]), response, assert.fail);
  await finished;
  assert.equal(Buffer.concat(chunks).toString(), "firstsecond");
});

test("early disconnection waits for the SDK pipeline before destroying it", async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  const closed = once(source, "close");
  pipeMediaStream(source, response, assert.fail);
  response.destroy();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(source.destroyed, false);
  // This is the SDK's delayed onResponse callback that used to crash Node.
  pipeline(Readable.from(["first byte"]), source, () => {});
  await closed;
  assert.equal(source.destroyed, true);
});

test("disconnection after streaming has started releases the source immediately", async () => {
  const source = new PassThrough(), response = new PassThrough();
  response.resume();
  pipeMediaStream(source, response, assert.fail);
  source.write("first");
  response.destroy();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(source.destroyed, true);
});

test("upstream errors are reported for connected clients", async () => {
  const source = new PassThrough(), response = new PassThrough();
  const error = new Error("storage unavailable");
  let received;
  pipeMediaStream(source, response, value => { received = value; response.destroy(); });
  source.destroy(error);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(received, error);
});
