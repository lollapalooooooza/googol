export type GenieKeyInput =
  | "key_w"
  | "key_a"
  | "key_s"
  | "key_d"
  | "arrow_up"
  | "arrow_down"
  | "arrow_left"
  | "arrow_right";

export interface RegionSelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExtractedRegionContext {
  selectedText: string;
  imageAlt: string;
  referenceImageBase64: string | null;
  sourceLabel: string;
}

const KEY_MAP: Record<string, GenieKeyInput> = {
  KeyW: "key_w",
  KeyA: "key_a",
  KeyS: "key_s",
  KeyD: "key_d",
  ArrowUp: "arrow_up",
  ArrowDown: "arrow_down",
  ArrowLeft: "arrow_left",
  ArrowRight: "arrow_right",
};

export function mapKeyboardCodeToGenieAction(code: string): GenieKeyInput | "space" | "voice" | null {
  if (code in KEY_MAP) return KEY_MAP[code];
  if (code === "Space") return "space";
  if (code === "KeyV") return "voice";
  return null;
}

export function rectsIntersectArea(a: RegionSelectionRect, b: RegionSelectionRect): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}

/**
 * Compresses an HTMLImageElement into a 16:9 JPEG base64 payload strictly under
 * 44 KB raw bytes so Genie 4 WebRTC `world_setup` stays under its 64 KB cap.
 */
export function compressImageToGenieJpeg(img: HTMLImageElement): string | null {
  if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return null;
  try {
    const canvas = document.createElement("canvas");
    const targetW = 480;
    const targetH = 270;
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Cover-crop into 16:9 frame
    const srcRatio = img.naturalWidth / img.naturalHeight;
    const dstRatio = targetW / targetH;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (srcRatio > dstRatio) {
      sw = img.naturalHeight * dstRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / dstRatio;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    for (const quality of [0.68, 0.52, 0.38, 0.28]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1] ?? "";
      // Keep the encoded base64 string well under 36 KB so the full JSON
      // `world_setup` frame stays safely inside WebRTC SCTP limits (< 64 KB).
      if (base64 && base64.length < 36_000) {
        return base64;
      }
    }
    return null;
  } catch {
    // Cross-origin tainted canvas — fall back gracefully to text + alt context
    return null;
  }
}

/**
 * Extracts overlapping text snippets and an optional compressed reference image
 * from the active browser viewport inside the user's marquee selection.
 */
export function extractSelectedRegionContext(
  container: HTMLElement | null,
  viewportSelection: RegionSelectionRect,
  pageTitle: string,
): ExtractedRegionContext {
  if (!container) {
    return {
      selectedText: "",
      imageAlt: "",
      referenceImageBase64: null,
      sourceLabel: pageTitle || "Selected region",
    };
  }

  // 1. Collect overlapping visible text blocks
  const textCandidates = container.querySelectorAll<HTMLElement>(
    "h1, h2, h3, h4, p, li, figcaption, td, th, dt, dd, article a, blockquote",
  );
  const snippets: string[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(textCandidates)) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const area = rectsIntersectArea(viewportSelection, { x: r.left, y: r.top, w: r.width, h: r.height });
    if (area <= 0) continue;
    const txt = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (txt.length < 4 || seen.has(txt)) continue;
    seen.add(txt);
    snippets.push(txt);
    if (snippets.join(" ").length >= 900) break;
  }

  // 2. Find best-overlapping visible image
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  let bestImg: HTMLImageElement | null = null;
  let bestImgArea = 0;
  for (const img of imgs) {
    const r = img.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) continue;
    const area = rectsIntersectArea(viewportSelection, { x: r.left, y: r.top, w: r.width, h: r.height });
    if (area > bestImgArea) {
      bestImgArea = area;
      bestImg = img;
    }
  }

  const selectedText = snippets.join(" ").slice(0, 950).trim();
  const imageAlt = bestImg?.alt?.trim() ?? "";
  const referenceImageBase64 = bestImg ? compressImageToGenieJpeg(bestImg) : null;

  const sourceLabel =
    (imageAlt && imageAlt.slice(0, 64)) ||
    (selectedText && selectedText.slice(0, 64)) ||
    pageTitle ||
    "Selected region";

  return {
    selectedText,
    imageAlt,
    referenceImageBase64,
    sourceLabel,
  };
}
