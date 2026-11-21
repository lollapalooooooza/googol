import assert from "node:assert/strict";
import test from "node:test";
import { unsupportedWikiTitle, wikiArticleFromPage } from "../src/lib/wiki-content.ts";

// Provider-shaped fixtures only, never served to readers.
const page = () => ({
  title: "Cell (biology)",
  revid: 123456,
  text: '<p>Provider article text.</p><h2 id="Animal_cells">Animal cells</h2>',
  tocdata: { sections: [{ anchor: "Animal_cells", line: "<i>Animal</i> cells", hLevel: 2 }] },
  redirects: [{ from: "Animal cell", to: "Cell (biology)", tofragment: "Animal cells" }],
});

test("attributes the actual provider title and revision and preserves redirect sections", () => {
  const result = wikiArticleFromPage(page());
  assert.ok(result);
  assert.equal(result.title, "Cell (biology)");
  assert.equal(result.revisionId, 123456);
  assert.equal(result.redirectAnchor, "Animal_cells");
  assert.equal(result.url, "https://en.wikipedia.org/wiki/Cell_(biology)");
  assert.deepEqual(result.sections, [{ anchor: "Animal_cells", title: "Animal cells", level: 2 }]);
  assert.equal(result.html, page().text);
});

test("rejects missing content, invalid attribution, and malformed provider payloads", () => {
  for (const value of [
    undefined, {}, { ...page(), text: "" }, { ...page(), revid: 0 },
    { ...page(), revid: undefined }, { ...page(), tocdata: undefined },
    { ...page(), tocdata: { sections: [{ anchor: "x", line: "x", hLevel: "bad" }] } },
  ]) assert.throws(() => wikiArticleFromPage(value));
});

test("special pages and aliases are unsupported, including redirected destinations", () => {
  for (const title of ["Special:Random", "File:Example.svg", "WP:About", ":Category:Biology", "User_talk:Example", "Template:Example", "Portal:Biology"]) {
    assert.equal(unsupportedWikiTitle(title), true, title);
  }
  assert.equal(wikiArticleFromPage({ ...page(), title: "Wikipedia:About" }), null);
  for (const title of ["Plant cell", "Mitochondria", "Star Trek: Voyager"]) assert.equal(unsupportedWikiTitle(title), false, title);
});
