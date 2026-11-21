import { MODEL_INFO, resolveArticleModel, type ModelId } from "./model-catalog";

export const NEWS_ENTRY = "/news/jensen-huang";
export type VisualizationId = ModelId | "mars" | "eiffel" | "jensen-video";
export const VISUALIZATION_INFO = {
  ...MODEL_INFO,
  mars: { title: "Mars Outpost", filename: "mars", description: "Interactive 3D Martian sunset outpost." },
  eiffel: { title: "Eiffel Tower (1889)", filename: "eiffel", description: "Interactive 3D 1887–1889 Eiffel Tower reconstruction." },
  "jensen-video": { title: "Jensen Huang", filename: "jensen-timeline", description: "User-supplied illustrative timeline." },
};
export function resolveVisualization(canonicalTitle: string | null | undefined, localEntry?: string): VisualizationId | null {
  if (localEntry === NEWS_ENTRY) return "jensen-video";
  const norm = canonicalTitle?.trim().toLowerCase();
  if (norm === "mars") return "mars";
  if (norm === "eiffel tower") return "eiffel";
  return resolveArticleModel(canonicalTitle);
}
const mediaBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/media`;
export const EXHIBIT_MEDIA = {
  mars: `${mediaBase}/mars-surface.jpg`,
  video: `${mediaBase}/jensen-timeline.mp4`,
  poster: `${mediaBase}/jensen-poster.jpg`,
};
