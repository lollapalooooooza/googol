import path from "node:path";
import express from "express";
import app from "./artifacts/api-server/src/app";

const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

async function start() {
  if (isProduction) {
    const publicDir = path.resolve(import.meta.dirname, "artifacts/continuum/dist/public");
    app.use(express.static(publicDir));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(publicDir, "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.resolve(import.meta.dirname, "artifacts/continuum/vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`googol server listening on http://0.0.0.0:${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
