import { defineConfig } from "vitest/config";

// Keep tests independent of the preview server's required PORT and BASE_PATH.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
  },
});
