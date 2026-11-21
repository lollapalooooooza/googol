import { Storage } from "@google-cloud/storage";

// Replit App Storage's documented sidecar authentication; no keys in source.
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
export const mediaStorage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export const DEMO_MEDIA = {
  "mars-surface.jpg": "image/jpeg",
  "jensen-timeline.mp4": "video/mp4",
  "jensen-poster.jpg": "image/jpeg",
} as const;

export function mediaFile(asset: keyof typeof DEMO_MEDIA) {
  const base = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim();
  if (!base) throw new Error("Public App Storage is not configured");
  const [bucket, ...prefix] = base.replace(/^\/+/, "").split("/");
  if (!bucket) throw new Error("Public App Storage bucket is not configured");
  return mediaStorage.bucket(bucket).file([...prefix, "continuum-demo", asset].join("/"));
}

/** Single-range HTTP byte serving, including suffix requests used by players. */
export function byteRange(header: string | undefined, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return false;
  return { start, end };
}
