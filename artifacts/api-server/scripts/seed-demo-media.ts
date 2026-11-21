import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { resolve } from "node:path";
import { DEMO_MEDIA, mediaFile } from "../src/lib/demo-media.ts";

// Run once from this package; durable bytes live in App Storage, not the build.
for (const asset of Object.keys(DEMO_MEDIA) as (keyof typeof DEMO_MEDIA)[]) {
  const source = resolve("../../generated-artifacts", asset);
  await pipeline(createReadStream(source), mediaFile(asset).createWriteStream({
    resumable: false,
    metadata: { contentType: DEMO_MEDIA[asset], cacheControl: "public, max-age=3600" },
  }));
  process.stdout.write(`Stored ${asset}\n`);
}
