import { HERO_FINALE_PRESETS, WALKTHROUGH_STOPS } from "./eiffel-engine/story/walkthrough_data.js";
import { thumbUrl } from "@/lib/chrome-search";

export type EiffelLang = "en" | "fr";

export interface EiffelPreset {
  id: string;
  numeral: string;
  label: string;
  labelFr: string;
  shortLabel: string;
  caption: string;
  captionFr: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  turntable: boolean;
}

export interface EiffelMilestone {
  stopIndex: number;
  step: number;
  dateLabel: string;
  dateLabelFr: string;
  shortLabel: string;
  shortLabelFr: string;
  title: string;
  titleFr: string;
  elevationSummary: string;
  elevationSummaryFr: string;
  narrative: string;
  narrativeFr: string;
  photoSrc: string | null;
}

export type EiffelMood = "day" | "dusk" | "night";

export const EIFFEL_PRESETS: EiffelPreset[] = HERO_FINALE_PRESETS.map((p) => ({
  id: p.presetId,
  numeral: p.numeral,
  label: p.label.en,
  labelFr: p.label.fr,
  shortLabel:
    p.presetId === "overview"
      ? "300m Full"
      : p.presetId === "plinths_shoes"
        ? "Stone Plinths"
        : p.presetId === "arch_frieze"
          ? "74m Arch"
          : p.presetId === "second_platform"
            ? "116m Deck"
            : "300m Phare",
  caption: p.caption.en,
  captionFr: p.caption.fr,
  position: [...p.position] as [number, number, number],
  target: [...p.target] as [number, number, number],
  fov: p.fovYDeg,
  turntable: p.enableTurntable,
}));

export const EIFFEL_MILESTONES: EiffelMilestone[] = WALKTHROUGH_STOPS.map((s) => ({
  stopIndex: s.stopIndex,
  step: s.calibratedStep,
  dateLabel: s.dateLabel.en,
  dateLabelFr: s.dateLabel.fr,
  shortLabel: s.shortLabel.en,
  shortLabelFr: s.shortLabel.fr,
  title: s.headline.en,
  titleFr: s.headline.fr,
  elevationSummary: s.elevationSummary.en,
  elevationSummaryFr: s.elevationSummary.fr,
  narrative: s.narrative.en,
  narrativeFr: s.narrative.fr,
  photoSrc: s.primaryPhotoId ? thumbUrl(`${s.primaryPhotoId}_320.jpg`) : null,
}));

export const EIFFEL_MOODS: Array<{ id: EiffelMood; label: string }> = [
  { id: "day", label: "1889 Daylight" },
  { id: "dusk", label: "Golden Dusk" },
  { id: "night", label: "Gaslight & Phare" },
];

export const EIFFEL_FACTS: string[] = [
  "Total height at inauguration (1889): 312.27 m to flagpole tip; 300 m iron lantern",
  "18,038 puddle-iron pieces joined by 2.5 million hot-driven rivets across 5 zones",
  "Base footprint spans 125 m × 125 m; four 54.6° inclined piers rest on Château-Landon stone plinths",
  "Timeline spans 26 months (April 1887 pneumatic caissons to May 1889 Exposition Universelle)",
];

export const EIFFEL_SOURCE_URL = "https://github.com/lollapalooooooza/Eiffel-Tower";

export function nearestMilestoneForStep(step: number, isPlate1884 = false): EiffelMilestone {
  if (isPlate1884) return EIFFEL_MILESTONES[0];
  // Stops 2..12 cover 1887-04 (0.55) through 1889 Complete 3D (11.0).
  const constructionStops = EIFFEL_MILESTONES.slice(1);
  let best = constructionStops[constructionStops.length - 1];
  let bestDist = Infinity;
  for (const m of constructionStops) {
    const d = Math.abs(m.step - step);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}
