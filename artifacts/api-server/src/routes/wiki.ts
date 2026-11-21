import { Router, type IRouter } from "express";
import {
  GetWikiArticleQueryParams,
  SearchWikiQueryParams,
  SearchWikiResponse,
} from "@workspace/api-zod";
import { unsupportedWikiTitle, wikiArticleFromPage } from "../lib/wiki-content";

const router: IRouter = Router();
const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
let rateLimitUntil = 0;
class WikipediaRateLimitError extends Error {
  constructor() { super("Wikipedia is temporarily limiting requests. Please try again shortly."); }
}

// Only this fixed public endpoint is fetched. User input never supplies a host.
async function wikipedia(params: Record<string, string>): Promise<any> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ format: "json", formatversion: "2", ...params }).toString();
  const key = url.toString();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (pending.has(key)) return pending.get(key);
  if (Date.now() < rateLimitUntil) throw new WikipediaRateLimitError();
  const request = (async () => {
    const response = await fetch(url, {
      headers: { "User-Agent": "GoogolBiologyReader/1.0 (educational Wikipedia reader)", Accept: "application/json" },
      signal: AbortSignal.timeout(18000),
      redirect: "error",
    });
    if (response.status === 429) {
      const delay = response.headers.get("retry-after") ?? "";
      const seconds = Number(delay) || Math.ceil((Date.parse(delay) - Date.now()) / 1000) || 60;
      rateLimitUntil = Date.now() + Math.max(1, Math.min(seconds, 300)) * 1000;
      throw new WikipediaRateLimitError();
    }
    if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
    const value = await response.json();
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    // Do not turn a temporary provider error into a cached outage.
    if (value && typeof value === "object" && !("error" in value)) cache.set(key, { expires: Date.now() + 300000, value });
    return value;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

router.get("/wiki/article", async (req, res): Promise<void> => {
  const query = GetWikiArticleQueryParams.safeParse(req.query);
  if (!query.success || !query.data.title.trim()) {
    res.status(400).json({ error: "Enter an article title between 1 and 250 characters." });
    return;
  }
  const title = query.data.title.trim().replace(/_/g, " ");
  if (unsupportedWikiTitle(title)) {
    res.status(422).json({ error: "googol reads English Wikipedia encyclopedia articles only. File, category, account, and other special pages must be opened on Wikipedia." });
    return;
  }
  try {
    const result = await wikipedia({
      action: "parse",
      page: title,
      prop: "text|tocdata|revid",
      redirects: "1",
      disableeditsection: "1",
      disabletoc: "1",
    });
    if (result.error) {
      const missing = result.error.code === "missingtitle";
      const invalid = ["invalidtitle", "interwiki", "badtitle"].includes(result.error.code);
      res.status(missing ? 404 : invalid ? 400 : 502).json({
        error: missing ? "This Wikipedia article was not found. Try searching for another title." : invalid ? "This is not a supported English Wikipedia article title." : "Wikipedia could not provide this article.",
      });
      return;
    }
    const article = wikiArticleFromPage(result.parse);
    if (!article) {
      res.status(422).json({ error: "This title redirects to a special Wikipedia page, not an encyclopedia article. Open it on Wikipedia instead." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(article);
  } catch (error) {
    req.log.warn({ err: error }, "Wikipedia article fetch failed");
    if (error instanceof WikipediaRateLimitError) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((rateLimitUntil - Date.now()) / 1000)));
      res.status(429).json({ error: error.message });
      return;
    }
    res.status(502).json({ error: "Wikipedia is temporarily unavailable. Please retry or open the original article." });
  }
});

router.get("/wiki/search", async (req, res): Promise<void> => {
  const query = SearchWikiQueryParams.safeParse(req.query);
  if (!query.success || !query.data.q.trim()) {
    res.status(400).json({ error: "Enter a search between 1 and 250 characters." });
    return;
  }
  try {
    const result = await wikipedia({ action: "query", list: "search", srsearch: query.data.q.trim(), srnamespace: "0", srlimit: "8", srprop: "snippet" });
    if (!Array.isArray(result.query?.search)) throw new Error("Wikipedia returned an invalid search response");
    res.json(SearchWikiResponse.parse(result.query.search.map((s: { title: string; snippet: string }) => ({
      title: s.title,
      description: s.snippet.replace(/<[^>]*>/g, ""),
    }))));
  } catch (error) {
    req.log.warn({ err: error }, "Wikipedia search failed");
    if (error instanceof WikipediaRateLimitError) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((rateLimitUntil - Date.now()) / 1000)));
      res.status(429).json({ error: error.message });
      return;
    }
    res.status(502).json({ error: "Wikipedia search is temporarily unavailable. Please retry." });
  }
});

export default router;
