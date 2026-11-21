export type ModelId = "plant-cell" | "neuron";

export const MODEL_INFO: Record<ModelId, { title: string; filename: string; description: string }> = {
  "plant-cell": { title: "Plant cell", filename: "plant-cell", description: "A sculptural plant-cell cutaway." },
  neuron: { title: "Neuron", filename: "neuron", description: "An illustrative myelinated neuron. Not to scale; not all neurons are myelinated." },
};

/** Use only the canonical title returned by a successful Wikipedia response. */
export function resolveArticleModel(canonicalTitle: string | null | undefined): ModelId | null {
  switch (canonicalTitle?.trim().replaceAll("_", " ").toLowerCase()) {
    case "plant cell": return "plant-cell";
    case "neuron": return "neuron";
    default: return null;
  }
}

/** Preserve the original direct plant-cell link without guessing other models. */
export function modelFromView(view: string | null): ModelId | null {
  if (view === "cell" || view === "plant-cell") return "plant-cell";
  if (view === "neuron") return "neuron";
  return null;
}
