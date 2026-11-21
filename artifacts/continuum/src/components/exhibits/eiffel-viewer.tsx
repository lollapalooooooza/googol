import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { EiffelWorldController } from "./eiffel-scene";
import {
  EIFFEL_MILESTONES,
  EIFFEL_PRESETS,
  nearestMilestoneForStep,
  type EiffelLang,
} from "./eiffel-data";
import {
  computeCenteredPlateRect,
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

export type EiffelExhibitionPhase = "lifting" | "plate_1884" | "3d";

export function EiffelViewer({
  compact = false,
  transitioning = false,
  feathered = false,
  transitionSource = null,
  autoStartFrom1884 = false,
  onClose,
  actions,
}: {
  compact?: boolean;
  transitioning?: boolean;
  feathered?: boolean;
  transitionSource?: { sourceRect: BoxRect; imageSrc: string } | null;
  autoStartFrom1884?: boolean;
  onClose?: () => void;
  actions?: ReactNode;
}) {
  const reduced = !!useReducedMotion();
  const [webgl] = useState(hasWebGL);
  const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
  const controllerRef = useRef<EiffelWorldController | null>(null);

  const startsInPlate = Boolean(transitionSource || autoStartFrom1884);
  const [phase, setPhase] = useState<EiffelExhibitionPhase>(() =>
    transitionSource ? "lifting" : autoStartFrom1884 ? "plate_1884" : "3d",
  );
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [step, setStep] = useState(startsInPlate ? 0.35 : 11.0);
  const [playing, setPlaying] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>("overview");
  const [lang, setLang] = useState<EiffelLang>("en");
  const [cardHidden, setCardHidden] = useState(false);
  const [pureView, setPureView] = useState(false);
  const manualOverrideRef = useRef(false);

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1440,
    h: typeof window !== "undefined" ? window.innerHeight : 900,
  }));

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isPlateActive = phase === "lifting" || phase === "plate_1884";
  const targetPlateRect = computeCenteredPlateRect(viewport.w, viewport.h);
  const milestone = nearestMilestoneForStep(step, isPlateActive);
  const activeStopIndex = isPlateActive ? 1 : milestone.stopIndex;
  const activePresetObj = EIFFEL_PRESETS.find((p) => p.id === activePreset) ?? null;
  const showPresetInPlacard = Boolean(
    !isPlateActive && activePresetObj && activePresetObj.id !== "overview" && !playing,
  );

  // Mount Three.js WebGL controller once
  useEffect(() => {
    if (!webgl || !mountEl) return;
    const ctrl = new EiffelWorldController(
      mountEl,
      {
        onReady: () => setReady(true),
        onStepChange: (nextStep) => {
          setStep(nextStep);
          if (nextStep >= 11.0) setPlaying(false);
        },
        onPresetClear: () => setActivePreset(null),
        onContextLost: (lost) => setContextLost(lost),
      },
      { reducedMotion: reduced, initialPlateMode: startsInPlate },
    );
    controllerRef.current = ctrl;
    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, [webgl, mountEl, reduced, startsInPlate]);

  // Phase 1 -> Phase 2: settle the lifted elevation plate at screen center
  useEffect(() => {
    if (phase !== "lifting") return;
    const settleMs = reduced ? 120 : 920;
    const timer = window.setTimeout(() => {
      setPhase("plate_1884");
    }, settleMs);
    return () => window.clearTimeout(timer);
  }, [phase, reduced]);

  // Phase 2 -> Phase 3: after holding briefly on the 1884 blueprint over the 3D Paris horizon,
  // smoothly dissolve into the live 3D tower and automatically play the chronological animation from 1884 -> 1887..1889
  useEffect(() => {
    if (!autoStartFrom1884 || phase !== "plate_1884" || manualOverrideRef.current) return;
    if (webgl && !ready) return;
    const holdMs = reduced ? 900 : 1550;
    const timer = window.setTimeout(() => {
      if (manualOverrideRef.current) return;
      setPhase("3d");
      setStep(0.35);
      setPlaying(true);
      controllerRef.current?.setExhibitionPlateMode(false, { startStep: 0.35 });
      controllerRef.current?.setPlaying(true);
    }, holdMs);
    return () => window.clearTimeout(timer);
  }, [autoStartFrom1884, phase, ready, webgl, reduced]);

  const enterPlate1884 = () => {
    manualOverrideRef.current = true;
    setPlaying(false);
    setPhase("plate_1884");
    setStep(0.35);
    controllerRef.current?.setPlaying(false);
    controllerRef.current?.setExhibitionPlateMode(true);
  };

  const reveal3D = (startAtStep?: number, autoPlay = false) => {
    manualOverrideRef.current = true;
    const nextStep = typeof startAtStep === "number" ? startAtStep : isPlateActive ? 0.35 : step;
    setPhase("3d");
    setStep(nextStep);
    setPlaying(autoPlay);
    controllerRef.current?.setExhibitionPlateMode(false, { startStep: nextStep });
    controllerRef.current?.setPlaying(autoPlay);
  };

  const handleTogglePlay = () => {
    manualOverrideRef.current = true;
    if (isPlateActive) {
      reveal3D(0.35, true);
      return;
    }
    const next = !playing;
    setPlaying(next);
    controllerRef.current?.setPlaying(next);
  };

  const handleSelectStop = (stopIdx: number) => {
    manualOverrideRef.current = true;
    if (stopIdx <= 1) {
      enterPlate1884();
      return;
    }
    const targetMilestone = EIFFEL_MILESTONES.find((m) => m.stopIndex === stopIdx);
    if (!targetMilestone) return;
    setPlaying(false);
    setPhase("3d");
    setStep(targetMilestone.step);
    controllerRef.current?.setPlaying(false);
    if (isPlateActive) {
      controllerRef.current?.setExhibitionPlateMode(false, { startStep: targetMilestone.step });
    } else {
      controllerRef.current?.setStep(targetMilestone.step);
    }
  };

  const handlePreset = (presetId: string) => {
    manualOverrideRef.current = true;
    if (isPlateActive) {
      setPhase("3d");
      controllerRef.current?.setExhibitionPlateMode(false, { startStep: 11.0 });
      setStep(11.0);
    }
    setActivePreset(presetId);
    controllerRef.current?.setPreset(presetId);
  };

  const handleReset = () => {
    manualOverrideRef.current = true;
    setPlaying(false);
    setPhase("3d");
    setActivePreset("overview");
    setStep(11.0);
    controllerRef.current?.setPlaying(false);
    controllerRef.current?.setExhibitionPlateMode(false, { startStep: 11.0 });
    controllerRef.current?.resetView();
  };

  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSelectStop(Math.max(1, activeStopIndex - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSelectStop(Math.min(EIFFEL_MILESTONES.length, activeStopIndex + 1));
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
  });

  const dateText = showPresetInPlacard
    ? `${activePresetObj!.numeral} · ${lang === "fr" ? activePresetObj!.labelFr : activePresetObj!.label}`
    : lang === "fr"
      ? milestone.dateLabelFr
      : milestone.dateLabel;
  const headingText = showPresetInPlacard
    ? activePresetObj!.shortLabel
    : lang === "fr"
      ? milestone.titleFr
      : milestone.title;
  const bodyText = showPresetInPlacard
    ? lang === "fr"
      ? activePresetObj!.captionFr
      : activePresetObj!.caption
    : lang === "fr"
      ? milestone.narrativeFr
      : milestone.narrative;
  const footerSpecText = isPlateActive
    ? lang === "fr"
      ? "Empattement 125 m · Plateformes à 58 m, 116 m et 276 m · Sommet 312 m"
      : "125 m Base Span · Platforms at 58 m, 116 m, and 276 m · 312 m Tip"
    : lang === "fr"
      ? milestone.elevationSummaryFr
      : milestone.elevationSummary;

  const chromeVisible = !compact && !transitioning && phase !== "lifting";

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden text-[#f3efe8]"
      data-testid="eiffel-viewer"
      data-ready={ready ? "ready" : "loading"}
      data-phase={phase}
      data-stop={activeStopIndex}
      data-step={step.toFixed(2)}
      data-preset={activePreset ?? "custom"}
      data-lang={lang}
    >
      {/* Smooth 3D Background Reveal Layer with optional CellPortal-style feathered soft edges (no CSS backdrop-filter over WebGL) */}
      <motion.div
        className={`absolute inset-0 bg-[#e9e4da] ${feathered ? "feather-soft" : ""}`}
        data-testid={feathered ? "eiffel-feathered-stage" : undefined}
        initial={transitionSource ? { opacity: 0, scale: 1.035 } : { opacity: 1, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0.12 : 0.95, ease: [0.22, 1, 0.36, 1] }}
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

      {/* Hero Archival 1884 Elevation Plate: glides from SERP sourceRect -> screen center -> dissolves into 3D */}
      <AnimatePresence>
        {isPlateActive && (
          <motion.div
            key="hero-elevation-plate"
            data-testid="eiffel-hero-plate"
            className="pointer-events-none fixed z-10 overflow-hidden bg-[#d8d6d1]"
            initial={
              transitionSource
                ? {
                    left: transitionSource.sourceRect.x,
                    top: transitionSource.sourceRect.y,
                    width: transitionSource.sourceRect.w,
                    height: transitionSource.sourceRect.h,
                    opacity: 1,
                    scale: 1,
                    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.16)",
                  }
                : {
                    left: targetPlateRect.x,
                    top: targetPlateRect.y,
                    width: targetPlateRect.w,
                    height: targetPlateRect.h,
                    opacity: 0,
                    scale: 0.96,
                    boxShadow: "0 24px 64px rgba(15, 14, 12, 0.28)",
                  }
            }
            animate={{
              left: targetPlateRect.x,
              top: targetPlateRect.y,
              width: targetPlateRect.w,
              height: targetPlateRect.h,
              opacity: 1,
              scale: 1,
              boxShadow: "0 26px 68px rgba(15, 14, 12, 0.28)",
            }}
            exit={{
              opacity: 0,
              scale: 1.035,
              transition: { duration: reduced ? 0.12 : 0.85, ease: [0.22, 1, 0.36, 1] },
            }}
            transition={{
              duration: reduced ? 0.12 : 0.9,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              border: "1px solid rgba(32, 31, 28, 0.55)",
            }}
          >
            <img
              src={transitionSource?.imageSrc || EIFFEL_ELEVATION_PLATE_SRC}
              alt="ÉLÉVATION Fig. 1 — Échelle 0.001 p. m. Gustave Eiffel 1:1,000 architectural elevation drawing"
              draggable={false}
              className="h-full w-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Authentic Figure 2 Archival Exhibition Chrome */}
      {chromeVisible && (
        <>
          {/* Top-left dark museum plaque */}
          {!pureView && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto absolute left-8 top-7 z-20"
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

          {/* Top-right dark capsule matching Figure 1: EN · FR | Eye (+ subtle Close) */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto absolute right-8 top-7 z-20 flex items-center gap-2"
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

          {/* Left white editorial vellum placard (matches Figure 1) */}
          {!pureView && (
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.48, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto absolute left-8 top-[108px] z-20 hidden md:block"
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
                  className="w-[332px] rounded-[2px] border border-black/8 bg-[#fdfcf9]/96 p-6 text-left text-[#232220] shadow-[0_18px_48px_rgba(24,22,18,0.16)]"
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

                  <h2 className="mt-3 font-serif text-[21px] font-normal leading-[1.24] text-[#171614]">
                    {headingText}
                  </h2>

                  <p className="mt-3 text-[13.5px] leading-[1.62] text-[#3f3d39]">
                    {bodyText}
                  </p>

                  <div className="mt-4 border-t border-black/10 pt-3 text-[12px] leading-[1.45] text-[#6d6a64]">
                    {footerSpecText}
                  </div>
                </article>
              )}
            </motion.div>
          )}

          {/* Single Clean Museum Timeline Bar (exact Figure 1 original design) */}
          {!pureView && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center px-6"
            >
              <div
                data-testid="eiffel-bottom-bar"
                className="pointer-events-auto flex h-[54px] w-full max-w-[820px] items-center gap-3 rounded-[2px] border border-white/10 bg-[#17181a]/95 px-4 shadow-[0_18px_46px_rgba(0,0,0,0.42)]"
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous archival stop"
                    onClick={() => handleSelectStop(Math.max(1, activeStopIndex - 1))}
                    disabled={activeStopIndex <= 1}
                    className="grid size-7 place-items-center text-[#bdbab2] hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={playing ? "Pause 1884 to 1889 animation" : "Play 1884 to 1889 animation"}
                    data-testid="button-eiffel-play"
                    onClick={handleTogglePlay}
                    className="grid size-9 place-items-center rounded-[2px] border border-white/30 bg-white/5 text-white hover:bg-white/14"
                  >
                    {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-white" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Next archival stop"
                    onClick={() => handleSelectStop(Math.min(EIFFEL_MILESTONES.length, activeStopIndex + 1))}
                    disabled={activeStopIndex >= EIFFEL_MILESTONES.length}
                    className="grid size-7 place-items-center text-[#bdbab2] hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <span className="h-5 w-px bg-white/15" aria-hidden="true" />

                <span
                  data-testid="text-eiffel-timeline-date"
                  className="min-w-[92px] font-serif text-[13.5px] tracking-[0.04em] text-[#e7e3da] tabular-nums whitespace-nowrap"
                >
                  {isPlateActive
                    ? "1884–1889"
                    : lang === "fr"
                      ? milestone.dateLabelFr
                      : milestone.dateLabel}
                </span>

                {/* 12 Archival Stop Squares */}
                <div className="relative flex flex-1 items-center justify-between px-2" role="group" aria-label="1884 to 1889 construction stops">
                  <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/20" />
                  {EIFFEL_MILESTONES.map((m) => {
                    const isActive = m.stopIndex === activeStopIndex;
                    const isPassed = !isPlateActive && m.stopIndex < activeStopIndex;
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
                                ? "size-[6px] border border-white/75 bg-white/55"
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
                  onClick={() => (isPlateActive ? reveal3D(11.0, false) : enterPlate1884())}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[2px] border border-white/30 bg-white/5 px-3 text-[12px] tracking-[0.04em] text-[#f3efe8] hover:bg-white/15 whitespace-nowrap"
                >
                  <Layers className="size-3.5" />
                  {isPlateActive
                    ? lang === "fr"
                      ? "Voir en 3D"
                      : "Reveal 3D"
                    : lang === "fr"
                      ? "Planche 1884"
                      : "1884 Plate"}
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
