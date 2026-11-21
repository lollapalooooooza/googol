import assert from "node:assert/strict";
import test from "node:test";
import { classifyHref, normTitle, searchEntry, searchFromEntry, titleFromUrl, wikiUrl } from "./wiki-navigation.ts";

test("opens English desktop, mobile, and index.php article URLs with fragments", () => {
  for (const input of [
    "https://en.wikipedia.org/wiki/Cell_(biology)#Animal_cells",
    "en.m.wikipedia.org/wiki/Cell_(biology)#Animal_cells",
    "//en.wikipedia.org/wiki/Cell_(biology)#Animal_cells",
    " https://en.wikipedia.org/w/index.php?title=Cell_%28biology%29#Animal_cells ",
  ]) {
    assert.deepEqual(titleFromUrl(input), { title: "Cell (biology)", hash: "Animal_cells" });
  }
});

test("does not reinterpret other languages, lookalike hosts, or external actions", () => {
  for (const input of [
    "https://fr.wikipedia.org/wiki/Paris",
    "https://en.wikipedia.org.evil.test/wiki/Plant_cell",
    "https://evil.test/wikipedia.org/w/index.php?title=Plant_cell",
    "https://en.wikipedia.org@evil.test/wiki/Plant_cell",
    "https://en.wikipedia.org/w/index.php?title=Plant_cell&action=edit",
    "javascript:alert(1)",
  ]) assert.equal(titleFromUrl(input), null, input);
});

test("malformed percent encodings never crash article navigation", () => {
  assert.doesNotThrow(() => titleFromUrl("https://en.wikipedia.org/wiki/100%ZZ#bad%"));
  assert.deepEqual(classifyHref("#bad%"), { kind: "anchor", id: "bad%" });
  assert.equal(classifyHref("/wiki/100%ZZ").kind, "article");
});

test("keeps internal articles in the reader and special pages on Wikipedia", () => {
  assert.deepEqual(classifyHref("./Photosynthesis#Overview"), { kind: "article", title: "Photosynthesis", hash: "Overview" });
  assert.equal(classifyHref("/wiki/File:Plant_cell.svg").kind, "external");
  assert.equal(classifyHref("/wiki/Category:Biology").kind, "external");
  assert.equal(classifyHref("https://de.wikipedia.org/wiki/Biologie").kind, "external");
  assert.equal(classifyHref("https://en.m.wikipedia.org/wiki/Neuron").kind, "article");
});

test("search history and article URLs preserve punctuation and Unicode", () => {
  const query = "DNA & RNA # α / β ?";
  assert.equal(searchFromEntry(searchEntry(query)), query);
  assert.equal(searchFromEntry("Plant cell"), null);
  assert.equal(normTitle(" plant_cell "), "Plant cell");
  assert.equal(wikiUrl("DNA & RNA", "A/B"), "https://en.wikipedia.org/wiki/DNA_%26_RNA#A%2FB");
});
