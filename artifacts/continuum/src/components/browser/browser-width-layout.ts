export interface BrowserBounds { x: number; w: number }
export const windowPadding = (viewport: number) => Math.min(12, viewport * 0.02);
export const minBrowserWidth = (viewport: number) => Math.min(420, viewport - windowPadding(viewport) * 2);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function defaultBrowserBounds(viewport: number): BrowserBounds {
  const fraction = viewport >= 768 ? 0.82 : 0.96;
  return { x: viewport * (1 - fraction) / 2, w: viewport * fraction };
}
export function fitBrowserBounds(bounds: BrowserBounds, viewport: number): BrowserBounds {
  const pad = windowPadding(viewport);
  const w = clamp(bounds.w, minBrowserWidth(viewport), viewport - pad * 2);
  return { w, x: clamp(bounds.x, pad, viewport - pad - w) };
}
export function resizeBrowserBounds(bounds: BrowserBounds, edge: "left" | "right", delta: number, viewport: number): BrowserBounds {
  const b = fitBrowserBounds(bounds, viewport);
  const pad = windowPadding(viewport), min = minBrowserWidth(viewport);
  if (edge === "right") return { x: b.x, w: clamp(b.w + delta, min, viewport - pad - b.x) };
  const right = b.x + b.w;
  const x = clamp(b.x + delta, pad, right - min);
  return { x, w: right - x };
}
