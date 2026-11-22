import type { VisualizationId } from "./visualizations";

export interface SearchIntent {
  rawQuery: string;
  effectiveQuery: string;
  correctedFrom: string | null;
  matchedExhibit: VisualizationId | null;
  wikiTitle: string | null;
}

export interface ChromeWebResult {
  id: string;
  title: string;
  displayUrl: string;
  siteName: string;
  snippet: string;
  wikiTitle?: string;
  externalUrl?: string;
  newsEntry?: boolean;
  viewModel?: VisualizationId;
  sitelinks?: Array<{ label: string; wikiTitle?: string; viewModel?: VisualizationId }>;
}

export interface ChromeImageResult {
  id: string;
  src: string;
  alt: string;
  caption: string;
  source: string;
  aspect: string;
}

export interface ChromeKnowledgeCard {
  title: string;
  subtitle: string;
  summary: string;
  heroImage: string;
  heroAlt: string;
  wikiTitle?: string;
  viewModel?: VisualizationId;
  specs: Array<{ label: string; value: string }>;
}

const basePrefix = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
  ? import.meta.env.BASE_URL.replace(/\/$/, "")
  : "";

export const thumbUrl = (file: string) => `${basePrefix}/eiffel-thumbs/${file}`;

const EIFFEL_TYPO_RE = /^(?:effie|effiel|eifel|eiffle|eifell|eiffel|la\s+tour\s+eiffel|tour\s+eiffel)(?:\s+tower)?$/i;
const EIFFEL_ZH_RE = /埃菲尔铁塔|艾菲尔铁塔/;

export function normalizeSearchIntent(raw: string): SearchIntent {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return { rawQuery: "", effectiveQuery: "", correctedFrom: null, matchedExhibit: null, wikiTitle: null };
  }

  if (EIFFEL_TYPO_RE.test(lower) || EIFFEL_ZH_RE.test(trimmed)) {
    const exactEiffel = /^eiffel tower$/i.test(trimmed);
    return {
      rawQuery: trimmed,
      effectiveQuery: "Eiffel Tower",
      correctedFrom: exactEiffel ? null : trimmed,
      matchedExhibit: "eiffel",
      wikiTitle: "Eiffel Tower",
    };
  }

  if (/^(?:mars|mars planet|red planet|mars outpost)$/i.test(lower)) {
    return {
      rawQuery: trimmed,
      effectiveQuery: "Mars",
      correctedFrom: /^mars$/i.test(trimmed) ? null : null,
      matchedExhibit: "mars",
      wikiTitle: "Mars",
    };
  }

  if (/^(?:plant cell|plantcell)$/i.test(lower)) {
    return {
      rawQuery: trimmed,
      effectiveQuery: "Plant cell",
      correctedFrom: null,
      matchedExhibit: "plant-cell",
      wikiTitle: "Plant cell",
    };
  }

  if (/^(?:neuron|nerve cell)$/i.test(lower)) {
    return {
      rawQuery: trimmed,
      effectiveQuery: "Neuron",
      correctedFrom: null,
      matchedExhibit: "neuron",
      wikiTitle: "Neuron",
    };
  }

  if (/^(?:jensen huang|jensen|nvidia jensen)$/i.test(lower)) {
    return {
      rawQuery: trimmed,
      effectiveQuery: "Jensen Huang",
      correctedFrom: null,
      matchedExhibit: "jensen-video",
      wikiTitle: "Jensen Huang",
    };
  }

  return {
    rawQuery: trimmed,
    effectiveQuery: trimmed,
    correctedFrom: null,
    matchedExhibit: null,
    wikiTitle: null,
  };
}

export function resolveChromeVisualization(query: string | null | undefined): VisualizationId | null {
  if (!query) return null;
  return normalizeSearchIntent(query).matchedExhibit;
}

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SponsoredTourCard {
  id: string;
  title: string;
  price: string;
  provider: string;
  image: string;
  alt: string;
}

export const EIFFEL_ELEVATION_PLATE_SRC = thumbUrl("55_elevation_plate.jpg");

/**
 * Natural aspect ratio of Plate #55 (`55_elevation_plate.jpg`: 736 x 1400).
 * Keeps Gustave Eiffel's complete 1:1,000 elevation drawing framed top-to-bottom without clipping.
 */
export const EIFFEL_PLATE_ASPECT = 736 / 1400;

export function computeCenteredPlateRect(vw: number, vh: number, extraBottomReserve = 0): BoxRect {
  const safeW = Math.max(320, vw);
  const safeH = Math.max(400, vh);
  const bottomBarReserve = 96 + Math.max(0, extraBottomReserve);
  const topMargin = 26;
  const usableH = Math.max(200, safeH - bottomBarReserve - topMargin);
  let h = Math.min(usableH * 0.92, 740);
  let w = h * EIFFEL_PLATE_ASPECT;
  const maxW = safeW * 0.44;
  if (w > maxW) {
    w = maxW;
    h = w / EIFFEL_PLATE_ASPECT;
  }
  return {
    x: Math.round((safeW - w) / 2),
    y: Math.round(topMargin + (usableH - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  };
}

export function pickBestImageForMarquee<T extends { rect: BoxRect }>(
  marquee: BoxRect,
  candidates: T[],
): T | null {
  let best: T | null = null;
  let bestOverlap = 0;
  for (const c of candidates) {
    const ix = Math.max(0, Math.min(marquee.x + marquee.w, c.rect.x + c.rect.w) - Math.max(marquee.x, c.rect.x));
    const iy = Math.max(0, Math.min(marquee.y + marquee.h, c.rect.y + c.rect.h) - Math.max(marquee.y, c.rect.y));
    const overlap = ix * iy;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = c;
    }
  }
  return best;
}

export const EIFFEL_CHROME_IMAGES: ChromeImageResult[] = [
  {
    id: "eiffel-plate",
    src: EIFFEL_ELEVATION_PLATE_SRC,
    alt: "ÉLÉVATION Fig. 1 — Échelle 0.001 p. m. Gustave Eiffel 1:1000 architectural elevation drawing",
    caption: "ÉLÉVATION Fig. 1 · Échelle 0.001 p. m. (1884)",
    source: "La Tour de 300 Mètres · Plate 55",
    aspect: "736/1400",
  },
  {
    id: "eiffel-1889",
    src: thumbUrl("18_completed_1889.jpg"),
    alt: "Eiffel Tower photographed in May 1889 from the Champ-de-Mars",
    caption: "1889 Exposition Universelle — 312 m Summit",
    source: "Archives Neurdein · Paris",
    aspect: "3/4",
  },
  {
    id: "eiffel-arch",
    src: thumbUrl("36_great_arch.jpg"),
    alt: "View beneath the 74-meter decorative iron arch of the Eiffel Tower",
    caption: "74 m Decorative Arch & Central Dome",
    source: "Library of Congress · 1889",
    aspect: "4/3",
  },
  {
    id: "eiffel-second",
    src: thumbUrl("01_second_platform.jpg"),
    alt: "Eiffel Tower construction on 21 August 1888 showing second platform completion",
    caption: "Second Platform Complete · Aug 1888",
    source: "Durandelle · BnF Gallica",
    aspect: "4/3",
  },
  {
    id: "eiffel-cranes",
    src: thumbUrl("14_320.jpg"),
    alt: "Second-stage piers and climbing creeper cranes on 15 May 1888",
    caption: "Climbing Creeper Cranes · May 1888",
    source: "Durandelle · Plate 6",
    aspect: "4/3",
  },
  {
    id: "eiffel-caissons",
    src: thumbUrl("13_320.jpg"),
    alt: "Pneumatic foundation caissons beside the Seine on 21 April 1887",
    caption: "Pneumatic Caissons · April 1887",
    source: "Durandelle · Plate 2",
    aspect: "4/3",
  },
];

export const EIFFEL_SPONSORED_TOURS: SponsoredTourCard[] = [
  {
    id: "tour-skip",
    title: "Paris: Eiffel Tower Skip-th...",
    price: "$54",
    provider: "Viator",
    image: thumbUrl("18_completed_1889.jpg"),
    alt: "Eiffel Tower skip-the-line ticket",
  },
  {
    id: "tour-summit",
    title: "Eiffel Tower Entry: Summi...",
    price: "$60",
    provider: "GetYourGuide",
    image: thumbUrl("36_great_arch.jpg"),
    alt: "Eiffel Tower summit access",
  },
  {
    id: "tour-seine",
    title: "Fast-Access Seine River...",
    price: "$20",
    provider: "GetYourGuide",
    image: thumbUrl("38_320.jpg"),
    alt: "Seine River and Eiffel Tower view",
  },
  {
    id: "tour-stair",
    title: "Paris: Eiffel Tower Stair...",
    price: "$23",
    provider: "Viator",
    image: thumbUrl("01_second_platform.jpg"),
    alt: "Eiffel Tower second platform stairs",
  },
  {
    id: "tour-climb",
    title: "Paris Eiffel Tower Climbi...",
    price: "$59",
    provider: "Viator",
    image: thumbUrl("46_320.jpg"),
    alt: "Eiffel Tower guided climb",
  },
];

export const EIFFEL_KNOWLEDGE_CARD: ChromeKnowledgeCard = {
  title: "Eiffel Tower",
  subtitle: "Tower in Paris, France",
  summary:
    "Constructed between January 1887 and March 1889 as the entrance centerpiece for the 1889 Exposition Universelle in Paris. Engineered by Maurice Koechlin, Émile Nouguier, and Stephen Sauvestre under Gustave Eiffel's company, using 18,038 puddle-iron pieces joined by 2.5 million rivets.",
  heroImage: thumbUrl("18_completed_1889.jpg"),
  heroAlt: "Eiffel Tower in Paris, May 1889 archival photograph",
  wikiTitle: "Eiffel Tower",
  viewModel: "eiffel",
  specs: [
    { label: "Location", value: "Champ-de-Mars, 5 Av. Anatole France, 75007 Paris" },
    { label: "Height", value: "330 m (1,083 ft); 312 m at 1889 inauguration" },
    { label: "Construction started", value: "January 28, 1887" },
    { label: "Opened", value: "March 31, 1889" },
    { label: "Architect & Engineers", value: "Stephen Sauvestre, Maurice Koechlin, Émile Nouguier" },
  ],
};

export function getCuratedChromeContent(intent: SearchIntent): {
  results: ChromeWebResult[];
  images: ChromeImageResult[];
  knowledge: ChromeKnowledgeCard | null;
} {
  if (intent.matchedExhibit === "eiffel") {
    return {
      knowledge: EIFFEL_KNOWLEDGE_CARD,
      images: EIFFEL_CHROME_IMAGES,
      results: [
        {
          id: "res-eiffel-wiki",
          title: "Eiffel Tower - Wikipedia",
          displayUrl: "https://en.wikipedia.org › wiki › Eiffel_Tower",
          siteName: "Wikipedia",
          snippet:
            "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. Constructed from 1887 to 1889 for the 1889 World's Fair, it rises 330 metres tall.",
          wikiTitle: "Eiffel Tower",
          sitelinks: [
            { label: "Design & 1887–1889 Construction", wikiTitle: "Eiffel Tower#History" },
            { label: "Open 3D 1889 Exhibition", viewModel: "eiffel" },
          ],
        },
        {
          id: "res-eiffel-repo",
          title: "La Tour de 300 Mètres (1887–1889) — Interactive 3D Construction Model",
          displayUrl: "https://github.com › lollapalooooooza › Eiffel-Tower",
          siteName: "Archival 3D Reconstruction",
          snippet:
            "Explore the 18,038-piece riveted wrought-iron structure across five construction zones from the 1887 pneumatic caissons beside the Seine to the 1889 summit phare and Paris Exposition grounds.",
          viewModel: "eiffel",
        },
        {
          id: "res-eiffel-champ",
          title: "Champ de Mars & 1889 Exposition Universelle - Wikipedia",
          displayUrl: "https://en.wikipedia.org › wiki › Exposition_Universelle_(1889)",
          siteName: "Wikipedia",
          snippet:
            "Held in Paris from 5 May to 31 October 1889 to celebrate the centenary of the French Revolution, featuring the Eiffel Tower as the monumental entrance arch.",
          wikiTitle: "Exposition Universelle (1889)",
        },
        {
          id: "res-eiffel-gustave",
          title: "Gustave Eiffel — Civil Engineer & Architect - Wikipedia",
          displayUrl: "https://en.wikipedia.org › wiki › Gustave_Eiffel",
          siteName: "Wikipedia",
          snippet:
            "French civil engineer Alexandre Gustave Eiffel led the Compagnie des Établissements Eiffel in erecting the 300-metre iron tower in 26 months.",
          wikiTitle: "Gustave Eiffel",
        },
      ],
    };
  }

  if (intent.matchedExhibit === "mars") {
    return {
      knowledge: null,
      images: [],
      results: [
        {
          id: "res-mars-wiki",
          title: "Mars - Wikipedia",
          displayUrl: "https://en.wikipedia.org › wiki › Mars",
          siteName: "Wikipedia",
          snippet:
            "Mars is the fourth planet from the Sun. Known as the Red Planet due to iron oxide regolith across its surface, canyon systems, and polar ice caps.",
          wikiTitle: "Mars",
          sitelinks: [{ label: "Open 3D Mars Outpost", viewModel: "mars" }],
        },
        {
          id: "res-mars-outpost",
          title: "Mars Outpost — Interactive 3D Martian Sunset Exploration",
          displayUrl: "https://googol.local › exhibits › mars-outpost",
          siteName: "googol 3D World",
          snippet:
            "Roam a sunlit Martian canyon outpost with a pressurized habitat dome, hydroponic biodome, solar telemetry array, and two 6-wheeled rovers.",
          viewModel: "mars",
        },
      ],
    };
  }

  if (intent.matchedExhibit === "plant-cell") {
    return {
      knowledge: null,
      images: [],
      results: [
        {
          id: "res-plant-cell-wiki",
          title: "Plant cell - Wikipedia",
          displayUrl: "https://en.wikipedia.org › wiki › Plant_cell",
          siteName: "Wikipedia",
          snippet:
            "Plant cells are the cells present in green plants, photosynthetic eukaryotes of the kingdom Plantae. Their distinctive features include primary cell walls containing cellulose, plastids such as chloroplasts for photosynthesis, and a large central vacuole that regulates turgor pressure.",
          wikiTitle: "Plant cell",
          sitelinks: [
            { label: "Structure", wikiTitle: "Plant cell#Structure" },
            { label: "Types of plant cells and tissues", wikiTitle: "Plant cell#Types_of_plant_cells_and_tissues" },
            { label: "Open 3D Plant cell", viewModel: "plant-cell" },
          ],
        },
      ],
    };
  }

  if (intent.matchedExhibit === "neuron") {
    return {
      knowledge: null,
      images: [],
      results: [
        {
          id: "res-neuron-wiki",
          title: "Neuron - Wikipedia",
          displayUrl: "https://en.wikipedia.org › wiki › Neuron",
          siteName: "Wikipedia",
          snippet:
            "A neuron, neurone, or nerve cell is an excitable cell that fires electric signals called action potentials across a neural network in the nervous system.",
          wikiTitle: "Neuron",
          sitelinks: [
            { label: "Anatomy and histology", wikiTitle: "Neuron#Anatomy_and_histology" },
            { label: "Open 3D Neuron", viewModel: "neuron" },
          ],
        },
      ],
    };
  }

  if (intent.matchedExhibit === "jensen-video") {
    return {
      knowledge: null,
      images: [],
      results: [
        {
          id: "res-jensen-briefing",
          title: "Jensen Huang: Relationships and Recent News — googol Briefing",
          displayUrl: "https://googol.local › news › jensen-huang",
          siteName: "googol News Briefing",
          snippet:
            "Interactive relationship timeline and synchronized keynote video briefing covering NVIDIA's data-center partnerships and announcements.",
          newsEntry: true,
        },
        {
          id: "res-jensen-wiki",
          title: "Jensen Huang - Wikipedia",
          displayUrl: "https://en.wikipedia.org › wiki › Jensen_Huang",
          siteName: "Wikipedia",
          snippet:
            "Jen-Hsun 'Jensen' Huang is an American businessman and electrical engineer who co-founded NVIDIA in 1993 and serves as its president and CEO.",
          wikiTitle: "Jensen Huang",
        },
      ],
    };
  }

  return { knowledge: null, images: [], results: [] };
}
