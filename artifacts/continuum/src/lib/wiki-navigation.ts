export const WIKI = "https://en.wikipedia.org";

export const wikiUrl = (title: string, hash?: string) =>
  `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":")}${hash ? `#${encodeURIComponent(hash)}` : ""}`;

export const wikiSearchUrl = (query: string) =>
  `${WIKI}/w/index.php?search=${encodeURIComponent(query)}`;

export const searchEntry = (query: string) => `?search=${encodeURIComponent(query.trim())}`;
export const searchFromEntry = (value: string) =>
  value.startsWith("?search=") ? decode(value.slice(8)) : null;

export const normTitle = (title: string) => {
  const value = title.replace(/_/g, " ").trim();
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const decode = (value: string) => {
  try { return decodeURIComponent(value); } catch { return value; }
};

export const looksLikeUrl = (value: string) =>
  /^(?:https?:\/\/|\/\/|(?:[a-z-]+\.)*wikipedia\.org(?:\/|$))/i.test(value);

/** This reader uses English Wikipedia only. Never reinterpret another language's URL. */
export function titleFromUrl(raw: string): { title: string; hash?: string } | null {
  raw = raw.trim();
  if (!looksLikeUrl(raw.trim())) return null;
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : /^https?:/i.test(raw) ? raw : `https://${raw}`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (!["en.wikipedia.org", "en.m.wikipedia.org"].includes(url.hostname)) return null;
    let title: string | null = null;
    if (url.pathname.startsWith("/wiki/")) title = decode(url.pathname.slice(6));
    if (url.pathname === "/w/index.php" && (!url.searchParams.has("action") || url.searchParams.get("action") === "view")) {
      title = url.searchParams.get("title");
    }
    if (!title?.trim()) return null;
    return { title: normTitle(title), hash: url.hash ? decode(url.hash.slice(1)) : undefined };
  } catch {
    return null;
  }
}

export type LinkKind =
  | { kind: "article"; title: string; hash?: string }
  | { kind: "anchor"; id: string }
  | { kind: "external"; href: string };

const NS = /^(?:File|Image|Media|Special|Talk|User(?: talk)?|Wikipedia(?: talk)?|WP|WT|Help(?: talk)?|Template(?: talk)?|Category(?: talk)?|Portal(?: talk)?|Module(?: talk)?|Draft(?: talk)?|MediaWiki(?: talk)?|TimedText(?: talk)?)\s?:/i;

export function classifyHref(href: string): LinkKind {
  if (href.startsWith("#")) return { kind: "anchor", id: decode(href.slice(1)) };
  const local = href.match(/^(?:\.\/|\/wiki\/)([^?#]+)(?:\?[^#]*)?(?:#(.*))?$/);
  const page = local
    ? { title: normTitle(decode(local[1])), hash: local[2] ? decode(local[2]) : undefined }
    : titleFromUrl(href);
  if (page) {
    if (!NS.test(page.title)) return { kind: "article", ...page };
    return { kind: "external", href: wikiUrl(page.title, page.hash) };
  }
  if (href.startsWith("//")) return { kind: "external", href: `https:${href}` };
  if (href.startsWith("/")) return { kind: "external", href: WIKI + href };
  return { kind: "external", href };
}
