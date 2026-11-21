export interface RawPreset {
  presetId: string;
  numeral: string;
  label: { en: string; fr: string };
  caption: { en: string; fr: string };
  position: [number, number, number];
  target: [number, number, number];
  fovYDeg: number;
  enableTurntable: boolean;
}

export interface RawStop {
  stopIndex: number;
  stopId: string;
  kind: string;
  primaryPhotoId: string | null;
  calibratedStep: number;
  dateLabel: { en: string; fr: string };
  shortLabel: { en: string; fr: string };
  elevationSummary: { en: string; fr: string };
  headline: { en: string; fr: string };
  narrative: { en: string; fr: string };
}

export const HERO_FINALE_PRESETS: readonly RawPreset[];
export const WALKTHROUGH_STOPS: readonly RawStop[];
