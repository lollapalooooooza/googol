import AxeBuilder from "@axe-core/playwright";
import { test, expect, article, closePreview, command, selectRegion, withinViewport } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await article(page, "Plant cell");
});

test("opens and closes the portal and expanded viewer with keyboard focus restored", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const portal = page.getByTestId("portal-cell");
  const close = page.getByRole("button", { name: "Close preview", exact: true });
  await expect(portal).toHaveCount(0);
  await command(page, "3d cell");
  await expect(page.getByTestId("button-select-region")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await selectRegion(page);
  await expect(portal).toHaveAttribute("aria-busy", "false");
  await close.focus();
  await close.press("Enter");
  await expect(portal).toHaveCount(0);
  const show = page.getByTestId("button-selection-visualize");
  await expect(show).toBeFocused();
  await show.press("Enter");
  await expect(portal).toHaveAttribute("data-state", "ready");
  const expand = page.getByRole("button", { name: "Expand", exact: true });
  await expand.focus();
  await expect(expand).toHaveCSS("opacity", "1");
  await expand.press("Enter");
  const viewer = page.getByRole("dialog", { name: "Plant cell 3D preview" });
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute("data-motion", "settled");
  await expect(viewer.getByTestId("status-no-webgl")).toBeVisible();
  await expect(viewer.locator(":focus")).toHaveCount(1);
  await viewer.getByRole("button", { name: "Collapse to window" }).focus();
  await page.keyboard.press("Tab");
  await expect(viewer.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Shift+Tab");
  await expect(viewer.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expand.press("Escape");
  await expect(portal).toHaveCount(0);
  await expect(page.getByTestId("button-select-region")).toBeFocused();
  await expect(page.getByTestId("box-selection")).toHaveCount(0);
  await selectRegion(page);
  await command(page, "3d cell");
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "Collapse to window" }).press("Enter");
  await expect(viewer).toHaveCount(0);
  await expect(page.getByTestId("input-command")).toBeFocused();
});

test("cancels region selection and command help with Escape", async ({ page }) => {
  await closePreview(page);
  await page.getByTestId("button-select-region").click();
  await expect(page.getByTestId("button-select-region")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("button-select-region")).toHaveAttribute("aria-pressed", "false");
  await command(page, "help");
  await expect(page.getByTestId("panel-command")).toContainText("Supported commands");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("panel-command")).toHaveCount(0);
});

test("keeps reading and search controls accessible at 320px without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toMatch(/(?:maximum-scale\s*=\s*1(?:[,\s]|$)|user-scalable\s*=\s*(?:no|0))/i);
  await closePreview(page);
  for (const id of ["input-address", "input-wiki-search", "button-wiki-search", "input-command", "button-bookmark", "button-reading"]) {
    await withinViewport(page, page.getByTestId(id));
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const axe = () => new AxeBuilder({ page }).include('[data-testid="desktop"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect((await axe()).violations).toEqual([]);
  await page.getByTestId("button-reading").click();
  const reading = page.getByRole("dialog", { name: "Reading preferences" });
  await withinViewport(page, reading);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("button-reading")).toBeFocused();
  await page.getByTestId("button-new-tab").click();
  await withinViewport(page, page.getByTestId("input-newtab-search"));
  await page.getByTestId("input-newtab-search").fill("photo");
  await expect(page.getByTestId("list-newtab-suggest-0")).toBeVisible();
  await withinViewport(page, page.getByTestId("list-newtab-suggest"));
  expect((await axe()).violations).toEqual([]);
});
