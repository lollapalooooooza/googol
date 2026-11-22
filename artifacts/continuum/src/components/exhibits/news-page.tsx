import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Sparkles } from "lucide-react";
import type { VideoTopic } from "@/lib/jensen-clips";
import "./news-page.css";

export interface NewsStreamSession {
  runId: number;
  prompt: string;
  model: "gemini-4-argon" | "gemini-4-hydrogen";
  modelLabel: string;
}

const SRC = {
  nvidia: {
    shortPub: "NVIDIA",
    label: "NVIDIA, company statement, 8 Nov 2026",
    url: "https://nvidianews.nvidia.com/news/a-message-to-our-company",
  },
  bbc: {
    shortPub: "BBC",
    label: "BBC News, updated 12 Nov 2026",
    url: "https://www.bbc.co.uk/news/articles/ckgel338xql3o",
  },
  reuters: {
    shortPub: "Reuters",
    label: "Reuters, 12 Nov 2026",
    url: "https://www.reuters.com/technology/former-nvidia-ceo-huang-had-relationship-with-second-employee-sources-say-2026-11-12/",
  },
  latest: {
    shortPub: "Reuters",
    label: "Reuters, latest reporting, 13–14 Nov 2026",
    url: "https://www.reuters.com/world/china/ex-nvidia-ceo-misled-top-lawyer-affair-with-chinese-businesswoman-sources-say-2026-11-14/",
  },
} as const;

type Key = keyof typeof SRC;
const SRC_KEYS: Key[] = ["nvidia", "bbc", "reuters", "latest"];
const HEADER_SOURCES: Array<{ key: Key; label: string }> = [
  { key: "nvidia", label: "NVIDIA" },
  { key: "bbc", label: "BBC" },
  { key: "latest", label: "Reuters" },
];

const GROUNDING_MS = 220;
const TOTAL_STREAM_MS = 3800;
const DIGIT_REEL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;

function smoothRoll(frac: number, threshold = 0.62): number {
  if (frac <= threshold) return 0;
  const u = Math.max(0, Math.min(1, (frac - threshold) / (1 - threshold)));
  return u * u * (3 - 2 * u);
}

function DigitReel({ position }: { position: number }) {
  return (
    <span className="np-digit-window" aria-hidden>
      <span
        className="np-digit-track"
        style={{ transform: `translate3d(0, ${-position * 1.25}em, 0)` }}
      >
        {DIGIT_REEL.map((d, idx) => (
          <span key={idx} className="np-digit-cell">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

function SmoothElapsedTimer({ elapsedMs }: { elapsedMs: number }) {
  const clampedMs = Math.min(TOTAL_STREAM_MS, Math.max(0, elapsedMs));
  const totalTenths = clampedMs / 100;
  const tenthIndex = Math.floor(totalTenths);
  const tenthFrac = totalTenths - tenthIndex;
  const tenthRoll = smoothRoll(tenthFrac, 0.55);

  const tenthsDigit = tenthIndex % 10;
  const tenthsPos = tenthsDigit + tenthRoll;

  const wholeSec = Math.floor(tenthIndex / 10);
  const onesDigit = wholeSec % 10;
  // Whole-second reel rolls smoothly in lockstep with 9 -> 0 on the tenths reel
  const onesPos = onesDigit + (tenthsDigit === 9 ? tenthRoll : 0);

  const srLabel = `${(Math.max(100, clampedMs) / 1000).toFixed(1)}s`;

  return (
    <span className="np-timer" aria-label={srLabel} data-testid="text-news-stream-timer">
      <DigitReel position={onesPos} />
      <span className="np-timer-dot">.</span>
      <DigitReel position={tenthsPos} />
      <span className="np-timer-unit">s</span>
    </span>
  );
}

function useStreamElapsed(streamSession?: NewsStreamSession) {
  const [elapsedMs, setElapsedMs] = useState<number>(() => (streamSession ? 0 : TOTAL_STREAM_MS));

  useEffect(() => {
    if (!streamSession) {
      setElapsedMs(TOTAL_STREAM_MS);
      return;
    }
    setElapsedMs(0);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const next = Math.min(TOTAL_STREAM_MS, now - start);
      setElapsedMs(next);
      if (next < TOTAL_STREAM_MS) {
        raf = window.requestAnimationFrame(step);
      }
    };
    raf = window.requestAnimationFrame(step);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [streamSession?.runId]);

  return elapsedMs;
}

/** Minimal header capsule strip placed in the top bar of the Jensen article window. */
export function NewsHeaderCapsules({ streamSession }: { streamSession?: NewsStreamSession }) {
  const elapsedMs = useStreamElapsed(streamSession);
  const isStreaming = Boolean(streamSession) && elapsedMs < TOTAL_STREAM_MS;
  const progress = Math.max(0, Math.min(1, elapsedMs / TOTAL_STREAM_MS));
  const modelId = streamSession?.model ?? "gemini-4-argon";
  const modelLabel = streamSession?.modelLabel ?? "Gemini 4 Argon";

  return (
    <div className="np-header-capsules" data-testid="bar-gemini-attribution">
      <motion.span
        layout
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        data-testid="capsule-gemini-model"
        data-streaming={isStreaming ? "true" : "false"}
        className={`np-model-pill ${modelId === "gemini-4-hydrogen" ? "is-hydrogen" : "is-argon"} ${isStreaming ? "is-streaming" : ""}`}
      >
        {isStreaming && (
          <span
            className="np-model-progress"
            aria-hidden
            style={{ transform: `scaleX(${progress.toFixed(4)})` }}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          {isStreaming ? (
            <motion.span
              key="streaming"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="np-model-pill-inner"
            >
              <span className="np-live-dot" aria-hidden />
              <span>{modelLabel}</span>
              <span className="np-pill-mid-dot" aria-hidden>·</span>
              <SmoothElapsedTimer elapsedMs={elapsedMs} />
            </motion.span>
          ) : (
            <motion.span
              key="written"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="np-model-pill-inner"
            >
              <Sparkles className="size-3 shrink-0 opacity-80" aria-hidden />
              <span>Written by {modelLabel}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>

      <span className="np-header-sep" aria-hidden />

      <div className="flex items-center gap-1.5" data-testid="list-reference-capsules">
        {HEADER_SOURCES.map(({ key, label }, idx) => {
          const visible = !isStreaming || elapsedMs >= idx * 75;
          return (
            <a
              key={key}
              href={SRC[key].url}
              target="_blank"
              rel="noreferrer"
              title={SRC[key].label}
              data-testid={`capsule-ref-${key}`}
              style={{ opacity: visible ? 1 : 0.25 }}
              className="np-source-pill"
            >
              <span>{label}</span>
              <ExternalLink className="size-2.5 opacity-65" aria-hidden />
            </a>
          );
        })}
      </div>
    </div>
  );
}

interface TimelineRowSpec {
  date: string;
  title: string;
  topic: VideoTopic;
  extraTopic?: VideoTopic;
  body: string;
  cites: Key[];
}

const HEADLINE_TEXT = "Jensen Huang’s Marriage and the Reporting That Led to His Departure";
const DEK_TEXT =
  "From meeting Lori at university to a public apology and a board investigation: a timeline of the personal and professional story.";
const LEDE_TEXT =
  "Jensen Huang’s acknowledgement of marital infidelity has been followed by his departure as NVIDIA’s chief executive and questions about relationships reported by news organisations. His own statement confirms the admission; other details remain attributed reporting, not the conclusions of an investigation.";

const CONFIRMED_PARAS: Array<{ topic: VideoTopic; text: string; cites: Key[] }> = [
  {
    topic: "apology",
    text: "In a company statement, Huang said he had been unfaithful to his wife, apologised to his family, and said he supports an independent investigation commissioned by the board.",
    cites: ["nvidia"],
  },
  {
    topic: "leadership",
    text: "The BBC reports that he has resigned and that Colette Kress has been named interim chief executive.",
    cites: ["bbc"],
  },
];

const TIMELINE_ROWS: TimelineRowSpec[] = [
  {
    topic: "meeting",
    date: "Early 1980s",
    title: "A meeting at Oregon State",
    body: "Huang met Lori Mills while they were studying electrical engineering. They were lab partners, according to the BBC.",
    cites: ["bbc"],
  },
  {
    topic: "marriage",
    date: "1985",
    title: "Marriage and family",
    body: "The couple married in 1985 and have two children. This is the family background to Huang’s recent public apology.",
    cites: ["bbc"],
  },
  {
    topic: "philanthropy",
    date: "2007",
    title: "A shared philanthropic foundation",
    body: "They established the Jen-Hsun and Lori Huang Foundation, which has supported engineering education at Oregon State and Stanford.",
    cites: ["bbc"],
  },
  {
    topic: "apology",
    date: "8 Nov. 2026",
    title: "A public admission",
    body: "In NVIDIA’s published statement, Huang acknowledged being unfaithful, apologised to his wife and children, and said he supported an independent board investigation.",
    cites: ["nvidia"],
  },
  {
    topic: "investigation",
    date: "10 Nov. 2026",
    title: "An independent review",
    body: "Independent directors hired Wachtell, Lipton, Rosen & Katz to investigate, Reuters reports. The review followed reporting about his relationship with businesswoman Alice Huang.",
    cites: ["latest"],
  },
  {
    topic: "leadership",
    extraTopic: "employees",
    date: "12 Nov. 2026",
    title: "A leadership change and further reporting",
    body: "The BBC reported Huang’s resignation and Colette Kress’s appointment as interim chief executive. Separately, Reuters reported another employee relationship, citing two sources.",
    cites: ["bbc", "reuters"],
  },
  {
    topic: "allegations",
    date: "13–14 Nov. 2026",
    title: "Questions about earlier explanations",
    body: "Reuters reported that Huang had described his interactions with Alice Huang to company leaders as ordinary customer dealings. Its report cited two people and October correspondence it reviewed. Representatives for Huang and NVIDIA declined comment; Alice Huang did not respond.",
    cites: ["latest"],
  },
];

const ALLEGED_PARAS: Array<{ topic: VideoTopic; text: string; cites: Key[] }> = [
  {
    topic: "allegations",
    text: "Reports of specific affairs are attributed to news reporting and are not established findings; the board investigation has not concluded.",
    cites: ["bbc"],
  },
  {
    topic: "employees",
    text: "Reuters reports a relationship with a second employee, citing two anonymous sources. NVIDIA declined to comment and other parties did not respond.",
    cites: ["reuters"],
  },
  {
    topic: "allegations",
    text: "Reported espionage allegations have been denied by China. An unresolved investigation is not a finding of wrongdoing or a conviction.",
    cites: ["bbc"],
  },
  {
    topic: "allegations",
    text: "The start of Huang’s reported intimate relationship with Alice Huang remains unclear. Reuters says it verified photographs of them together as early as December 2023; those images do not establish when an affair began. The two share a surname but are not related.",
    cites: ["latest"],
  },
];

const FAMILY_MAIN_TEXT =
  "Huang’s apology refers to the harm to his wife and children. It should not be read as an announcement about the future of their marriage; this article makes no claim about a separation or divorce.";

const NOTE_TEXT =
  "Drag over a timeline entry to watch its related scenes, or span several entries to queue their clips. Select other article text to play the full video from the beginning. Entries without a matching scene also play the full video. The user-supplied video is illustrative, not evidence: several caption ages and dates conflict with the sourced timeline above.";

function buildOffsets() {
  let cursor = 0;
  const take = (len: number) => {
    const start = cursor;
    cursor += len;
    return { start, end: cursor };
  };
  const headline = take(HEADLINE_TEXT.length);
  const dek = take(DEK_TEXT.length);
  const lede = take(LEDE_TEXT.length);
  const confirmed = CONFIRMED_PARAS.map((p) => take(p.text.length));
  const timeline = TIMELINE_ROWS.map((r) => ({
    title: take(r.title.length),
    body: take(r.body.length),
  }));
  const alleged = ALLEGED_PARAS.map((p) => take(p.text.length));
  const family = take(FAMILY_MAIN_TEXT.length);
  const note = take(NOTE_TEXT.length);
  return {
    headline,
    dek,
    lede,
    confirmed,
    timeline,
    alleged,
    family,
    note,
    totalChars: cursor,
  };
}

const OFFSETS = buildOffsets();

function sliceAt(text: string, range: { start: number; end: number }, revealed: number, activeStream: boolean) {
  if (!activeStream || revealed >= range.end) {
    return { shown: true, text, typing: false, done: true };
  }
  if (revealed <= range.start) {
    return { shown: false, text: "", typing: false, done: false };
  }
  return {
    shown: true,
    text: text.slice(0, revealed - range.start),
    typing: true,
    done: false,
  };
}

function Cite({ k }: { k: Key }) {
  return (
    <a
      href={SRC[k].url}
      target="_blank"
      rel="noreferrer"
      className="np-cite"
      data-testid={`link-cite-${k}`}
      title={SRC[k].label}
    >
      <span>{SRC[k].shortPub}</span>
      <ExternalLink className="size-2.5 opacity-75" aria-hidden />
    </a>
  );
}

function Cursor() {
  return <span className="np-stream-cursor" aria-hidden />;
}

export function NewsPage({
  onNavigate,
  streamSession,
}: {
  onNavigate: (title: string) => void;
  streamSession?: NewsStreamSession;
}) {
  const elapsedMs = useStreamElapsed(streamSession);
  const isStreaming = Boolean(streamSession) && elapsedMs < TOTAL_STREAM_MS;
  const streamRatio = streamSession
    ? Math.max(0, Math.min(1, (elapsedMs - GROUNDING_MS) / (TOTAL_STREAM_MS - GROUNDING_MS)))
    : 1;
  const easedRatio = 1 - Math.pow(1 - streamRatio, 1.18);
  const revealed = isStreaming ? Math.floor(easedRatio * OFFSETS.totalChars) : OFFSETS.totalChars;

  const h1Slice = sliceAt(HEADLINE_TEXT, OFFSETS.headline, revealed, isStreaming);
  const dekSlice = sliceAt(DEK_TEXT, OFFSETS.dek, revealed, isStreaming);
  const ledeSlice = sliceAt(LEDE_TEXT, OFFSETS.lede, revealed, isStreaming);
  const familySlice = sliceAt(FAMILY_MAIN_TEXT, OFFSETS.family, revealed, isStreaming);
  const noteSlice = sliceAt(NOTE_TEXT, OFFSETS.note, revealed, isStreaming);

  const showConfirmed = !isStreaming || revealed > OFFSETS.confirmed[0].start;
  const showTimeline = !isStreaming || revealed > OFFSETS.timeline[0].title.start;
  const showAlleged = !isStreaming || revealed > OFFSETS.alleged[0].start;
  const showFamily = !isStreaming || revealed > OFFSETS.family.start;
  const showFooter = !isStreaming || revealed >= OFFSETS.totalChars;

  return (
    <div
      className="news-page h-full w-full overflow-y-auto"
      data-testid="news-page"
      data-streaming={isStreaming ? "true" : "false"}
    >
      <article className="np-article">
        <p className="np-kicker" data-testid="text-briefing-label">
          Technology <span aria-hidden>/</span> News &amp; context
        </p>

        {h1Slice.shown && (
          <h1 className="np-h1" data-video-topic="overview" data-testid="text-briefing-title">
            {h1Slice.text}
            {h1Slice.typing && <Cursor />}
          </h1>
        )}

        {dekSlice.shown && (
          <p className="np-dek" data-video-topic="overview">
            {dekSlice.text}
            {dekSlice.typing && <Cursor />}
          </p>
        )}

        {dekSlice.done && (
          <div className="np-byline">
            <span>
              Compiled from <strong>NVIDIA, BBC and Reuters</strong>
            </span>
            <span className="np-dot" aria-hidden />
            <time dateTime="2026-11-14">Updated 14 Nov 2026</time>
          </div>
        )}

        {ledeSlice.shown && (
          <p className="np-lede" data-video-topic="overview">
            {ledeSlice.text}
            {ledeSlice.done && (
              <>
                <Cite k="nvidia" />
                <Cite k="bbc" />
              </>
            )}
            {ledeSlice.typing && <Cursor />}
          </p>
        )}

        {showConfirmed && (
          <section className="np-section" data-testid="section-confirmed">
            <h2 className="np-h2" data-video-topic="apology leadership">
              What is confirmed
            </h2>
            {CONFIRMED_PARAS.map((p, idx) => {
              const s = sliceAt(p.text, OFFSETS.confirmed[idx], revealed, isStreaming);
              if (!s.shown) return null;
              return (
                <p key={idx} data-video-topic={p.topic}>
                  {s.text}
                  {s.done && p.cites.map((ck) => <Cite key={ck} k={ck} />)}
                  {s.typing && <Cursor />}
                </p>
              );
            })}
          </section>
        )}

        {showTimeline && (
          <section className="np-section" data-testid="section-timeline">
            <h2 className="np-h2" data-video-topic="overview">
              The relationship timeline
            </h2>
            <ol className="np-timeline" data-testid="relationship-timeline">
              {TIMELINE_ROWS.map((row, idx) => {
                const tSlice = sliceAt(row.title, OFFSETS.timeline[idx].title, revealed, isStreaming);
                const bSlice = sliceAt(row.body, OFFSETS.timeline[idx].body, revealed, isStreaming);
                if (!tSlice.shown) return null;
                return (
                  <li
                    key={row.topic}
                    className="np-timeline-item"
                    data-video-topic={[row.topic, row.extraTopic].filter(Boolean).join(" ")}
                    data-testid={`timeline-${row.topic}`}
                  >
                    <span className="np-timeline-date">{row.date}</span>
                    <div>
                      <h3>
                        {tSlice.text}
                        {tSlice.typing && <Cursor />}
                      </h3>
                      {bSlice.shown && (
                        <p>
                          {bSlice.text}
                          {bSlice.done && row.cites.map((ck) => <Cite key={ck} k={ck} />)}
                          {bSlice.typing && <Cursor />}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {showAlleged && (
          <section className="np-section" data-testid="section-alleged">
            <h2 className="np-h2" data-video-topic="allegations">
              What remains alleged
            </h2>
            {ALLEGED_PARAS.map((p, idx) => {
              const s = sliceAt(p.text, OFFSETS.alleged[idx], revealed, isStreaming);
              if (!s.shown) return null;
              return (
                <p key={idx} data-video-topic={p.topic}>
                  {s.text}
                  {s.done && p.cites.map((ck) => <Cite key={ck} k={ck} />)}
                  {s.typing && <Cursor />}
                </p>
              );
            })}
          </section>
        )}

        {showFamily && (
          <section className="np-section" data-testid="section-family">
            <h2 className="np-h2" data-video-topic="family">
              Family background
            </h2>
            {familySlice.shown && (
              <p data-video-topic="family">
                {familySlice.text}
                {familySlice.done && <Cite k="nvidia" />}
                {familySlice.typing && <Cursor />}
              </p>
            )}
            {familySlice.done && (
              <p>
                For his career and broader biography, see the{" "}
                <button
                  onClick={() => onNavigate("Jensen Huang")}
                  className="np-link"
                  data-testid="link-wikipedia-jensen"
                >
                  Wikipedia article on Jensen Huang
                </button>
                .
              </p>
            )}
          </section>
        )}

        {noteSlice.shown && (
          <p className="np-note" data-testid="text-video-note">
            {noteSlice.text}
            {noteSlice.typing && <Cursor />}
          </p>
        )}

        {showFooter && (
          <footer className="np-sources">
            <p className="np-sources-label">Sources</p>
            <ol>
              {SRC_KEYS.map((k) => (
                <li key={k}>
                  <a href={SRC[k].url} target="_blank" rel="noreferrer" data-testid={`link-source-${k}`}>
                    {SRC[k].label}
                    <ExternalLink className="ml-1 inline size-3 align-[-1px]" aria-hidden />
                  </a>
                </li>
              ))}
            </ol>
          </footer>
        )}
      </article>
    </div>
  );
}
