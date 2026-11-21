import { GetWikiArticleResponse } from "@workspace/api-zod";

// Known English Wikipedia namespaces and aliases. Colons in real article
// titles (for example "Star Trek: Voyager") remain valid.
export const unsupportedWikiTitle = (title: string) =>
  /^(?:Media|Special|Talk|User(?: talk)?|Wikipedia(?: talk)?|WP|WT|Project(?: talk)?|File(?: talk)?|Image(?: talk)?|MediaWiki(?: talk)?|Template(?: talk)?|Help(?: talk)?|Category(?: talk)?|CAT|Portal(?: talk)?|Module(?: talk)?|Draft(?: talk)?|TimedText(?: talk)?|Book(?: talk)?|Education Program(?: talk)?|Gadget(?: definition)?(?: talk)?|Topic)\s*:/i
    .test(title.replace(/_/g, " ").replace(/^:+/, "").trim());

interface ParsedPage {
  title: string;
  revid: number;
  text: string;
  redirects?: { tofragment?: string }[];
  tocdata: { sections: { anchor: string; line: string; hLevel: number }[] };
}

/** Validate the provider payload before publishing content or attribution. */
export function wikiArticleFromPage(value: unknown) {
  const page = value as ParsedPage | undefined;
  if (!page || typeof page.title !== "string" || typeof page.text !== "string" || !page.text.trim() || !Array.isArray(page.tocdata?.sections)) {
    throw new Error("Wikipedia returned an incomplete article");
  }
  if (unsupportedWikiTitle(page.title)) return null;
  const redirectAnchor = page.redirects?.slice().reverse().find((redirect) => redirect.tofragment)?.tofragment;
  return GetWikiArticleResponse.parse({
    title: page.title,
    html: page.text,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    revisionId: page.revid,
    ...(redirectAnchor ? { redirectAnchor: redirectAnchor.replace(/ /g, "_") } : {}),
    sections: page.tocdata.sections.map((section) => ({
      anchor: section.anchor,
      title: section.line.replace(/<[^>]*>/g, ""),
      level: section.hLevel,
    })),
  });
}
