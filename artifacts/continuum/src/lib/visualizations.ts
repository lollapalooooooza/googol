import { MODEL_INFO, resolveArticleModel, type ModelId } from "./model-catalog";

export const NEWS_ENTRY = "/news/jensen-huang";
export type VisualizationId = ModelId | "mars" | "jensen-video";
export const VISUALIZATION_INFO = {
  ...MODEL_INFO,
  mars: { title: "Mars", filename: "mars", description: "Explore the red planet." },
  "jensen-video": { title: "Jensen Huang", filename: "jensen-timeline", description: "User-supplied illustrative timeline." },
};
export function resolveVisualization(canonicalTitle: string | null | undefined, localEntry?: string): VisualizationId | null {
  if (localEntry === NEWS_ENTRY) return "jensen-video";
  if (canonicalTitle?.trim().toLowerCase() === "mars") return "mars";
  return resolveArticleModel(canonicalTitle);
}
const mediaBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/media`;
export const EXHIBIT_MEDIA = {
  mars: `${mediaBase}/mars-surface.jpg`,
  video: `${mediaBase}/jensen-timeline.mp4`,
  poster: `${mediaBase}/jensen-poster.jpg`,
};
