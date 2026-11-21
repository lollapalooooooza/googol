import { Router, type IRouter } from "express";
import { GetDemoMediaParams } from "@workspace/api-zod";
import { byteRange, DEMO_MEDIA, openDemoMedia } from "../lib/demo-media";
import { pipeMediaStream } from "../lib/pipe-media";

const router: IRouter = Router();
router.get("/media/:asset", async (req, res): Promise<void> => {
  const parsed = GetDemoMediaParams.safeParse(req.params);
  if (!parsed.success) { res.status(404).json({ error: "Unknown media asset" }); return; }
  try {
    const file = openDemoMedia(parsed.data.asset);
    const [metadata] = await file.getMetadata();
    if (req.aborted || res.destroyed) return;
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Asset has invalid size");
    const range = byteRange(req.headers.range, size);
    res.set({
      "Accept-Ranges": "bytes", "Content-Type": DEMO_MEDIA[parsed.data.asset],
      "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff",
    });
    if (range === false) { res.set("Content-Range", `bytes */${size}`); res.status(416).end(); return; }
    if (range) {
      res.status(206).set({ "Content-Range": `bytes ${range.start}-${range.end}/${size}`, "Content-Length": String(range.end - range.start + 1) });
    } else res.set("Content-Length", String(size));
    if (req.method === "HEAD") { res.end(); return; }
    const stream = file.createReadStream(range || {});
    pipeMediaStream(stream, res, (error) => {
      req.log.error({ err: error }, "Exhibit media stream failed");
      if (res.headersSent) res.destroy();
      else { res.removeHeader("Content-Length"); res.status(503).end(); }
    });
  } catch (error) {
    if (req.aborted || res.destroyed) return;
    req.log.error({ err: error }, "Exhibit media could not be loaded");
    res.status(503).json({ error: "Media is temporarily unavailable. Please retry." });
  }
});
export default router;
