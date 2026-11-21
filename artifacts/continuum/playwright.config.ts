import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const managedChromium = "/repl/tools/bin/chromium";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  outputDir: "../../generated-artifacts/continuum/test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../generated-artifacts/continuum/playwright-report", open: "never" }],
  ],
  use: {
    // Use the existing managed workflow through the shared artifact proxy.
    baseURL: process.env.CONTINUUM_TEST_URL ?? "http://localhost:80",
    browserName: "chromium",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync(managedChromium) ? managedChromium : undefined),
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "narrow", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
