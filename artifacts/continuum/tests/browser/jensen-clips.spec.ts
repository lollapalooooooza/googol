import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

test.setTimeout(60_000);

async function openArticle(page: Page) {
  await page.goto("/news/jensen-huang");
  await expect(page.getByTestId("news-page")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function selectRows(page: Page, first: string, last = first) {
  const news = page.getByTestId("news-page");
  await news.evaluate((root, id) => {
    const row = root.querySelector(`[data-testid="timeline-${id}"]`)!;
    root.scrollTop += row.getBoundingClientRect().top - root.getBoundingClientRect().top - 36;
  }, first);
  const a = (await page.getByTestId(`timeline-${first}`).boundingBox())!;
  const b = (await page.getByTestId(`timeline-${last}`).boundingBox())!;
  await page.getByTestId("button-select-region").click();
  await page.mouse.move(a.x + 8, a.y + 8);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 8, b.y + b.height - 8, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("portal-cell")).toHaveAttribute("data-state", "ready");
}

test("multi-row selection queues matching clips, skips gaps and preserves its player", async ({ page }, info) => {
  await openArticle(page);
  await selectRows(page, "meeting", "marriage");
  const viewer = page.getByTestId("video-viewer"), video = page.getByTestId("visualization-video");
  await expect(viewer).toHaveAttribute("data-clip-count", "5");
  await expect(viewer).toHaveAttribute("data-clip-id", "meeting");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(21);
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 25.38; });
  await expect(viewer).toHaveAttribute("data-clip-id", "dating");
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(26);

  await page.getByTestId("button-clip-first-child").click();
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 38.98; });
  await expect(viewer).toHaveAttribute("data-clip-id", "family");
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId("button-clip-company")).toHaveCount(0);
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 47.28; });
  await expect(video).toHaveJSProperty("paused", true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(47.31);
  await expect(page.getByTestId("button-video-play")).toHaveAttribute("aria-label", "Replay selected clips");

  await page.getByTestId("button-clip-wedding").click();
  await page.getByTestId("button-video-play").click();
  await video.evaluate((v: HTMLVideoElement) => { v.dataset.instance = "same"; });
  const position = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.getByTestId("button-portal-expand").focus();
  await page.getByTestId("button-portal-expand").press("Enter");
  await expect(page.getByTestId("portal-cell")).toHaveAttribute("data-motion", "settled");
  await expect(video).toHaveAttribute("data-instance", "same");
  await expect(viewer).toHaveAttribute("data-clip-id", "wedding");
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(position, 1);
  await expect(video).toHaveJSProperty("paused", true);
  await page.screenshot({ path: info.outputPath("selected-clip-playlist.png") });
  await page.getByTestId("button-portal-collapse").click();
  await expect(page.getByTestId("portal-cell")).toHaveAttribute("data-motion", "settled");
  await expect(video).toHaveAttribute("data-instance", "same");
  await page.getByRole("tab", { name: "Mars — Wikipedia", exact: true }).click();
  await expect(viewer).toHaveCount(0);
});

test("unmatched entries play the full source and moving a selection picks the new topic", async ({ page }) => {
  await openArticle(page);
  await expect(page.getByTestId("input-command")).toHaveAttribute("placeholder", "ask googol anything");
  await selectRows(page, "philanthropy");
  const viewer = page.getByTestId("video-viewer"), video = page.getByTestId("visualization-video");
  await expect(viewer).toHaveAttribute("data-playback-mode", "full");
  await expect(viewer).toHaveAttribute("data-clip-start", "0");
  await expect(video).toHaveJSProperty("paused", false);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(5);
  // An excerpt boundary in the source must not stop full-video playback.
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 25.38; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(26);
  await expect(viewer).toHaveAttribute("data-clip-id", "full-video");
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = v.duration - .1; });
  await expect(page.getByTestId("button-video-play")).toHaveAttribute("aria-label", "Replay full video");
  await page.getByTestId("button-video-play").click();
  await expect(video).toHaveJSProperty("paused", false);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(5);
  const selected = (await page.getByTestId("box-selection").boundingBox())!;
  const old = (await page.getByTestId("timeline-philanthropy").boundingBox())!;
  const next = (await page.getByTestId("timeline-apology").boundingBox())!;
  // The left edge stays outside the floating portal, so it is a real drag.
  await page.mouse.move(selected.x + 8, selected.y + 20);
  await page.mouse.down();
  await page.mouse.move(selected.x + 8, selected.y + 20 + next.y - old.y, { steps: 8 });
  await page.mouse.up();
  // The outgoing portal fades away while the replacement starts its reveal.
  await expect(page.getByTestId("portal-cell")).toHaveCount(1);
  await expect(page.getByTestId("portal-cell")).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("video-viewer")).toHaveAttribute("data-clip-id", "apology");
  await expect(page.getByTestId("video-viewer")).toHaveAttribute("data-clip-count", "1");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(48);
  await page.getByTestId("button-select-region").click();
  await expect(video).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Even a topically tagged paragraph outside the timeline plays the full source.
  await page.getByTestId("news-page").evaluate((root) => {
    const p = root.querySelector('p[data-video-topic="apology"]')!;
    root.scrollTop += p.getBoundingClientRect().top - root.getBoundingClientRect().top - 36;
  });
  const p = (await page.locator('p[data-video-topic="apology"]').boundingBox())!;
  await page.getByTestId("button-select-region").click();
  await page.mouse.move(p.x + 8, p.y + 8);
  await page.mouse.down();
  await page.mouse.move(p.x + p.width - 8, p.y + p.height - 8, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("portal-cell")).toHaveAttribute("data-state", "ready");
  await expect(viewer).toHaveAttribute("data-playback-mode", "full");
  await expect(video).toHaveJSProperty("paused", false);
  await expect(video).toHaveJSProperty("muted", true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(5);
});
