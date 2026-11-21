import { readFile } from "node:fs/promises";
import { test, expect, article, command, selectRegion, withinViewport } from "./fixtures";

// Avoid automatic GPU-readback filmstrips; retain action/DOM traces and save
// explicit screenshot evidence for the real renderer instead.
test.use({ trace: { mode: "retain-on-failure", screenshots: false, snapshots: true } });

test.describe("canonical model routing", () => {
  test("resolves the neuron, waits three seconds, and clears it during navigation", async ({ page }) => {
    await page.goto("/");
    await article(page, "Plant cell");
    await expect(page.getByTestId("portal-cell")).toHaveCount(0);
    await page.getByRole("tab", { name: "Neuron — Wikipedia", exact: true }).click();
    await article(page, "Neuron");
    await selectRegion(page, false);
    const portal = page.getByTestId("portal-cell");
    await expect(portal).toHaveAttribute("aria-label", "Neuron 3D preview");
    await expect(portal).toHaveAttribute("data-model", "neuron");
    await expect(portal).toHaveAttribute("aria-busy", "true");
    await page.waitForTimeout(1800);
    await expect(portal).toHaveAttribute("data-state", "loading");
    await expect(portal).toHaveAttribute("data-state", "ready");
    await expect(portal.getByTestId("status-no-webgl")).toContainText(/neuron/i);
    await page.getByRole("tab", { name: "Plant cell — Wikipedia", exact: true }).click();
    await expect(portal).toHaveCount(0);
    await selectRegion(page, false);
    await expect(portal).toHaveAttribute("data-model", "plant-cell");
    await page.getByRole("tab", { name: "Neuron — Wikipedia", exact: true }).click();
    await expect(portal).toHaveCount(0);
    await page.waitForTimeout(3200);
    await expect(portal).toHaveCount(0);
    await command(page, "open Nerve cell");
    await article(page, "Neuron");
    await selectRegion(page);
    await expect(portal).toHaveAttribute("data-model", "neuron");
    await page.getByTestId("button-reload").click();
    await expect(portal).toHaveCount(0);
  });

  test("unsupported articles never substitute a cell scene and loading cannot open one", async ({ page }) => {
    await page.route("**/api/wiki/article?title=Slow*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({ status: 404, json: { error: "Unavailable test article" } });
    });
    await page.goto("/");
    await article(page, "Plant cell");
    await command(page, "open Slow article");
    await page.getByTestId("button-select-region").click();
    await expect(page.getByTestId("status-command")).toContainText("Wait for the Wikipedia article");
    await expect(page.getByTestId("portal-cell")).toHaveCount(0);
    for (const title of ["Bacteria", "Animal cell", "Photosynthesis"]) {
      await command(page, `open ${title}`);
      await article(page, title);
      await selectRegion(page);
      const portal = page.getByTestId("portal-cell");
      await expect(portal).toHaveAttribute("data-model", "unavailable");
      await expect(portal.getByTestId("status-model-unavailable")).toContainText(title);
      await expect(portal.getByTestId("cell-viewer")).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
  });
});

test.describe("real neuron geometry and interaction", () => {
  test.use({ webglEnabled: true });
  test.setTimeout(120_000);

  test("inspects anatomy and preserves the scene during expansion, then exports actual geometry", async ({ page }, testInfo) => {
    await page.goto("/");
    await article(page, "Plant cell");
    await page.getByRole("tab", { name: "Neuron — Wikipedia", exact: true }).click();
    await article(page, "Neuron");
    await selectRegion(page);
    const portal = page.getByTestId("portal-cell");
    const canvas = portal.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(portal.getByTestId("status-no-webgl")).toHaveCount(0);
    await canvas.evaluate((element) => element.setAttribute("data-test-scene", "persistent-neuron"));
    const expand = page.getByTestId("button-portal-expand");
    await expand.focus();
    await expand.press("Enter");
    await expect(portal).toHaveAttribute("data-motion", "settled");
    const viewer = portal.getByTestId("cell-viewer");
    await expect(viewer).toHaveAttribute("data-model", "neuron");
    await expect(portal).toHaveAttribute("role", "dialog");
    await withinViewport(page, portal);
    await page.getByTestId("button-mode-exterior").click();
    await expect(viewer).toHaveAttribute("data-mode", "exterior");
    await page.getByTestId("button-mode-cutaway").click();
    await expect(viewer).toHaveAttribute("data-mode", "cutaway");
    await expect(page.getByTestId("button-mode-exploded")).toHaveCount(0);
    const dendrite = page.getByTestId("chip-dendrites");
    await dendrite.focus(); await dendrite.press("Enter");
    await expect(viewer).toHaveAttribute("data-selected", "dendrites");
    await expect(page.getByTestId("panel-organelle")).toContainText("Dendrites");
    await expect(page.getByTestId("panel-organelle").locator('a[href^="https://"]')).not.toHaveCount(0);
    await page.getByTestId("button-isolate").click();
    await expect(page.getByTestId("button-isolate")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("chip-nucleus").focus(); await page.keyboard.press("Enter");
    await expect(viewer).toHaveAttribute("data-visibility", "isolate:nucleus");
    await dendrite.focus(); await dendrite.press("Enter");
    await expect(viewer).toHaveAttribute("data-visibility", "isolate:dendrites");
    await page.getByTestId("button-hide-others").click();
    await expect(page.getByTestId("button-hide-others")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("button-portal-collapse").click();
    await expect(portal).toHaveAttribute("data-motion", "settled");
    await expect(canvas).toHaveAttribute("data-test-scene", "persistent-neuron");
    await expect(viewer).toHaveAttribute("data-selected", "dendrites");
    await expand.focus(); await expand.press("Enter");
    await expect(portal).toHaveAttribute("data-motion", "settled");
    await expect(viewer).toHaveAttribute("data-selected", "dendrites");
    await page.getByTestId("button-reset-view").click();
    await expect(page.getByTestId("button-hide-others")).toHaveAttribute("aria-pressed", "false");
    // Keyboard access to the final part must scroll the capsule, even on phones.
    await page.getByTestId("chip-soma").focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("panel-organelle")).toContainText(/terminal/i);
    await withinViewport(page, page.getByTestId("chip-terminals"));
    await page.getByTestId("button-reset-view").click();
    // Observe the actual camera rather than repeatedly transferring full PNGs
    // from the software GPU during gestures. Exports below verify image output.
    await expect(canvas).toHaveAttribute("data-camera-pose", /position/);
    const before = await canvas.getAttribute("data-camera-pose");
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.48);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.66, box.y + box.height * 0.56, { steps: 3 });
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute("data-camera-pose", before!);
    await page.getByTestId("button-reset-view").click();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
    const unzoomed = await canvas.getAttribute("data-camera-pose");
    await page.mouse.wheel(0, -180);
    await expect(canvas).not.toHaveAttribute("data-camera-pose", unzoomed!);
    await page.getByTestId("button-reset-view").click();
    const [png] = await Promise.all([page.waitForEvent("download"), page.getByTestId("button-screenshot").click()]);
    expect(png.suggestedFilename()).toBe("neuron.png");
    const pngPath = testInfo.outputPath("neuron.png"); await png.saveAs(pngPath);
    const image = await readFile(pngPath);
    expect(image.subarray(1, 4).toString()).toBe("PNG");
    expect(image.length).toBeGreaterThan(15000);
    const [glb] = await Promise.all([page.waitForEvent("download"), page.getByTestId("button-export").click()]);
    expect(glb.suggestedFilename()).toBe("neuron.glb");
    const glbPath = testInfo.outputPath("neuron.glb"); await glb.saveAs(glbPath);
    const bytes = await readFile(glbPath);
    expect(bytes.subarray(0, 4).toString()).toBe("glTF");
    const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    expect(doc.meshes.length).toBeGreaterThan(8);
    const names = doc.nodes.map((node: { name?: string }) => node.name ?? "").join(" ").toLowerCase();
    for (const part of ["neuron", "soma", "dendrites", "axon", "myelin", "nodes", "terminals", "nucleus"]) expect(names).toContain(part);
    expect(names).not.toContain("chloroplast");
    await page.screenshot({ path: testInfo.outputPath("neuron-expanded.png") });
    await page.keyboard.press("Escape");
    await expect(expand).toBeFocused();
  });

  test("direct neuron view is explicit and the plant-cell link stays compatible", async ({ page }) => {
    await page.goto("/?view=neuron");
    await expect(page.getByTestId("cell-viewer")).toHaveAttribute("data-model", "neuron");
    await expect(page.getByTestId("chip-myelin")).toBeAttached();
    await page.getByTestId("chip-nucleus").focus(); await page.keyboard.press("Enter");
    await expect(page.getByTestId("panel-organelle")).toContainText("Nucleus");
    await expect(page.getByTestId("chip-chloroplast")).toHaveCount(0);
    await page.getByTestId("button-close-viewer").click();
    await article(page, "Plant cell");
    await page.goto("/?view=cell");
    await expect(page.getByTestId("cell-viewer")).toHaveAttribute("data-model", "plant-cell");
    await expect(page.getByTestId("chip-chloroplast")).toBeAttached();
    await expect(page.getByTestId("chip-dendrites")).toHaveCount(0);
  });
});
