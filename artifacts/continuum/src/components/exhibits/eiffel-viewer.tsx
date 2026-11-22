import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Pause,
  Play,
  X,
} from "lucide-react";
import { StableSceneSurface } from "@/components/cell/stable-scene-surface";
import {
  EiffelWorldController,
  type WalkthroughFrameState,
  type WalkthroughVisualFrame,
} from "./eiffel-scene";
import {
  EIFFEL_MILESTONES,
  EIFFEL_PRESETS,
  type EiffelLang,
} from "./eiffel-data";
import {
  WALKTHROUGH_SCHEDULE,
  computeArchivalPlateRect,
  getArchivalPhotoUrl,
  type WalkthroughBeat,
} from "./eiffel-walkthrough";
import {
  EIFFEL_ELEVATION_PLATE_SRC,
  thumbUrl,
  type BoxRect,
} from "@/lib/chrome-search";
import "./exhibits.css";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export type EiffelExhibitionPhase = "lifting" | "active";

export function EiffelViewer({
  compact = false,
  transitioning = false,
  feathered = false,
  bottomDockReserve = 0,
  transitionSource = null,
  autoStartFrom1884 = false,
  onClose,
  actions,
}: {
  compact?: boolean;
  transitioning?: boolean;
  feathered?: boolean;
  bottomDockReserve?: number;
  transitionSource?: { sourceRect: BoxRect; imageSrc: string } | null;
  autoStartFrom1884?: boolean;
  onClose?: () => void;
  actions?: ReactNode;
}) {
  const reduced = !!useReducedMotion();
  const [webgl] = useState(hasWebGL);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const plateElRef = useRef<HTMLDivElement | null>(null);
  const placardElRef = useRef<HTMLDivElement | null>(null);
  const progressElRef = useRef<HTMLDivElement | null>(null);
  const liftAnimStartedRef = useRef(false);
  const liftAnimRef = useRef<Animation | null>(null);
  const liftFallbackTimerRef = useRef<number>(0);
  const phaseRef = useRef<EiffelExhibitionPhase>(transitionSource ? "lifting" : "active");

  const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
  const controllerRef = useRef<EiffelWorldController | null>(null);

  const startsInPlate = Boolean(transitionSource || autoStartFrom1884);
  const [phase, setPhase] = useState<EiffelExhibitionPhase>(() =>
    transitionSource ? "lifting" : "active",
  );
  phaseRef.current = phase;

  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [lang, setLang] = useState<EiffelLang>("en");
  const [cardHidden, setCardHidden] = useState(false);
  const [pureView, setPureView] = useState(false);

  const [walkthrough, setWalkthrough] = useState<WalkthroughFrameState>(() => ({
    stopIndex: startsInPlate ? 1 : 12,
    displayStopIndex: startsInPlate ? 1 : 12,
    tau: startsInPlate ? 0 : 11,
    step: 11.0,
    beat: (startsInPlate ? "hold_d" : "finale_orbit") as WalkthroughBeat,
    plateOpacity: startsInPlate ? 1 : 0,
    placardOpacity: 1,
    activePhotoId: startsInPlate ? "55" : null,
    playing: false,
    userOrbited: false,
    manualPlateHidden: false,
  }));

  // Direct 60fps DOM visual frame sync — bypasses React reconciler completely during fades & flights!
  const applyVisualFrameToDom = useCallback((frame: WalkthroughVisualFrame) => {
    const isLifting = phaseRef.current === "lifting";
    const nextPlateOpacity = isLifting ? 1 : frame.plateOpacity;
    if (plateElRef.current) {
      plateElRef.current.style.opacity = nextPlateOpacity.toFixed(4);
      plateElRef.current.style.visibility = nextPlateOpacity > 0.004 ? "visible" : "hidden";
    }
    if (placardElRef.current) {
      const po = frame.placardOpacity;
      placardElRef.current.style.opacity = po.toFixed(4);
      placardElRef.current.style.transform = `translate3d(${((1 - po) * -10).toFixed(2)}px, 0, 0)`;
      placardElRef.current.style.pointerEvents = po > 0.08 ? "auto" : "none";
    }
    if (progressElRef.current) {
      const ratio = Math.max(0, Math.min(1, frame.tau / (EIFFEL_MILESTONES.length - 1)));
      progressElRef.current.style.transform = `translateY(-50%) scaleX(${ratio.toFixed(4)})`;
    }
    if (rootRef.current) {
      rootRef.current.setAttribute("data-plate-opacity", nextPlateOpacity.toFixed(2));
      rootRef.current.setAttribute("data-step", frame.step.toFixed(2));
      rootRef.current.setAttribute("data-tau", frame.tau.toFixed(2));
    }
  }, []);

  // Measure the exact stage rect so archival glass-plate overlays match the WebGL canvas 1:1 pixel-for-pixel
  const [stageMeasured, setStageMeasured] = useState(!transitionSource);
  const [stageBox, setStageBox] = useState(() => ({
    left: 0,
    top: 0,
    width: typeof window !== "undefined" ? window.innerWidth : 1440,
    height: typeof window !== "undefined" ? Math.max(300, window.innerHeight - bottomDockReserve) : 832,
  }));

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) {
        setStageBox({ left: r.left, top: r.top, width: r.width, height: r.height });
        setStageMeasured(true);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Preload all 10 high-resolution archival glass-plate photographs so Beat C cross-dissolves have zero flash
  useEffect(() => {
    if (compact) return;
    const urls = WALKTHROUGH_SCHEDULE.map((s) => getArchivalPhotoUrl(s.photoId)).filter(
      (u): u is string => Boolean(u),
    );
    const imgs = urls.map((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      return img;
    });
    return () => {
      imgs.length = 0;
    };
  }, [compact]);

  // Mount Three.js WebGL controller concurrently (internally frame-yielded!) so 3D Paris is warm & ready
  // the exact instant the GPU compositor-thread plate glide arrives at screen center.
  useEffect(() => {
    if (!webgl || !mountEl) return;
    const ctrl = new EiffelWorldController(
      mountEl,
      {
        onReady: () => setReady(true),
        onContextLost: (lost) => setContextLost(lost),
        onWalkthroughState: (next) => setWalkthrough(next),
        onVisualFrame: applyVisualFrameToDom,
      },
      { reducedMotion: reduced, initialPlateMode: startsInPlate },
    );
    controllerRef.current = ctrl;
    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, [webgl, mountEl, reduced, startsInPlate, applyVisualFrameToDom]);

  // Calibrated archival glass-plate rect for the active photo (exact 1:1 registration with Three.js camera!)
  const activePhotoId = phase === "lifting" ? "55" : walkthrough.activePhotoId;
  const plateRect = activePhotoId
    ? computeArchivalPlateRect(activePhotoId, stageBox.width, stageBox.height)
    : null;
  const activePhotoSrc =
    activePhotoId === "55"
      ? transitionSource?.imageSrc || EIFFEL_ELEVATION_PLATE_SRC
      : getArchivalPhotoUrl(activePhotoId);

  // Pure GPU compositor-thread WAAPI FLIP glide from SERP sourceRect -> exact centered stage plateRect.
  // Runs off the main JS thread so frame-sliced WebGL warm-up (and setReady re-renders) NEVER interrupt or stutter it!
  useLayoutEffect(() => {
    if (phaseRef.current !== "lifting" || !stageMeasured || !transitionSource || !plateRect) return;
    const el = plateElRef.current;
    if (!el || liftAnimStartedRef.current) return;
    liftAnimStartedRef.current = true;

    const dx = transitionSource.sourceRect.x - stageBox.left - plateRect.x;
    const dy = transitionSource.sourceRect.y - stageBox.top - plateRect.y;
    const sx = transitionSource.sourceRect.w / Math.max(1, plateRect.w);
    const sy = transitionSource.sourceRect.h / Math.max(1, plateRect.h);

    const durationMs = reduced ? 120 : 680;
    const fromTransform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    const toTransform = "translate3d(0px, 0px, 0) scale(1, 1)";

    let finished = false;
    const finishLift = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(liftFallbackTimerRef.current);
      liftFallbackTimerRef.current = 0;
      liftAnimRef.current = null;
      if (plateElRef.current) {
        plateElRef.current.style.transform = toTransform;
      }
      setPhase("active");
    };

    if (typeof el.animate === "function") {
      const anim = el.animate(
        [{ transform: fromTransform }, { transform: toTransform }],
        {
          duration: durationMs,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        },
      );
      liftAnimRef.current = anim;
      anim.onfinish = () => {
        anim.cancel();
        finishLift();
      };
      liftFallbackTimerRef.current = window.setTimeout(() => {
        anim.cancel();
        finishLift();
      }, durationMs + 90);
      return;
    }

    liftFallbackTimerRef.current = window.setTimeout(finishLift, durationMs);
  }, [stageMeasured, transitionSource, plateRect?.x, plateRect?.y, plateRect?.w, plateRect?.h, stageBox.left, stageBox.top, reduced]);

  // Cancel any in-flight WAAPI lift animation only on actual component unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(liftFallbackTimerRef.current);
      liftAnimRef.current?.cancel();
      liftAnimRef.current = null;
    };
  }, []);

  // Once the 1884 plate lands at center AND Three.js scene is ready, flow immediately into the 4-Beat walkthrough!
  useEffect(() => {
    if (!autoStartFrom1884 || phase !== "active") return;
    if (webgl && !ready) return;
    controllerRef.current?.beginExhibitionFrom1884();
  }, [autoStartFrom1884, phase, ready, webgl]);

  // Keep DOM refs synced immediately when a new archival photo plate mounts or chrome reveals
  useLayoutEffect(() => {
    applyVisualFrameToDom({
      plateOpacity: phase === "lifting" ? 1 : walkthrough.plateOpacity,
      placardOpacity: walkthrough.placardOpacity,
      tau: walkthrough.tau,
      step: walkthrough.step,
    });
  }, [activePhotoId, phase, pureView, cardHidden, walkthrough.plateOpacity, walkthrough.placardOpacity, walkthrough.tau, walkthrough.step, applyVisualFrameToDom]);

  const handleTogglePlay = useCallback(() => {
    controllerRef.current?.togglePlay();
  }, []);

  const handleSelectStop = useCallback((stopIdx: number) => {
    controllerRef.current?.jumpToStop(stopIdx, { fastFlight: true });
  }, []);

  const handleToggleReveal3D = useCallback(() => {
    controllerRef.current?.toggleReveal3D();
  }, []);

  const handleReset = useCallback(() => {
    controllerRef.current?.resetView();
  }, []);

  const handlePreset = useCallback((presetId: string) => {
    controllerRef.current?.setPreset(presetId);
  }, []);

  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSelectStop(Math.max(1, walkthrough.stopIndex - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSelectStop(Math.min(EIFFEL_MILESTONES.length, walkthrough.stopIndex + 1));
      } else if (e.key === "r" || e.key === "R") {
        handleReset();
      } else if (e.key === "h" || e.key === "H") {
        setPureView((v) => !v);
      } else if (["1", "2", "3", "4", "5"].includes(e.key)) {
        const preset = EIFFEL_PRESETS[Number(e.key) - 1];
        if (preset) handlePreset(preset.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact, handlePreset, handleReset, handleSelectStop, handleTogglePlay, walkthrough.stopIndex]);

  const milestone =
    EIFFEL_MILESTONES.find((m) => m.stopIndex === walkthrough.displayStopIndex) ?? EIFFEL_MILESTONES[0];

  const dateText = lang === "fr" ? milestone.dateLabelFr : milestone.dateLabel;
  const headingText = lang === "fr" ? milestone.titleFr : milestone.title;
  const bodyText = lang === "fr" ? milestone.narrativeFr : milestone.narrative;
  const footerSpecText = lang === "fr" ? milestone.elevationSummaryFr : milestone.elevationSummary;

  const chromeVisible = !compact && !transitioning && phase !== "lifting";
  const showPlateNode = Boolean(stageMeasured && plateRect && activePhotoSrc);
  const showPlateLabel = walkthrough.manualPlateHidden && walkthrough.stopIndex < 12;

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full select-none overflow-hidden text-[#f3efe8]"
      data-testid="eiffel-viewer"
      data-ready={ready ? "ready" : "loading"}
      data-phase={phase}
      data-beat={walkthrough.beat}
      data-playing={walkthrough.playing ? "true" : "false"}
      data-stop={walkthrough.stopIndex}
      data-display-stop={walkthrough.displayStopIndex}
      data-photo={activePhotoId ?? "none"}
      data-plate-opacity={walkthrough.plateOpacity.toFixed(2)}
      data-step={walkthrough.step.toFixed(2)}
      data-tau={walkthrough.tau.toFixed(2)}
      data-lang={lang}
    >
      {/* Feathered 3D Stage (composited purely via GPU opacity — zero CSS backdrop-filter) */}
      <motion.div
        className={`absolute inset-0 bg-[#e9e4da] ${feathered ? "feather-soft" : ""}`}
        data-testid={feathered ? "eiffel-feathered-stage" : undefined}
        initial={transitionSource ? { opacity: 0 } : { opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0.12 : 0.62, ease: [0.22, 1, 0.36, 1] }}
      >
        {webgl && !contextLost ? (
          <StableSceneSurface>
            <div ref={setMountEl} className="h-full w-full" />
          </StableSceneSurface>
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#e9e4da] p-6 text-center text-[#1f1f1f]">
            <div className="max-w-sm rounded-xl border border-black/15 bg-white/95 p-5 shadow-lg">
              <img
                src={thumbUrl("18_completed_1889.jpg")}
                alt="Eiffel Tower 1889 archival elevation"
                className="mx-auto mb-3 h-40 w-full rounded-lg object-cover"
              />
              <h2 className="font-serif text-[16px] font-semibold">La Tour de 300 Mètres (1887–1889)</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#4d5156]">
                WebGL is unavailable in this browser context. Displaying the 1889 Exposition archival plate.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Subtle loading indicator only when opening directly into 3D without the hero plate */}
      {!ready && webgl && !contextLost && !startsInPlate && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[#e9e4da]/85">
          <div className="rounded-[2px] border border-black/15 bg-[#1a1b1d] px-4 py-2.5 text-[12.5px] tracking-wide text-[#e8e2d6] shadow-xl">
            Reconstructing 1889 Eiffel Tower &amp; Champ-de-Mars…
          </div>
        </div>
      )}

      {/* Persistent Single-Node Calibrated Archival Glass-Plate Overlay:
          - Phase 1 ("lifting"): WAAPI GPU compositor-thread FLIP glide from SERP sourceRect -> exact stage center
          - Phase 2 ("active"): direct 60fps ref-driven opacity cross-dissolve aligned 1:1 with Three.js camera */}
      {showPlateNode && plateRect && activePhotoSrc && (
        <div
          ref={plateElRef}
          data-testid={activePhotoId === "55" ? "eiffel-hero-plate" : "eiffel-archival-plate"}
          data-photo-id={activePhotoId ?? ""}
          className="pointer-events-none absolute z-[15] overflow-hidden bg-[#d8d6d1] will-change-[transform,opacity]"
          style={{
            left: plateRect.x,
            top: plateRect.y,
            width: plateRect.w,
            height: plateRect.h,
            transformOrigin: "0 0",
            backfaceVisibility: "hidden",
            border: "1px solid rgba(36, 33, 28, 0.54)",
            boxShadow: "0 24px 64px rgba(15, 14, 12, 0.24)",
            opacity: phase === "lifting" ? 1 : walkthrough.plateOpacity,
          }}
        >
          <img
            src={activePhotoSrc}
            alt={`${milestone.dateLabel} — ${milestone.title}`}
            draggable={false}
            decoding="sync"
            className="h-full w-full object-fill"
          />
        </div>
      )}

      {/* Authentic Archival Exhibition Chrome */}
      {chromeVisible && (
        <>
          {/* Top-left dark museum plaque */}
          {!pureView && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto absolute left-7 top-6 z-20"
            >
              <div className="relative rounded-[2px] border border-white/10 bg-[#1c1d1f]/95 px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
                <h1 className="font-serif text-[14.5px] font-normal tracking-[0.14em] text-[#f5f2eb]">
                  LA TOUR DE 300 MÈTRES
                </h1>
                <p className="mt-0.5 text-[11px] tracking-[0.06em] text-[#a5a39e]">
                  {lang === "fr" ? "Exposition d’archives 1887–1889" : "1887–1889 Archival Exhibition"}
                </p>
              </div>
            </motion.div>
          )}

          {/* Top-right dark capsule: EN · FR | Pure View | Close */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto absolute right-7 top-6 z-20 flex items-center gap-2"
          >
            {actions}
            <div className="flex h-[38px] items-center rounded-[2px] border border-white/10 bg-[#1c1d1f]/95 shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
              <div className="flex items-center gap-1.5 px-3 text-[11.5px] tracking-[0.12em]">
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  data-testid="button-eiffel-lang-en"
                  className={lang === "en" ? "font-semibold text-white" : "text-[#8e8d89] hover:text-white"}
                >
                  EN
                </button>
                <span className="text-[#6d6c68]" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setLang("fr")}
                  data-testid="button-eiffel-lang-fr"
                  className={lang === "fr" ? "font-semibold text-white" : "text-[#8e8d89] hover:text-white"}
                >
                  FR
                </button>
              </div>
              <span className="h-5 w-px bg-white/12" aria-hidden="true" />
              <button
                type="button"
                aria-label={pureView ? "Show exhibition labels" : "Pure view"}
                title={pureView ? "Show labels (H)" : "Pure view (H)"}
                data-testid="button-eiffel-pure"
                onClick={() => setPureView((v) => !v)}
                className="grid size-[38px] place-items-center text-[#dcd9d2] hover:bg-white/10"
              >
                {pureView ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              {onClose && (
                <>
                  <span className="h-5 w-px bg-white/12" aria-hidden="true" />
                  <button
                    type="button"
                    aria-label="Close Eiffel Tower exhibition"
                    data-testid="button-eiffel-close"
                    onClick={onClose}
                    className="grid size-[38px] place-items-center text-[#dcd9d2] hover:bg-white/12"
                  >
                    <X className="size-4" />
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {/* Left white editorial vellum placard (60fps direct ref opacity/translate sync!) */}
          {!pureView && (
            <div
              ref={placardElRef}
              style={{
                opacity: walkthrough.placardOpacity,
                transform: `translate3d(${(1 - walkthrough.placardOpacity) * -10}px, 0, 0)`,
              }}
              className="pointer-events-auto absolute left-7 top-[102px] z-20 hidden will-change-[transform,opacity] md:block"
            >
              {cardHidden ? (
                <button
                  type="button"
                  onClick={() => setCardHidden(false)}
                  data-testid="button-eiffel-show-card"
                  className="rounded-[2px] border border-black/10 bg-[#fdfcf9]/96 px-3.5 py-2 text-[11px] font-medium tracking-[0.14em] text-[#3a3936] shadow-lg hover:bg-white"
                >
                  {dateText} · SHOW +
                </button>
              ) : (
                <article
                  data-testid="panel-eiffel-placard"
                  className="w-[324px] rounded-[2px] border border-black/8 bg-[#fdfcf9]/96 p-5 text-left text-[#232220] shadow-[0_18px_48px_rgba(24,22,18,0.16)]"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-medium tracking-[0.16em] text-[#6d6a64]">
                    <span className="tabular-nums uppercase">{dateText}</span>
                    <button
                      type="button"
                      onClick={() => setCardHidden(true)}
                      data-testid="button-eiffel-hide-card"
                      className="tracking-[0.14em] text-[#7a7770] hover:text-[#1f1e1c]"
                    >
                      {lang === "fr" ? "MASQUER —" : "HIDE —"}
                    </button>
                  </div>

                  <h2 className="mt-2.5 font-serif text-[20px] font-normal leading-[1.24] text-[#171614]">
                    {headingText}
                  </h2>

                  <p className="mt-2.5 text-[13px] leading-[1.6] text-[#3f3d39]">
                    {bodyText}
                  </p>

                  <div className="mt-3.5 border-t border-black/10 pt-2.5 text-[11.5px] leading-[1.45] text-[#6d6a64]">
                    {footerSpecText}
                  </div>
                </article>
              )}
            </div>
          )}

          {/* Single Clean Museum Timeline Bar with 60fps scaleX GPU progress rail */}
          {!pureView && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-6 ${
                bottomDockReserve > 0 ? "bottom-4" : "bottom-8"
              }`}
            >
              <div
                data-testid="eiffel-bottom-bar"
                className="pointer-events-auto flex h-[54px] w-full max-w-[820px] items-center gap-3 rounded-[2px] border border-white/10 bg-[#17181a]/95 px-4 shadow-[0_18px_46px_rgba(0,0,0,0.42)]"
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous archival stop"
                    onClick={() => handleSelectStop(Math.max(1, walkthrough.stopIndex - 1))}
                    disabled={walkthrough.stopIndex <= 1}
                    className="grid size-7 place-items-center text-[#bdbab2] hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={walkthrough.playing ? "Pause chronological exhibition" : "Play chronological exhibition"}
                    title={walkthrough.playing ? "Pause chronological exhibition" : "Play chronological exhibition"}
                    data-testid="button-eiffel-play"
                    onClick={handleTogglePlay}
                    className="grid size-9 place-items-center rounded-[2px] border border-white/30 bg-white/5 text-white hover:bg-white/14"
                  >
                    {walkthrough.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-white" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Next archival stop"
                    onClick={() => handleSelectStop(Math.min(EIFFEL_MILESTONES.length, walkthrough.stopIndex + 1))}
                    disabled={walkthrough.stopIndex >= EIFFEL_MILESTONES.length}
                    className="grid size-7 place-items-center text-[#bdbab2] hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <span className="h-5 w-px bg-white/15" aria-hidden="true" />

                <span
                  data-testid="text-eiffel-timeline-date"
                  className="min-w-[104px] font-serif text-[13.5px] tracking-[0.04em] text-[#e7e3da] tabular-nums whitespace-nowrap"
                >
                  {dateText}
                </span>

                {/* 12 Archival Stop Squares + 60fps GPU-Scaled White Progress Fill */}
                <div
                  className="relative flex flex-1 items-center justify-between px-2"
                  role="group"
                  aria-label="1884 to 1889 construction stops"
                >
                  <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/20" />
                  <div
                    ref={progressElRef}
                    className="pointer-events-none absolute inset-x-3 top-1/2 h-[1.5px] origin-left bg-white/85 will-change-transform"
                    style={{
                      transform: `translateY(-50%) scaleX(${Math.max(0, Math.min(1, walkthrough.tau / (EIFFEL_MILESTONES.length - 1))).toFixed(4)})`,
                    }}
                    data-testid="eiffel-timeline-progress"
                  />
                  {EIFFEL_MILESTONES.map((m) => {
                    const isActive = m.stopIndex === walkthrough.displayStopIndex;
                    const isPassed = m.stopIndex < walkthrough.displayStopIndex;
                    return (
                      <button
                        key={m.stopIndex}
                        type="button"
                        aria-label={`${m.dateLabel}: ${m.title}`}
                        title={`${m.dateLabel} — ${m.title}`}
                        data-testid={`button-eiffel-stop-${m.stopIndex}`}
                        onClick={() => handleSelectStop(m.stopIndex)}
                        className="relative z-10 grid size-5 place-items-center"
                      >
                        <span
                          className={`block transition-all ${
                            isActive
                              ? "size-[9px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]"
                              : isPassed
                                ? "size-[6px] border border-white/80 bg-white/65"
                                : "size-[6px] border border-white/45 bg-[#17181a] hover:border-white"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <span className="h-5 w-px bg-white/15" aria-hidden="true" />

                <button
                  type="button"
                  data-testid="button-eiffel-reveal-3d"
                  onClick={handleToggleReveal3D}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[2px] border border-white/30 bg-white/5 px-3 text-[12px] tracking-[0.04em] text-[#f3efe8] hover:bg-white/15 whitespace-nowrap"
                >
                  <Layers className="size-3.5" />
                  {walkthrough.stopIndex === 12
                    ? lang === "fr"
                      ? "Planche 1884"
                      : "1884 Plate"
                    : !showPlateLabel
                      ? lang === "fr"
                        ? "Voir en 3D"
                        : "Reveal 3D"
                      : lang === "fr"
                        ? "Voir la photo"
                        : "Show Plate"}
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
