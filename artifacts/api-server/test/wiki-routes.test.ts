import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import wikiRouter from "../src/routes/wiki.ts";

test("Wikipedia routes preserve empty results, errors, attribution, and provider backoff", async () => {
  const nativeFetch = globalThis.fetch;
  const providerCalls: URL[] = [];
  const app = express();
  app.use((req, _res, next) => {
    req.log = { warn() {} } as typeof req.log;
    next();
  });
  app.use(wikiRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.origin !== "https://en.wikipedia.org") return nativeFetch(input, options);
    providerCalls.push(url);
    assert.equal(url.pathname, "/w/api.php");
    if (url.searchParams.get("action") === "query") {
      assert.equal(url.searchParams.get("srnamespace"), "0");
      const query = url.searchParams.get("srsearch");
      if (query === "limited") return new Response("", { status: 429, headers: { "Retry-After": "120" } });
      if (query === "unavailable") return new Response("", { status: 503 });
      return Response.json({ query: { search: query === "empty" ? [] : [{ title: "Photosynthesis", snippet: "Real <span>provider</span> snippet." }] } });
    }
    const title = url.searchParams.get("page");
    if (title === "Missing") return Response.json({ error: { code: "missingtitle" } });
    if (title === "Invalid[") return Response.json({ error: { code: "invalidtitle" } });
    if (title === "Broken") return Response.json({ parse: {} });
    return Response.json({ parse: {
      title: title === "Redirect to special" ? "Wikipedia:About" : "Photosynthesis",
      revid: 123456,
      text: "<p>Article from provider.</p>",
      tocdata: { sections: [] },
    } });
  };

  try {
    const get = async (path: string) => {
      const response = await nativeFetch(`${base}${path}`);
      return { response, data: await response.json() };
    };
    const article = await get("/wiki/article?title=Photosynthesis");
    assert.equal(article.response.status, 200);
    assert.equal(article.data.revisionId, 123456);
    assert.equal(article.data.html, "<p>Article from provider.</p>");
    assert.equal((await get("/wiki/article?title=Missing")).response.status, 404);
    assert.equal((await get("/wiki/article?title=Invalid%5B")).response.status, 400);
    assert.equal((await get("/wiki/article?title=Broken")).response.status, 502);
    assert.equal((await get("/wiki/article?title=Special:Random")).response.status, 422);
    assert.equal((await get("/wiki/article?title=Redirect%20to%20special")).response.status, 422);
    assert.equal((await get("/wiki/article?title=%20")).response.status, 400);
    assert.deepEqual((await get("/wiki/search?q=empty")).data, []);
    assert.deepEqual((await get("/wiki/search?q=biology")).data, [{ title: "Photosynthesis", description: "Real provider snippet." }]);
    assert.equal((await get("/wiki/search?q=unavailable")).response.status, 502);
    const limited = await get("/wiki/search?q=limited");
    assert.equal(limited.response.status, 429);
    assert.equal(limited.response.headers.get("retry-after"), "120");
    const count = providerCalls.length;
    assert.equal((await get("/wiki/search?q=another")).response.status, 429);
    assert.equal(providerCalls.length, count, "provider cooldown prevents repeated requests");
    assert.equal((await get("/wiki/article?title=Photosynthesis")).response.status, 200, "cached articles remain readable during cooldown");
  } finally {
    globalThis.fetch = nativeFetch;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
