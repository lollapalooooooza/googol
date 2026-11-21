import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Pause, Play, Volume2, VolumeX, X, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { FULL_VIDEO_SELECTION, type ClipSelection } from "@/lib/jensen-clips";
import { useClipPlayback } from "./use-clip-playback";
import "./exhibits.css";

const fmt = (s: number) => `${Math.floor((s + .001) / 60)}:${String(Math.floor((s + .001) % 60)).padStart(2, "0")}`;

export function VideoViewer({ compact = false, transitioning = false, actions, onClose, src, poster, playWhenReady = true, selection = FULL_VIDEO_SELECTION }: {
  selection?: ClipSelection; playWhenReady?: boolean; compact?: boolean; transitioning?: boolean; actions?: ReactNode; onClose?: () => void; src: string; poster?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [showFullVideo, setShowFullVideo] = useState(false);
  const fullVideo = showFullVideo || selection.mode === "full";
  const clips = showFullVideo ? FULL_VIDEO_SELECTION.clips : selection.clips;
  const playback = useClipPlayback(ref, clips, playWhenReady);
  const { playing, muted, setMuted, toggle, seek, retry, status } = playback;
  const time = playback.elapsed, dur = playback.length;
  const clip = clips[playback.index];
  const stageRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(9 / 16);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    queueRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [playback.index]);

  const fw = box.w && box.h ? Math.min(box.w, box.h * aspect) : 0;
  const frameStyle: CSSProperties = fw ? { width: fw, height: fw / aspect } : { height: "100%", aspectRatio: String(aspect), maxWidth: "100%" };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, summary")) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seek(time + 5); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); seek(time - 5); }
    else if (e.key === "m") setMuted((m) => !m);
  };
  const hideExtras = compact || transitioning;
  const pct = dur ? (time / dur) * 100 : 0;

  return (
    <div className={`video-viewer relative flex h-full w-full flex-col ${compact ? "is-compact" : ""}`} data-testid="video-viewer" data-playing={playing}
      data-clip-id={clip?.id} data-clip-start={clip?.start} data-clip-end={clip?.end} data-clip-count={clips.length}
      data-playback-mode={fullVideo ? "full" : "clips"}
      tabIndex={0} onKeyDown={onKey}
      aria-label="Illustrative video timeline. Space plays or pauses, arrow keys seek, M mutes.">
      <div ref={stageRef} className="vv-stage relative grid min-h-0 flex-1 place-items-center">
        {clips.length > 0 ? <div className="vv-media relative" style={frameStyle} data-testid="video-media-frame">
          <video ref={ref} src={src} poster={poster} playsInline preload="metadata" muted={muted} data-testid="visualization-video"
            className="absolute inset-0 h-full w-full object-cover" aria-label="User-supplied illustrative timeline video"
            onClick={toggle} onPlay={playback.onPlay} onPause={playback.onPause} onEnded={playback.onEnded}
            onLoadedMetadata={(e) => { playback.onLoadedMetadata(); const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight); }}
            onCanPlay={playback.onCanPlay} onWaiting={playback.onWaiting} onPlaying={playback.onPlaying} onSeeked={playback.onSeeked}
            onError={playback.onError} onTimeUpdate={playback.onTimeUpdate} />
        </div> : <div className="vv-glass mx-6 rounded-3xl p-5 text-center text-[#423c35]" data-testid="status-no-matching-clip" role="status">
          <h2 className="font-cell text-xl">No matching scene</h2>
          <p className="mt-2 text-xs leading-relaxed">{selection.notes.join(" ") || "The selected passage does not match a scene in this video."}</p>
          <button className="mt-4 rounded-full bg-white/85 px-3 py-2 text-xs underline underline-offset-2" onClick={() => setShowFullVideo(true)} data-testid="button-video-overview">Watch the full video instead</button>
        </div>}

        {clips.length > 0 && status === "loading" && !playing && <div role="status" className="vv-pill absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 text-xs">Loading clip…</div>}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6" role="alert" data-testid="status-video-error">
            <div className="vv-glass max-w-xs rounded-2xl p-4 text-center">
              <p className="font-cell text-xl text-[#2a2420]">Video could not load</p>
              <button onClick={retry} data-testid="button-retry-video" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#2f6f6d] px-3 py-1.5 text-[12px] text-[#f6efe0]"><RefreshCw className="size-3.5" />Retry</button>
            </div>
          </div>
        )}

        <div className={`exhibit-chrome absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pointer-events-none ${hideExtras ? "is-hidden" : ""}`} inert={hideExtras || undefined}>
          <p className="vv-pill pointer-events-auto max-w-[24ch] px-2.5 py-1 text-[10.5px] leading-snug" data-testid="text-video-label">
            {fullVideo ? "Full supplied video." : "Matched by topic, not date."} Illustration only; captions unverified.
          </p>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {actions}
            {onClose && <button onClick={onClose} aria-label="Close video" title="Close" data-testid="button-close-video" className="vv-glass grid size-9 place-items-center rounded-full text-[#2a2420] hover:bg-white"><X className="size-4" /></button>}
          </div>
        </div>
      </div>

      {clips.length > 0 && <div className="vv-dock-wrap shrink-0">
        <div className="vv-clip-heading" aria-live="polite" data-testid="text-current-clip">
          {fullVideo ? "Full video · from start to finish" : `Selected clips · ${playback.index + 1}/${clips.length} · ${clip?.title}`}
        </div>
        {!fullVideo && <div className="vv-queue" aria-label="Selected video clips">
          <button className="vv-queue-arrow" aria-label="Previous clip" disabled={!playback.duration || playback.index === 0} onClick={() => playback.choose(playback.index - 1)}><ChevronLeft className="size-3.5" /></button>
          <div ref={queueRef} className="vv-clip-list" data-testid="video-clip-list">
            {clips.map((c, i) => <button key={c.id} aria-current={i === playback.index ? "true" : undefined}
              disabled={!playback.duration} onClick={() => playback.choose(i)} data-testid={`button-clip-${c.id}`}
              title={`${c.title} · ${c.start.toFixed(1)}–${c.end.toFixed(1)}s in the supplied video`}>{c.title}</button>)}
          </div>
          <button className="vv-queue-arrow" aria-label="Next clip" disabled={!playback.duration || playback.index === clips.length - 1} onClick={() => playback.choose(playback.index + 1)}><ChevronRight className="size-3.5" /></button>
        </div>}
        <div className="vv-dock vv-glass mx-auto flex items-center gap-2 rounded-full p-1.5 text-[#2a2420]" data-testid="video-control-dock">
          <button onClick={toggle} disabled={!playback.duration} aria-label={playing ? "Pause" : playback.finished ? fullVideo ? "Replay full video" : "Replay selected clips" : "Play"} data-testid="button-video-play" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#2f6f6d] text-[#f6efe0]">
            {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-[1px]" />}
          </button>
          <input type="range" className="video-range min-w-0 flex-1" min={0} max={dur || 0} step={0.01} value={time} disabled={!playback.duration} aria-label="Seek in current clip" data-testid="input-video-seek"
            aria-valuetext={`${fmt(time)} of ${fmt(dur)}`} onChange={(e) => seek(Number(e.target.value))} style={{ "--p": `${pct}%` } as CSSProperties} />
          {!compact && <span className="font-mono text-[10.5px] tabular-nums text-[#5f5650]" data-testid="text-video-time">{fmt(time)}/{fmt(dur)}</span>}
          <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} data-testid="button-video-mute" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/80">
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
        <details className="vv-clip-context">
          <summary>{selection.unmatched.length ? "Some passages have no scene" : selection.notes.length ? "Related illustration · see limitations" : "Illustration · caption dates unverified"}</summary>
          <div className="vv-glass rounded-xl p-3">
            <p>{fullVideo ? "Playing the complete supplied video, not a clip matched to this passage. " : "Clips are selected by subject. "}Several ages and dates in the supplied video conflict with the sourced article; its scenes are not documentary evidence.</p>
            {selection.notes.map((note) => <p key={note} className="mt-2">{note}</p>)}
          </div>
        </details>
      </div>}
    </div>
  );
}
