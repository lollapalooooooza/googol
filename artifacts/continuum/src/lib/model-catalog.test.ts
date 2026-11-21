import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MODEL_INFO, modelFromView, resolveArticleModel } from "./model-catalog.ts";

test("only resolved supported subjects map to models", () => {
  assert.equal(resolveArticleModel("Plant cell"), "plant-cell");
  assert.equal(resolveArticleModel("Neuron"), "neuron");
  assert.equal(resolveArticleModel("plant_cell"), "plant-cell");
  for (const title of [undefined, null, "", "Bacteria", "Animal cell", "Cell (biology)", "Mirror neuron", "Motor neuron", "Neuron (journal)", "Neural network", "Plant cell wall"]) {
    assert.equal(resolveArticleModel(title), null, String(title));
  }
});
test("unresolved aliases do not guess a model before Wikipedia resolves them", () => {
  assert.equal(resolveArticleModel("Neurone"), null);
  assert.equal(resolveArticleModel("Nerve cell"), null);
  assert.equal(resolveArticleModel("Neuron"), "neuron");
});
test("direct model links are explicit and the existing plant link still works", () => {
  assert.equal(modelFromView("cell"), "plant-cell");
  assert.equal(modelFromView("plant-cell"), "plant-cell");
  assert.equal(modelFromView("neuron"), "neuron");
  for (const view of [null, "", "bacteria", "neurons", "random"]) assert.equal(modelFromView(view), null);
});
test("every supported model has distinct export identity and explanatory copy", () => {
  assert.notEqual(MODEL_INFO.neuron.filename, MODEL_INFO["plant-cell"].filename);
  assert.match(MODEL_INFO.neuron.description, /not all neurons are myelinated/);
});
