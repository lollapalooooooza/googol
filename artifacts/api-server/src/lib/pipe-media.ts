import type { Readable, Writable } from "node:stream";

/**
 * GCS 7 creates its internal pipeline only after the HTTP response arrives.
 * Destroying its public stream before then makes that later pipeline throw
 * outside Express. Defer cancellation until its first byte, then release it.
 */
export function pipeMediaStream(source: Readable, destination: Writable, onError: (error: Error) => void) {
  let started = false;
  let disconnected = destination.destroyed;
  const cancel = () => {
    disconnected = true;
    source.unpipe(destination);
    if (started) source.destroy();
    else source.resume();
  };
  const cleanup = () => {
    destination.off("close", cancel);
  };
  source.once("data", () => {
    started = true;
    // Let the SDK finish its pipeline setup before cancelling an early seek.
    if (disconnected) queueMicrotask(() => source.destroy());
  });
  source.once("error", (error: Error) => {
    if (!disconnected) onError(error);
  });
  source.once("close", cleanup);
  source.once("end", cleanup);
  destination.once("close", cancel);
  if (disconnected) source.resume();
  else source.pipe(destination);
}
