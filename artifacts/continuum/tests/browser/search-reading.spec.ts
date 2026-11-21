import { test, expect, article, closePreview, command } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await article(page, "Plant cell");
  await closePreview(page);
});

test("searches from the masthead, address, command bar, and new tab", async ({ page }) => {
  const search = page.getByTestId("input-wiki-search");
  await search.fill("photo");
  await page.getByTestId("list-masthead-suggest-0").focus();
  await page.keyboard.press("Enter");
  await article(page, "Photosynthesis");
  await page.keyboard.press("Control+l");
  await expect(page.getByTestId("input-address")).toBeFocused();
  await page.getByTestId("input-address").fill("chlor");
  await page.getByTestId("list-address-suggest-0").click();
  await article(page, "Chloroplast");
  await command(page, "search bacteria");
  await expect(page.getByTestId("page-wiki-search")).toBeVisible();
  await expect(page.getByTestId("text-search-query")).toContainText("bacteria");
  await expect(page.getByRole("tab", { selected: true })).toHaveAccessibleName("bacteria — Wikipedia search");
  await page.getByTestId("button-back").click();
  await article(page, "Chloroplast");
  await page.getByTestId("button-forward").click();
  await expect(page.getByTestId("page-wiki-search")).toBeVisible();
  await page.getByTestId("link-search-result-0").click();
  await article(page, "Bacteria");
  await expect(page.getByTestId("panel-command")).toHaveCount(0);
  await page.getByTestId("button-new-tab").click();
  await page.getByTestId("input-newtab-search").fill("neuron");
  await page.getByTestId("list-newtab-suggest-0").click();
  await article(page, "Neuron");
});

test("handles direct titles, Wikipedia URLs, empty searches, and no results", async ({ page }) => {
  await page.getByTestId("input-wiki-search").fill("   ");
  await page.getByTestId("button-wiki-search").click();
  await article(page, "Plant cell");
  await page.getByTestId("input-wiki-search").fill("Neuron");
  await page.getByTestId("input-wiki-search").press("Enter");
  await expect(page.getByTestId("page-wiki-search")).toBeVisible();
  await page.getByTestId("link-search-result-0").click();
  await article(page, "Neuron");
  await page.getByTestId("input-address").fill("https://en.wikipedia.org/wiki/Animal_cell#Structure");
  await page.getByTestId("input-address").press("Enter");
  await expect(page.getByTestId("text-article-title")).toHaveText("Animal cell");
  await expect(page.getByTestId("input-address")).toHaveValue("https://en.wikipedia.org/wiki/Animal_cell#Structure");
  await command(page, "search zzz-no-match");
  await expect(page.getByTestId("status-search-empty")).toContainText("No matching Wikipedia articles");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("status-search-empty")).toBeVisible();
  await command(page, "back");
  await expect(page.getByTestId("input-address")).toHaveValue("https://en.wikipedia.org/wiki/Animal_cell#Structure");
});

test("saves, reopens, and removes bookmarks across tab changes and reloads", async ({ page }) => {
  const save = page.getByTestId("button-bookmark");
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("tab-2").click();
  await article(page, "Neuron");
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await page.reload();
  await article(page, "Plant cell");
  await closePreview(page);
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("button-bookmarks").click();
  const bookmarks = page.getByRole("dialog", { name: "Bookmarks", exact: true });
  await expect(bookmarks.getByRole("button", { name: "Plant cell", exact: true })).toHaveCount(1);
  await bookmarks.getByRole("button", { name: "Neuron", exact: true }).click();
  await article(page, "Neuron");
  await save.click();
  await page.getByTestId("button-bookmarks").click();
  await expect(bookmarks.getByRole("button", { name: "Neuron", exact: true })).toHaveCount(0);
  await bookmarks.getByRole("button", { name: "Remove Plant cell bookmark" }).click();
  await expect(bookmarks).toContainText("No saved articles yet.");
  await page.reload();
  await article(page, "Plant cell");
  await closePreview(page);
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("button-bookmarks").click();
  await expect(bookmarks).toContainText("No saved articles yet.");
});

test("applies reading preferences across articles and reloads without changing defaults", async ({ page }) => {
  const content = page.getByTestId("wiki-content");
  await expect(content).toHaveCSS("font-size", "14px");
  await page.getByTestId("button-reading").click();
  const reading = page.getByRole("dialog", { name: "Reading preferences" });
  await expect(reading.getByRole("radio", { name: "Standard", exact: true })).toBeChecked();
  await reading.getByRole("radio", { name: "Larger", exact: true }).check();
  await reading.getByRole("radio", { name: "Serif", exact: true }).check();
  await expect(content).toHaveCSS("font-size", "18px");
  await expect(content).toHaveCSS("font-family", /Georgia/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("button-reading")).toBeFocused();
  await page.getByTestId("tab-2").click();
  await article(page, "Neuron");
  await expect(content).toHaveCSS("font-size", "18px");
  await page.reload();
  await article(page, "Plant cell");
  await closePreview(page);
  await expect(content).toHaveCSS("font-size", "18px");
  await expect(content).toHaveCSS("font-family", /Georgia/);
  await page.getByTestId("button-reading").click();
  await reading.getByRole("radio", { name: "Large", exact: true }).check();
  await expect(content).toHaveCSS("font-size", "16px");
  await reading.getByRole("radio", { name: "Standard", exact: true }).check();
  await reading.getByRole("radio", { name: "Sans serif", exact: true }).check();
  await page.keyboard.press("Escape");
  await page.reload();
  await article(page, "Plant cell");
  await expect(content).toHaveCSS("font-size", "14px");
  await expect(content).not.toHaveCSS("font-family", /Georgia/);
});

test("reports corrupt or unavailable storage without breaking reading controls", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("continuum.bookmarks.v1", "{bad json");
    localStorage.setItem("continuum.reading.v1", JSON.stringify({ textSize: "huge", typeface: "unknown" }));
  });
  await page.reload();
  await article(page, "Plant cell");
  await closePreview(page);
  await expect(page.getByRole("status")).toContainText("could not be read");
  await expect(page.getByTestId("wiki-content")).toHaveCSS("font-size", "14px");
  expect(await page.evaluate(() => localStorage.getItem("continuum.bookmarks.v1"))).toBe("{bad json");
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
    Storage.prototype.getItem = () => { throw new DOMException("Denied", "SecurityError"); };
  });
  await page.reload();
  await article(page, "Plant cell");
  await closePreview(page);
  await page.getByTestId("button-bookmark").click();
  await expect(page.getByTestId("button-bookmark")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("could not be saved");
  await page.getByTestId("button-reading").click();
  await page.getByRole("radio", { name: "Large", exact: true }).check();
  await expect(page.getByTestId("wiki-content")).toHaveCSS("font-size", "16px");
});
