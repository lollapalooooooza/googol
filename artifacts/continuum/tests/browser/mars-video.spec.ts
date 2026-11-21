import { test, expect, article, selectRegion } from "./fixtures";

test.use({ reducedMotion: "no-preference", trace: { mode: "retain-on-failure", screenshots: false, snapshots: true } });
test.setTimeout(45_000);

test("Mars search stays an article until a drag reveals the correct exhibit", async ({ page }) => {
  await page.goto("/");
  await article(page, "Plant cell");
  const tabs = page.getByRole("tab");
  await expect(tabs.nth(2)).toHaveAccessibleName("Mars — Wikipedia");
  await expect(tabs.nth(3)).toHaveAccessibleName("Jensen Huang — Briefing");
  await page.getByRole("searchbox", { name: "Search Wikipedia" }).fill("mars");
  await page.getByRole("searchbox", { name: "Search Wikipedia" }).press("Enter");
  await article(page, "Mars");
  await expect(page.getByTestId("portal-cell")).toHaveCount(0);
  await selectRegion(page);
  const portal = page.getByTestId("portal-cell");
  await expect(portal).toHaveAttribute("data-model", "mars");
  await expect(page.getByTestId("mars-viewer")).toBeVisible();
  await expect(page.getByTestId("cell-viewer")).toHaveCount(0);
  const expand = page.getByTestId("button-portal-expand");
  await expand.focus(); await expand.press("Enter");
  await expect(portal).toHaveAttribute("data-motion", "settled");
  await expect(portal).toHaveAttribute("data-state", "expanded");
  await page.keyboard.press("Escape");
  await expect(portal).toHaveAttribute("data-state", "ready");
  await expect(portal).toHaveAttribute("data-motion", "settled");
  await page.getByRole("tab", { name: "Neuron — Wikipedia", exact: true }).click();
  await expect(portal).toHaveCount(0);
});

test("news uses the uploaded video and preserves playback through continuous enlargement", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Jensen Huang — Briefing", exact: true }).click();
  await expect(page.getByTestId("news-page")).toBeVisible();
  await expect(page).toHaveURL(/\/news\/jensen-huang$/);
  await page.reload();
  const news = page.getByTestId("news-page");
  await expect(news).toBeVisible();
  await expect(news).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(news.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByTestId("relationship-timeline").locator("li")).toHaveCount(7);
  await page.screenshot({ path: info.outputPath("jensen-article.png") });
  await expect(page.getByTestId("link-source-nvidia")).toHaveAttribute("href", /^https:\/\/nvidianews.nvidia.com/);
  await expect(page.getByTestId("portal-cell")).toHaveCount(0);
  await selectRegion(page);
  const portal = page.getByTestId("portal-cell"), video = page.getByTestId("visualization-video");
  await expect(portal).toHaveAttribute("data-model", "jensen-video");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(60);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0);
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  await page.getByTestId("button-video-play").click();
  await expect(video).toHaveJSProperty("paused", true);
  const clipStart = Number(await page.getByTestId("video-viewer").getAttribute("data-clip-start"));
  await video.evaluate((v: HTMLVideoElement, start) => { v.dataset.instance = "original"; v.currentTime = start + .5; }, clipStart);
  await page.getByTestId("button-video-mute").click();
  await page.getByTestId("button-video-play").click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(clipStart + .5);
  await page.getByTestId("button-video-play").click();
  const position = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  const frame = (await page.getByTestId("video-media-frame").boundingBox())!;
  const dock = (await page.getByTestId("video-control-dock").boundingBox())!;
  expect(dock.y).toBeGreaterThan(frame.y + frame.height);
  await page.screenshot({ path: info.outputPath("video-floating.png") });
  const before = (await portal.boundingBox())!;
  await portal.evaluate((el: HTMLElement) => {
    const widths = [el.getBoundingClientRect().width];
    el.dataset.widthSamples = JSON.stringify(widths);
    const observer = new MutationObserver(() => {
      const width = Number.parseFloat(el.style.width);
      if (Number.isFinite(width) && width !== widths.at(-1)) {
        widths.push(width);
        el.dataset.widthSamples = JSON.stringify(widths);
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    el.addEventListener("stop-width-sampling", () => observer.disconnect(), { once: true });
  });
  await page.getByTestId("button-portal-expand").focus();
  await page.getByTestId("button-portal-expand").press("Enter");
  // Sample real animation updates rather than assuming the first frame
  // arrives within 100ms on a software-rendered mobile browser.
  await expect.poll(async () => (await portal.boundingBox())!.width).toBeGreaterThan(before.width);
  await expect(portal).toHaveAttribute("data-motion", "settled");
  const after = (await portal.boundingBox())!;
  const widths: number[] = await portal.evaluate((el: HTMLElement) => {
    el.dispatchEvent(new Event("stop-width-sampling"));
    return JSON.parse(el.dataset.widthSamples || "[]");
  });
  expect(widths.some((width) => width > before.width + 0.1 && width < after.width - 0.1)).toBe(true);
  const vp = page.viewportSize()!;
  expect(Math.abs(after.x + after.width / 2 - vp.width / 2)).toBeLessThan(2);
  expect(Math.abs(after.y + after.height / 2 - vp.height / 2)).toBeLessThan(2);
  await expect(video).toHaveAttribute("data-instance", "original");
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(position, 1);
  await expect(video).toHaveJSProperty("paused", true);
  await page.screenshot({ path: info.outputPath("video-expanded.png") });
  await page.getByTestId("button-portal-collapse").click();
  await expect(portal).toHaveAttribute("data-motion", "settled");
  await expect(video).toHaveAttribute("data-instance", "original");
  const restored = (await portal.boundingBox())!;
  expect(restored.width).toBeCloseTo(before.width, 0);
  await page.getByRole("tab", { name: "Plant cell — Wikipedia", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(video).toHaveCount(0);
  await expect(portal).toHaveCount(0);
});

test.describe("stable 3D enlargement", () => {
  test.use({ webglEnabled: true });
  test("scales the live canvas smoothly without reallocating or remounting it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Mars — Wikipedia", exact: true }).click();
    await article(page, "Mars");
    await selectRegion(page);
    const portal = page.getByTestId("portal-cell");
    const canvas = page.getByTestId("mars-viewer").locator("canvas");
    await expect(page.getByTestId("mars-viewer")).toHaveAttribute("data-texture", "ready");
    const buffer = await canvas.evaluate((c: HTMLCanvasElement) => {
      c.dataset.instance = "original";
      return [c.width, c.height];
    });
    expect(buffer[0]).toBeGreaterThan(0);
    const before = (await canvas.boundingBox())!;
    await page.getByTestId("button-portal-expand").focus();
    await page.getByTestId("button-portal-expand").press("Enter");
    await expect(portal).toHaveAttribute("data-motion", "settled");
    const after = (await canvas.boundingBox())!;
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 2);
    await expect(canvas).toHaveAttribute("data-instance", "original");
    expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual(buffer);
    const bounds = (await portal.boundingBox())!, vp = page.viewportSize()!;
    expect(Math.abs(bounds.x + bounds.width / 2 - vp.width / 2)).toBeLessThan(2);
    expect(Math.abs(bounds.y + bounds.height / 2 - vp.height / 2)).toBeLessThan(2);
    await page.getByTestId("button-mars-rotate").click();
    const pose = await canvas.getAttribute("data-camera-pose");
    await page.mouse.move(after.x + after.width * .4, after.y + after.height * .5);
    await page.mouse.down();
    await page.mouse.move(after.x + after.width * .6, after.y + after.height * .5, { steps: 8 });
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute("data-camera-pose", pose!);
    await page.getByTestId("button-portal-collapse").click();
    await expect(portal).toHaveAttribute("data-motion", "settled");
    await expect(canvas).toHaveAttribute("data-instance", "original");
    expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual(buffer);
  });
});
