import { strict as assert } from "node:assert";
import { test } from "node:test";
import { NEURON_ORDER, NEURON_PARTS } from "../components/cell/neuron-parts.ts";

test("every selectable neuron part has subject-correct explanatory metadata and sources", () => {
  assert.equal(new Set(NEURON_ORDER).size, 8);
  assert.deepEqual([...NEURON_ORDER].sort(), Object.keys(NEURON_PARTS).sort());
  for (const id of NEURON_ORDER) {
    const part = NEURON_PARTS[id];
    assert.ok(part.name && part.blurb && part.facts.length);
    assert.ok(part.sources?.some(s => s.url === "https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-nervous-tissue"));
    assert.ok(part.sources?.every(s => s.label && new URL(s.url).protocol === "https:"));
    assert.doesNotMatch(JSON.stringify(part), /chloroplast|photosynthesis|plant cell/i);
  }
  assert.match(NEURON_PARTS.myelin.facts.join(" "), /Not every axon is myelinated/);
  assert.match(NEURON_PARTS.nodes.facts.join(" "), /illustrative highlight/);
});
