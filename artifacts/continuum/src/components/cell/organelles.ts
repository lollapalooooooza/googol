export type OrganelleId = "wall" | "cytoplasm" | "vacuole" | "nucleus" | "er" | "golgi" | "chloroplast" | "mitochondrion" | "ribosome";
export type ViewMode = "exterior" | "cutaway" | "exploded";

export const ORGANELLES: Record<OrganelleId, { name: string; color: string; blurb: string; facts: string[] }> = {
  wall: {
    name: "Cell wall", color: "#9db45a",
    blurb: "A rigid layer of cellulose microfibrils embedded in hemicellulose and pectin. It resists turgor pressure and gives the plant its shape.",
    facts: ["Primary walls are roughly 0.1–1 µm thick", "Plasmodesmata channels connect neighbouring cells", "The plasma membrane lines its inner face"],
  },
  cytoplasm: {
    name: "Cytoplasm & cytoskeleton", color: "#6f9a8f",
    blurb: "The cytosol and its protein filaments. Actin cables drive cytoplasmic streaming, carrying chloroplasts and vesicles around the cell.",
    facts: ["Microtubules guide cellulose deposition", "Streaming speeds can reach several µm per second", "Also hosts small vesicles and peroxisomes"],
  },
  vacuole: {
    name: "Central vacuole", color: "#7fa9cf",
    blurb: "A membrane-bound sac (bounded by the tonoplast) that stores water, ions and pigments, and pushes the cytoplasm against the wall to keep the cell turgid.",
    facts: ["Can occupy 30–80% of cell volume", "Acidic interior, often pH 5–5.5", "Wilting is vacuoles losing water"],
  },
  nucleus: {
    name: "Nucleus", color: "#8f68cf",
    blurb: "Holds the cell's chromosomes inside a double-membrane envelope perforated by nuclear pores. The dense nucleolus assembles ribosome subunits.",
    facts: ["Typically 5–10 µm across in plant cells", "Envelope is continuous with the ER", "Nucleolus makes rRNA"],
  },
  er: {
    name: "Endoplasmic reticulum", color: "#8d6bd0",
    blurb: "A network of membrane sheets and tubules. Rough ER is studded with ribosomes and folds secreted proteins; smooth ER makes lipids.",
    facts: ["Continuous with the outer nuclear membrane", "Passes through plasmodesmata as the desmotubule", "Sends cargo to the Golgi in vesicles"],
  },
  golgi: {
    name: "Golgi apparatus", color: "#e07a5f",
    blurb: "Stacks of flattened cisternae that modify, sort and package proteins and polysaccharides. In plants it synthesizes wall pectins and hemicelluloses.",
    facts: ["Plant cells contain many separate stacks (dictyosomes)", "Has a cis (receiving) and trans (shipping) face", "Buds vesicles toward the membrane"],
  },
  chloroplast: {
    name: "Chloroplast", color: "#6fa64a",
    blurb: "The site of photosynthesis. Light reactions run on stacked thylakoids (grana); the Calvin cycle fixes CO₂ in the surrounding stroma.",
    facts: ["About 5–10 µm long", "Has its own circular DNA", "Descended from an engulfed cyanobacterium"],
  },
  mitochondrion: {
    name: "Mitochondrion", color: "#e8833a",
    blurb: "Performs aerobic respiration. The folded inner membrane (cristae) carries the electron transport chain and ATP synthase.",
    facts: ["Plant cells have both mitochondria and chloroplasts", "Cristae greatly increase membrane area", "Contains its own genome"],
  },
  ribosome: {
    name: "Ribosomes", color: "#4a3a6b",
    blurb: "Molecular machines that translate mRNA into protein, free in the cytosol or bound to rough ER.",
    facts: ["80S in the cytosol, 70S inside plastids and mitochondria", "About 25–30 nm across", "Built from rRNA and protein"],
  },
};

export const ORGANELLE_ORDER: OrganelleId[] = ["wall", "vacuole", "nucleus", "er", "golgi", "chloroplast", "mitochondrion", "ribosome", "cytoplasm"];
