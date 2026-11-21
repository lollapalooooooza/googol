export type NeuronPartId = "soma" | "nucleus" | "dendrites" | "hillock" | "axon" | "myelin" | "nodes" | "terminals";
export type NeuronMode = "exterior" | "cutaway";

export interface PartSource { label: string; url: string }
export interface PartInfo { name: string; color: string; blurb: string; facts: string[]; sources?: PartSource[] }

/** Palette: white-matter ivory myelin against a madder-rose grey-matter body, teal nodes, ochre release sites. */
const PARTS: Record<NeuronPartId, PartInfo> = {
  soma: {
    name: "Cell body (soma)", color: "#b75a6c",
    blurb: "The neuron's metabolic centre. Its cytoplasm is packed with rough ER clusters (Nissl bodies) that make the proteins shipped out to dendrites and axon.",
    facts: ["Contains the nucleus and most major organelles", "Shape and size differ between neuron types", "Integrates inputs arriving from the dendrites"],
    sources: [{ label: "Wikipedia: Soma (biology)", url: "https://en.wikipedia.org/wiki/Soma_(biology)" }],
  },
  nucleus: {
    name: "Nucleus", color: "#4e4f93",
    blurb: "Holds the cell's DNA inside a nuclear envelope. Neuronal nuclei are usually large and pale with a prominent nucleolus, reflecting heavy gene expression.",
    facts: ["Sits near the centre of the soma", "Prominent nucleolus builds ribosome subunits", "Most mature neurons no longer divide"],
    sources: [{ label: "Wikipedia: Cell nucleus", url: "https://en.wikipedia.org/wiki/Cell_nucleus" }],
  },
  dendrites: {
    name: "Dendrites", color: "#cf8a86",
    blurb: "Tapering, branching extensions that receive most synaptic input. Many carry small dendritic spines, each typically hosting an excitatory synapse.",
    facts: ["Branches thin out with distance from the soma", "Spines can change shape with learning", "Branching pattern differs between neuron types"],
    sources: [{ label: "Wikipedia: Dendrite", url: "https://en.wikipedia.org/wiki/Dendrite" }],
  },
  hillock: {
    name: "Axon hillock", color: "#dc8a5a",
    blurb: "The cone-shaped region where the axon leaves the soma. It leads into the axon initial segment, where action potentials usually begin.",
    facts: ["Lacks Nissl bodies, unlike the rest of the soma", "Initial segment is rich in voltage-gated sodium channels", "Typically unmyelinated"],
    sources: [{ label: "Wikipedia: Axon hillock", url: "https://en.wikipedia.org/wiki/Axon_hillock" }],
  },
  axon: {
    name: "Axon", color: "#7d4a72",
    blurb: "A single long projection that carries signals away from the soma. Its length ranges from under a millimetre to over a metre in some motor neurons.",
    facts: ["Usually one axon per neuron, though it may branch", "Microtubules carry cargo along its length", "Diameter influences conduction speed"],
    sources: [{ label: "Wikipedia: Axon", url: "https://en.wikipedia.org/wiki/Axon" }],
  },
  myelin: {
    name: "Myelin sheath", color: "#e8d6a4",
    blurb: "Layers of membrane wrapped around the axon by Schwann cells (peripheral) or oligodendrocytes (central). It insulates segments called internodes.",
    facts: ["Rich in lipid, which makes white matter pale", "Not every axon is myelinated", "Myelination speeds conduction substantially"],
    sources: [{ label: "Wikipedia: Myelin", url: "https://en.wikipedia.org/wiki/Myelin" }],
  },
  nodes: {
    name: "Nodes of Ranvier", color: "#3f8e88",
    blurb: "Short gaps between myelin segments where the axon membrane is exposed. Clustered sodium channels here let the signal jump node to node (saltatory conduction).",
    facts: ["Exposed axon membrane lies between the sheaths", "Wrapped stretches between nodes are called internodes", "The teal colour here is an illustrative highlight"],
    sources: [{ label: "Wikipedia: Node of Ranvier", url: "https://en.wikipedia.org/wiki/Node_of_Ranvier" }],
  },
  terminals: {
    name: "Axon terminals", color: "#cf9a3a",
    blurb: "The axon's end branches (telodendria) swell into synaptic boutons, which store neurotransmitter in vesicles and release it onto target cells.",
    facts: ["One axon can form thousands of synapses", "Boutons sit across a narrow synaptic cleft", "Release is triggered by calcium entry"],
    sources: [{ label: "Wikipedia: Axon terminal", url: "https://en.wikipedia.org/wiki/Axon_terminal" }],
  },
};

const OPENSTAX: PartSource = { label: "OpenStax Anatomy & Physiology 2e, 12.2 Nervous Tissue", url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-nervous-tissue" };
export const NEURON_PARTS = Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, { ...v, sources: [OPENSTAX, ...(v.sources ?? [])] }])) as Record<NeuronPartId, PartInfo>;

export const NEURON_ORDER: NeuronPartId[] = ["soma", "nucleus", "dendrites", "hillock", "axon", "myelin", "nodes", "terminals"];
