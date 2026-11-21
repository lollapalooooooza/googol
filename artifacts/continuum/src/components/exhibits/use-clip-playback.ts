import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { clipBounds, type VideoClip } from "@/lib/jensen-clips";

/** One video element, an ordered edit list, and a continuous 60fps timeline across clips. */
export function useClipPlayback(
  ref: RefObject<HTMLVideoElement | null>,
  clips: readonly VideoClip[],
  playWhenReady: boolean,
) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const autoTried = useRef(false);
  const currentIndex = useRef(0);
  const queue = useRef(clips);
  queue.current = clips;
  const atEnd = useRef(false);
  const changing = useRef(false);
  const seekRaf = useRef(0);
  const pendingVideoTime = useRef<number | null>(null);
  const key = clips.map((clip) => `${clip.id}:${clip.start}:${clip.end}`).join("|");

  const timeline = useMemo(() => {
    let offset = 0;
    const segments = clips.map((clip) => {
      const b = clipBounds(clip, duration);
      const seg = { ...b, offset };
      offset += b.length;
      return seg;
    });
    return { segments, totalLength: offset };
  }, [clips, duration]);

  const startClip = useCallback(
    (next: number, play = true) => {
      const v = ref.current;
      const clip = queue.current[next];
      if (!v || !clip) return;
      const b = clipBounds(clip, v.duration);
      if (!Number.isFinite(b.end) || b.end <= b.start) {
        setStatus("error");
        return;
      }
      changing.current = true;
      currentIndex.current = next;
      atEnd.current = false;
      setIndex(next);
      setFinished(false);
      v.pause();
      v.currentTime = b.start;
      setTime(b.start);
      // A no-op seek need not dispatch seeked.
      changing.current = v.seeking;
      if (play) void v.play().catch(() => setPlaying(false));
    },
    [ref],
  );

  useEffect(() => {
    currentIndex.current = 0;
    autoTried.current = false;
    atEnd.current = false;
    setIndex(0);
    setFinished(false);
    const v = ref.current;
    if (v?.readyState && clips.length) startClip(0, false);
  }, [key, ref, startClip]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !clips.length || !playWhenReady || status !== "ready" || autoTried.current) return;
    autoTried.current = true;
    void v.play().catch(() => setPlaying(false));
  }, [key, playWhenReady, status, ref, clips.length]);

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
      v.currentTime = Math.max(b.start, b.end - 0.04);
      setTime(b.end);
      setFinished(true);
    }
  }, [ref, startClip]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !playing) return;
    let rafHandle = 0;
    let vfcHandle = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      boundary();
      if (!atEnd.current && !changing.current && pendingVideoTime.current === null) {
        setTime(v.currentTime);
      }
      rafHandle = window.requestAnimationFrame(tick);
    };

    // Frame-level boundaries prevent a full-scene spillover between animation frames.
    const onVideoFrame = () => {
      if (cancelled) return;
      boundary();
      if (typeof v.requestVideoFrameCallback === "function") {
        vfcHandle = v.requestVideoFrameCallback(onVideoFrame);
      }
    };

    rafHandle = window.requestAnimationFrame(tick);
    if (typeof v.requestVideoFrameCallback === "function") {
      vfcHandle = v.requestVideoFrameCallback(onVideoFrame);
    }
    return () => {
      cancelled = true;
      if (rafHandle) window.cancelAnimationFrame(rafHandle);
      if (vfcHandle && typeof v.cancelVideoFrameCallback === "function") {
        v.cancelVideoFrameCallback(vfcHandle);
      }
    };
  }, [playing, boundary, key, ref]);

  useEffect(() => {
    const v = ref.current;
    return () => {
      if (seekRaf.current) window.cancelAnimationFrame(seekRaf.current);
      v?.pause();
    };
  }, [ref]);

  const choose = (next: number) => {
    autoTried.current = true;
    startClip(Math.max(0, Math.min(clips.length - 1, next)), true);
  };

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    autoTried.current = true;
    if (!v.paused) {
      v.pause();
      return;
    }
    const b = clipBounds(clips[currentIndex.current], duration);
    if (atEnd.current) startClip(0, true);
    else if (v.currentTime >= b.end - 0.04) startClip(currentIndex.current, true);
    else void v.play().catch(() => setPlaying(false));
  };

  const activeSeg = timeline.segments[index] ?? { start: 0, end: 0, length: 0, offset: 0 };
  const localElapsed = Math.max(0, Math.min(activeSeg.length, time - activeSeg.start));
  const elapsed = finished
    ? timeline.totalLength
    : Math.max(0, Math.min(timeline.totalLength, activeSeg.offset + localElapsed));

  const seek = useCallback(
    (relative: number) => {
      const v = ref.current;
      if (!v || !Number.isFinite(relative) || !timeline.segments.length) return;
      const maxSeek = Math.max(0, timeline.totalLength - 0.04);
      const clamped = Math.max(0, Math.min(maxSeek, relative));

      let targetIdx = timeline.segments.length - 1;
      for (let i = 0; i < timeline.segments.length; i++) {
        const seg = timeline.segments[i];
        if (clamped < seg.offset + seg.length || i === timeline.segments.length - 1) {
          targetIdx = i;
          break;
        }
      }

      const seg = timeline.segments[targetIdx];
      const localTarget = Math.max(0, Math.min(Math.max(0, seg.length - 0.04), clamped - seg.offset));
      const targetVideoTime = seg.start + localTarget;

      atEnd.current = false;
      setFinished(false);
      if (currentIndex.current !== targetIdx) {
        currentIndex.current = targetIdx;
        setIndex(targetIdx);
      }
      setTime(targetVideoTime);
      pendingVideoTime.current = targetVideoTime;

      if (!seekRaf.current) {
        seekRaf.current = window.requestAnimationFrame(() => {
          seekRaf.current = 0;
          const latest = pendingVideoTime.current;
          pendingVideoTime.current = null;
          if (latest !== null && ref.current) {
            changing.current = true;
            ref.current.currentTime = latest;
            changing.current = ref.current.seeking;
          }
        });
      }
    },
    [ref, timeline],
  );

  const retry = () => {
    autoTried.current = false;
    atEnd.current = false;
    setFinished(false);
    setStatus("loading");
    ref.current?.load();
  };

  return {
    index,
    playing,
    muted,
    setMuted,
    elapsed,
    length: timeline.totalLength,
    finished,
    status,
    duration,
    choose,
    toggle,
    seek,
    retry,
    onLoadedMetadata: () => {
      const v = ref.current;
      if (!v) return;
      setDuration(v.duration);
      startClip(currentIndex.current, false);
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onCanPlay: () => setStatus("ready"),
    onWaiting: () => setStatus("loading"),
    onPlaying: () => setStatus("ready"),
    onError: () => setStatus("error"),
    onSeeked: () => {
      changing.current = false;
      if (ref.current && pendingVideoTime.current === null) setTime(ref.current.currentTime);
      boundary();
    },
    onTimeUpdate: () => {
      if (ref.current && !atEnd.current && pendingVideoTime.current === null) {
        setTime(ref.current.currentTime);
      }
      boundary();
    },
    onEnded: () => {
      setPlaying(false);
      atEnd.current = true;
      setFinished(true);
    },
  };
}
