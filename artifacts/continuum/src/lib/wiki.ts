import DOMPurify from "dompurify";
import { classifyHref, wikiUrl, WIKI } from "./wiki-navigation";
export {
  classifyHref,
  normTitle,
  titleFromUrl,
  wikiUrl,
  wikiSearchUrl,
  googleSearchUrl,
  looksLikeUrl,
  searchEntry,
  searchFromEntry,
  chromeSearchEntry,
  chromeSearchFromEntry,
  WIKI,
} from "./wiki-navigation";

const fixUrl = (u: string) => (u.startsWith("//") ? "https:" + u : u.startsWith("/") && !u.startsWith("//") ? WIKI + u : u);

/** Sanitize Wikipedia HTML: strip active content, normalize media URLs, mark links. */
export function sanitizeWiki(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "style", "link", "meta", "form", "input", "button", "textarea", "select", "option", "iframe", "object", "embed", "base", "noscript", "audio", "video", "source", "track"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "formaction", "autofocus"],
    ADD_ATTR: ["typeof", "rel"],
  });
  const doc = new DOMParser().parseFromString(`<div id="__r">${clean}</div>`, "text/html");
  const root = doc.getElementById("__r");
  if (!root) return "";
  root.querySelectorAll(".mw-editsection, .navbox, .navbox-styles, .mw-empty-elt, .sistersitebox, .noprint.portalbox, .mw-authority-control").forEach((n) => n.remove());
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) img.setAttribute("src", fixUrl(src));
    const set = img.getAttribute("srcset");
    if (set) img.setAttribute("srcset", set.split(",").map((p) => fixUrl(p.trim())).join(", "));
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    img.removeAttribute("resource");
  });
  root.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const k = classifyHref(href);
    a.setAttribute("data-kind", k.kind);
    if (k.kind === "article") a.setAttribute("href", wikiUrl(k.title, k.hash));
    if (k.kind === "external") {
      if (!/^(?:https?:|mailto:)/i.test(k.href)) { a.removeAttribute("href"); return; }
      a.setAttribute("href", k.href);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
  return root.innerHTML;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
