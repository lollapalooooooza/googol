import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { clipBounds, type VideoClip } from "@/lib/jensen-clips";

/** One video element, an ordered edit list, and clip-local controls. */
export function useClipPlayback(ref: RefObject<HTMLVideoElement | null>, clips: readonly VideoClip[], playWhenReady: boolean) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const autoTried = useRef(false);
  const currentIndex = useRef(0);
  const queue = useRef(clips); queue.current = clips;
  const atEnd = useRef(false);
  const changing = useRef(false);
  const key = clips.map((clip) => `${clip.id}:${clip.start}:${clip.end}`).join("|");

  const startClip = useCallback((next: number, play = true) => {
    const v = ref.current, clip = queue.current[next];
    if (!v || !clip) return;
    const b = clipBounds(clip, v.duration);
    if (!Number.isFinite(b.end) || b.end <= b.start) { setStatus("error"); return; }
    changing.current = true;
    currentIndex.current = next;
    atEnd.current = false;
    setIndex(next); setFinished(false);
    v.pause();
    v.currentTime = b.start;
    setTime(b.start);
    // A no-op seek need not dispatch seeked.
    changing.current = v.seeking;
    if (play) void v.play().catch(() => setPlaying(false));
  }, [ref]);

  useEffect(() => {
    currentIndex.current = 0; autoTried.current = false; atEnd.current = false;
    setIndex(0); setFinished(false);
    const v = ref.current;
    if (v?.readyState && clips.length) startClip(0, false);
  }, [key, ref, startClip]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !clips.length || !playWhenReady || status !== "ready" || autoTried.current) return;
    autoTried.current = true;
    void v.play().catch(() => setPlaying(false));
  }, [key, playWhenReady, status, ref]);

  const boundary = useCallback(() => {
    const v = ref.current;
    if (!v || v.paused || v.seeking || changing.current || atEnd.current) return;
    const clip = queue.current[currentIndex.current];
    if (!clip) return;
    const b = clipBounds(clip, v.duration);
    if (v.currentTime < b.end - 1 / 30) return;
    const next = currentIndex.current + 1;
    if (next < queue.current.length) startClip(next, true);
    else {
      atEnd.current = true;
      v.pause();
      v.currentTime = Math.max(b.start, b.end - .04);
      setTime(b.end); setFinished(true);
    }
  }, [ref, startClip]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !playing) return;
    let handle = 0, cancelled = false;
    // Frame-level boundaries prevent a full-scene spillover between timeupdate events.
    const frame = () => {
      if (cancelled) return;
      boundary();
      handle = v.requestVideoFrameCallback(frame);
    };
    if (typeof v.requestVideoFrameCallback === "function") handle = v.requestVideoFrameCallback(frame);
    return () => { cancelled = true; if (handle) v.cancelVideoFrameCallback(handle); };
  }, [playing, boundary, key, ref]);

  useEffect(() => {
    const v = ref.current;
    return () => { v?.pause(); };
  }, [ref]);

  const choose = (next: number) => {
    autoTried.current = true;
    startClip(Math.max(0, Math.min(clips.length - 1, next)), true);
  };
  const toggle = () => {
    const v = ref.current; if (!v) return;
    autoTried.current = true;
    if (!v.paused) { v.pause(); return; }
    const b = clipBounds(clips[currentIndex.current], duration);
    if (atEnd.current) startClip(0, true);
    else if (v.currentTime >= b.end - .04) startClip(currentIndex.current, true);
    else void v.play().catch(() => setPlaying(false));
  };
  const bounds = clipBounds(clips[index], duration);
  const elapsed = Math.max(0, Math.min(bounds.length, time - bounds.start));
  const seek = (relative: number) => {
    const v = ref.current;
    if (!v || !Number.isFinite(relative)) return;
    atEnd.current = false; setFinished(false);
    v.currentTime = bounds.start + Math.max(0, Math.min(bounds.length - .04, relative));
    setTime(v.currentTime);
  };
  const retry = () => {
    autoTried.current = false; atEnd.current = false; setFinished(false);
    setStatus("loading"); ref.current?.load();
  };
  return {
    index, playing, muted, setMuted, elapsed, length: bounds.length, finished, status, duration,
    choose, toggle, seek, retry,
    onLoadedMetadata: () => {
      const v = ref.current; if (!v) return;
      setDuration(v.duration);
      startClip(currentIndex.current, false);
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onCanPlay: () => setStatus("ready"),
    onWaiting: () => setStatus("loading"),
    onPlaying: () => setStatus("ready"),
    onError: () => setStatus("error"),
    onSeeked: () => { changing.current = false; if (ref.current) setTime(ref.current.currentTime); boundary(); },
    onTimeUpdate: () => { if (ref.current && !atEnd.current) setTime(ref.current.currentTime); boundary(); },
    onEnded: () => { setPlaying(false); atEnd.current = true; setFinished(true); },
  };
}
