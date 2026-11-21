import { test as base, expect, type Page, type Locator } from "@playwright/test";

// Contract-shaped test doubles, not replacement content shipped by the reader.
// Only external resources and WebGL are substituted; all browser UI is real.
const titles = ["Plant cell", "Neuron", "Mars", "Bacteria", "Animal cell", "Photosynthesis", "Chloroplast"];
export const test = base.extend<{ apiRequests: string[]; webglEnabled: boolean }>({
  webglEnabled: [false, { option: true }],
  apiRequests: [async ({ page, webglEnabled }, use) => {
    const requests: string[] = [];
    if (!webglEnabled) await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === "webgl" || type === "webgl2") return null;
        return Reflect.apply(original, this, [type, ...args]);
      } as typeof original;
    });
    // Slow or unavailable third-party fonts/images must not gate page load.
    await page.route(/^https:\/\/fonts\.googleapis\.com\//, (route) => route.fulfill({ contentType: "text/css", body: "" }));
    await page.route(/^https:\/\/fonts\.gstatic\.com\//, (route) => route.abort());
    await page.route("https://en.wikipedia.org/static/**", (route) => route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><text x="4" y="26" font-size="26">W</text></svg>',
    }));
    await page.route("**/api/wiki/**", async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.pathname + url.search);
      if (url.pathname.endsWith("/search")) {
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        await route.fulfill({ json: titles.filter((t) => t.toLowerCase().includes(q)).map((title) => ({ title, description: `Search fixture: ${title}` })) });
      } else if (url.pathname.endsWith("/article")) {
        const requested = (url.searchParams.get("title") ?? "").replaceAll("_", " ");
        const title = requested.toLowerCase() === "plant cells" ? "Plant cell"
          : ["neurone", "nerve cell"].includes(requested.toLowerCase()) ? "Neuron" : requested;
        if (!titles.includes(title)) {
          await route.fulfill({ status: 404, json: { error: "Test article not found" } });
          return;
        }
        await route.fulfill({ json: {
          title,
          html: `<p data-fixture="lead"><b>${title}</b> article fixture.</p>
            <p>${titles.filter((t) => t !== title).map((t) => `<a href="/wiki/${t.replaceAll(" ", "_")}">${t}</a>`).join(" · ")}</p>
            <h2 id="Structure">Structure</h2><p>Section navigation fixture.</p>
            <h2 id="References">References</h2><p>Attribution fixture.</p>`,
          url: `https://en.wikipedia.org/wiki/${title.replaceAll(" ", "_")}`,
          revisionId: 123456,
          sections: [
            { anchor: "Structure", title: "Structure", level: 2 },
            { anchor: "References", title: "References", level: 2 },
          ],
        } });
      } else {
        throw new Error(`Unmocked Wikipedia endpoint: ${url.pathname}`);
      }
    });
    await use(requests);
  }, { auto: true }],
});

export { expect };

export async function article(page: Page, title: string) {
  await expect(page.getByTestId("text-article-title")).toHaveText(title);
  await expect(page.getByTestId("input-address")).toHaveValue(`https://en.wikipedia.org/wiki/${title.replaceAll(" ", "_")}`);
  await expect(page.getByRole("tab", { selected: true })).toHaveAccessibleName(`${title} — Wikipedia`);
}

export async function command(page: Page, text: string) {
  const input = page.getByRole("textbox", { name: "Command", exact: true });
  await input.fill(text);
  await input.press("Enter");
}

export async function closePreview(page: Page) {
  const button = page.getByRole("button", { name: "Close preview", exact: true });
  if (await button.count()) {
    await button.focus();
    await button.press("Enter");
    await expect(page.getByTestId("portal-cell")).toHaveCount(0);
  }
}

export async function selectRegion(page: Page, waitForReady = true) {
  await page.getByTestId("button-select-region").click();
  const layer = page.getByTestId("layer-region-select");
  const box = (await layer.boundingBox())!;
  const x = box.x + box.width * 0.25;
  const y = box.y + Math.min(250, box.height * 0.45);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.width * 0.5, y + 80, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("box-selection")).toBeVisible();
  if (waitForReady) await expect(page.getByTestId("portal-cell")).toHaveAttribute("data-state", "ready");
}

export async function withinViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "Control must have a visible bounding box").not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
