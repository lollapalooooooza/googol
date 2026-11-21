import { test, expect, article, closePreview, command } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await article(page, "Plant cell");
  await closePreview(page);
});

test("switches tabs without replacing the active article when another tab closes", async ({ page }) => {
  await expect(page.getByRole("tab")).toHaveCount(4);
  for (const title of ["Neuron", "Mars", "Plant cell"]) {
    await page.getByRole("tab", { name: `${title} — Wikipedia`, exact: true }).click();
    await article(page, title);
  }
  await page.getByRole("button", { name: "Close Neuron — Wikipedia", exact: true }).focus();
  await page.keyboard.press("Enter");
  await article(page, "Plant cell");
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.getByRole("button", { name: "Close tab", exact: true }).click();
  await article(page, "Mars");
});

test("closes every tab, restores the last closed article, and opens from the empty state", async ({ page }) => {
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Close tab", exact: true }).click();
  await expect(page.getByTestId("status-no-tabs")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  for (const id of ["button-back", "button-forward", "button-reload", "button-close-current"]) {
    await expect(page.getByTestId(id)).toBeDisabled();
  }
  await expect(page.getByTestId("portal-cell")).toHaveCount(0);
  await page.getByRole("button", { name: "Reopen last tab" }).click();
  await expect(page.getByTestId("news-page")).toBeVisible();
  await expect(page.getByRole("tab", { selected: true })).toHaveAccessibleName("Jensen Huang — Briefing");
  await page.getByTestId("button-close-current").click();
  await page.getByTestId("status-no-tabs").getByRole("button", { name: "Plant cell", exact: true }).click();
  await article(page, "Plant cell");
  await page.getByTestId("button-close-current").click();
  await page.getByTestId("button-new-tab").click();
  await expect(page.getByTestId("page-new-tab")).toBeVisible();
  await expect(page.getByTestId("input-newtab-search")).toBeFocused();
  await page.getByTestId("input-newtab-search").fill("Chloroplast");
  await page.getByTestId("input-newtab-search").press("Enter");
  await expect(page.getByTestId("page-wiki-search")).toBeVisible();
  await page.getByTestId("link-search-result-0").click();
  await article(page, "Chloroplast");
});

test("keeps independent tab histories and discards only the active tab's forward branch", async ({ page }) => {
  const first = page.getByTestId("tab-1");
  await page.getByTestId("wiki-content").getByRole("link", { name: "Photosynthesis", exact: true }).click();
  await article(page, "Photosynthesis");
  await command(page, "Chloroplast");
  await article(page, "Chloroplast");
  await page.getByTestId("button-back").click();
  await article(page, "Photosynthesis");
  await page.getByTestId("tab-2").click();
  await article(page, "Neuron");
  await expect(page.getByTestId("button-back")).toBeDisabled();
  await command(page, "Bacteria");
  await article(page, "Bacteria");
  await first.click();
  await article(page, "Photosynthesis");
  await expect(page.getByTestId("button-forward")).toBeEnabled();
  await page.keyboard.press("Alt+ArrowRight");
  await article(page, "Chloroplast");
  await page.keyboard.press("Alt+ArrowLeft");
  await article(page, "Photosynthesis");
  await command(page, "Animal cell");
  await article(page, "Animal cell");
  await expect(page.getByTestId("button-forward")).toBeDisabled();
  await page.getByTestId("tab-2").click();
  await article(page, "Bacteria");
  await page.getByTestId("button-back").click();
  await article(page, "Neuron");
  await expect(page.getByTestId("button-forward")).toBeEnabled();
});

test("reopens tabs in last-closed order with their history and current position intact", async ({ page }) => {
  await command(page, "Photosynthesis");
  await article(page, "Photosynthesis");
  await command(page, "Chloroplast");
  await article(page, "Chloroplast");
  await command(page, "back");
  await article(page, "Photosynthesis");
  await command(page, "close tab");
  await article(page, "Neuron");
  await command(page, "close tab");
  await article(page, "Mars");
  await page.keyboard.press("Control+Shift+T");
  await article(page, "Neuron");
  await command(page, "reopen tab");
  await article(page, "Photosynthesis");
  await command(page, "forward");
  await article(page, "Chloroplast");
  await command(page, "back");
  await command(page, "back");
  await article(page, "Plant cell");
});

test("opens article links in a background tab and reloads without adding history", async ({ page, apiRequests }) => {
  await page.getByTestId("wiki-content").getByRole("link", { name: "Photosynthesis", exact: true }).click({ modifiers: ["Control"] });
  await expect(page.getByRole("tab")).toHaveCount(5);
  await article(page, "Plant cell");
  await page.getByRole("tab", { name: "Photosynthesis — Wikipedia", exact: true }).click();
  await article(page, "Photosynthesis");
  const count = () => apiRequests.filter((r) => r.startsWith("/api/wiki/article?title=Photosynthesis")).length;
  const before = count();
  await page.getByTestId("button-reload").click();
  await expect.poll(count).toBe(before + 1);
  await expect(page.getByTestId("button-back")).toBeDisabled();
});

test("supports keyboard tab navigation and restores a minimized browser", async ({ page }) => {
  await page.getByTestId("tab-1").focus();
  await page.keyboard.press("ArrowRight");
  await article(page, "Neuron");
  await expect(page.getByTestId("tab-2")).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByTestId("news-page")).toBeVisible();
  await page.keyboard.press("Home");
  await article(page, "Plant cell");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("news-page")).toBeVisible();
  await page.getByTestId("button-minimize").click();
  await page.getByTestId("tab-1").click();
  await article(page, "Plant cell");
  await expect(page.getByTestId("input-address")).toBeVisible();
});
