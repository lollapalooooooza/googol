/** Reviewed against the uploaded 60.998s video, using timestamped frames.
 * These are illustrative scenes, not verified biographical evidence.
 * Bounds trim caption transitions; no new media files or duplicate streams.
 */
export const JENSEN_CLIPS = [
  { id: "meeting", title: "Meeting Lori", start: 21, end: 25.4 },
  { id: "dating", title: "Dating", start: 26, end: 28.8 },
  { id: "wedding", title: "Wedding", start: 29.8, end: 33.8 },
  { id: "first-child", title: "Early family life", start: 34.8, end: 39 },
  { id: "company", title: "Company background", start: 39.8, end: 43.2 },
  { id: "family", title: "Family portrait", start: 44, end: 47.3 },
  { id: "apology", title: "Apology illustration", start: 48, end: 53.5 },
  { id: "later-relationship", title: "Later relationship", start: 55, end: 57.7 },
] as const;
export type VideoClip = { id: string; title: string; start: number; end: number };
type ClipId = typeof JENSEN_CLIPS[number]["id"];
type Topic = { label: string; clips: readonly ClipId[]; note?: string };

export const VIDEO_TOPICS = {
  overview: { label: "Relationship overview", clips: ["meeting", "dating", "wedding", "first-child", "family", "apology", "later-relationship"] },
  meeting: { label: "Meeting at university", clips: ["meeting", "dating"] },
  marriage: { label: "Marriage and family", clips: ["wedding", "first-child", "family"] },
  philanthropy: { label: "Philanthropy", clips: [], note: "The video has no scene about the foundation or its donations." },
  apology: { label: "Public apology", clips: ["apology"] },
  investigation: { label: "Board investigation", clips: ["later-relationship"], note: "Related relationship illustration only; the video does not show the board investigation." },
  leadership: { label: "Leadership change", clips: ["company"], note: "Company background only; there is no resignation or interim-CEO footage." },
  employees: { label: "Employee reporting", clips: [], note: "The video has no scene about the employee allegations." },
  allegations: { label: "Later relationship reporting", clips: ["later-relationship"], note: "Illustrative context, not evidence of an affair or espionage." },
  family: { label: "Family background", clips: ["wedding", "first-child", "family"] },
} satisfies Record<string, Topic>;
export type VideoTopic = keyof typeof VIDEO_TOPICS;
export type ClipSelection = {
  mode: "clips" | "full";
  clips: VideoClip[];
  topics: VideoTopic[];
  notes: string[];
  unmatched: string[];
};

// Infinity means the actual media end, resolved from loaded metadata.
export const FULL_VIDEO_SELECTION: ClipSelection = {
  mode: "full",
  clips: [{ id: "full-video", title: "Full video", start: 0, end: Infinity }],
  topics: [], notes: [], unmatched: [],
};

export function pickJensenClips(input: readonly string[]): ClipSelection {
  let topics = [...new Set(input)].filter((id): id is VideoTopic => Object.hasOwn(VIDEO_TOPICS, id));
  // A headline touched by a larger selection must not drown out specific rows.
  if (topics.some((id) => id !== "overview")) topics = topics.filter((id) => id !== "overview");
  const selected = topics.map((id): Topic => VIDEO_TOPICS[id]);
  const ids = new Set(selected.flatMap((topic) => [...topic.clips]));
  const clips = JENSEN_CLIPS.filter((clip) => ids.has(clip.id));
  const full = !clips.length || topics.every((id) => id === "overview");
  return {
    mode: full ? "full" : "clips",
    clips: full ? FULL_VIDEO_SELECTION.clips : clips,
    topics,
    notes: [...new Set(selected.flatMap((topic) => topic.note ? [topic.note] : []))],
    unmatched: selected.filter((topic) => !topic.clips.length).map((topic) => topic.label),
  };
}

export const OVERVIEW_SELECTION = pickJensenClips(["overview"]);
export interface SelectionBox { x: number; y: number; w: number; h: number }
export function topicsInSelection(selection: SelectionBox, candidates: { topic: string; bounds: SelectionBox }[]): string[] {
  return candidates.filter(({ bounds: b }) => {
    const w = Math.min(selection.x + selection.w, b.x + b.w) - Math.max(selection.x, b.x);
    const h = Math.min(selection.y + selection.h, b.y + b.h) - Math.max(selection.y, b.y);
    return w >= Math.min(20, b.w * .2) && h >= Math.min(12, b.h * .2)
      && w * h >= Math.min(selection.w * selection.h, b.w * b.h) * .12;
  }).flatMap(({ topic }) => topic.split(/\s+/));
}

export function clipsForRegion(root: HTMLElement, selection: SelectionBox): ClipSelection {
  // Only dated timeline entries request excerpts. All other article text plays
  // the complete source, even when a paragraph discusses one of these topics.
  const candidates = [...root.querySelectorAll<HTMLElement>(".np-timeline-item[data-video-topic]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { topic: el.dataset.videoTopic!, bounds: { x: r.left, y: r.top, w: r.width, h: r.height } };
  });
  return pickJensenClips(topicsInSelection(selection, candidates));
}

export function clipBounds(clip: VideoClip | undefined, duration: number) {
  const available = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const start = Math.max(0, Math.min(clip?.start ?? 0, available));
  const end = Math.max(start, Math.min(clip?.end ?? available, available));
  return { start, end, length: end - start };
}
