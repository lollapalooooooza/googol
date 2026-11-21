import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  Pause,
  Play,
  Scan,
  X,
} from "lucide-react";
import { hasWebGL } from "@/lib/wiki";
import { StableSceneSurface } from "@/components/cell/stable-scene-surface";
import {
  LANDMARK_ORDER,
  MARS_FACTS,
  NASA_FACTS_URL,
  OUTPOST_ZONES,
  type LandmarkId,
} from "./mars-data";
import { MarsWorldController } from "./mars-scene";
import "./exhibits.css";

function Fallback({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#23140e] p-6 text-center text-[#f4e7d8]" data-testid="status-no-webgl">
      <div className="max-w-sm">
        <p className="font-cell text-2xl text-[#fcead5]">3D Mars Outpost unavailable</p>
        <p className="mt-2 text-sm text-[#d4b89e]">
          {text} Mars has a radius of 3,389.5 km with a dust-scattered blue sunset atmosphere.
        </p>
      </div>
    </div>
  );
}

export function MarsViewer({
  compact = false,
  transitioning = false,
  actions,
  onClose,
}: {
  compact?: boolean;
  transitioning?: boolean;
  actions?: ReactNode;
  onClose?: () => void;
  textureUrl?: string;
}) {
  const reduced = !!useReducedMotion();
  const webgl = useMemo(() => hasWebGL(), []);
  const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
  const controllerRef = useRef<MarsWorldController | null>(null);

  const [worldState, setWorldState] = useState<"loading" | "ready">(webgl ? "loading" : "ready");
  const [contextLost, setContextLost] = useState(false);
  const [playing, setPlaying] = useState(!reduced);
  const [selected, setSelected] = useState<LandmarkId | null>(null);
  const [activePreset, setActivePreset] = useState<LandmarkId>("overview");
  const [dockOpen, setDockOpen] = useState(true);
  const [hudHidden, setHudHidden] = useState(false);

  const selectRef = useRef<(zone: LandmarkId | null) => void>(() => {});
  selectRef.current = (zone) => {
    setSelected(zone);
    if (zone) setActivePreset(zone);
  };

  useEffect(() => {
    if (!webgl || !mountEl) return;
    const ctrl = new MarsWorldController({
      container: mountEl,
      initialPlaying: !reduced,
      reducedMotion: reduced,
      onSelectZone: (zone) => selectRef.current(zone),
      onContextLoss: (lost) => setContextLost(lost),
      onReady: () => setWorldState("ready"),
    });
    controllerRef.current = ctrl;
    return () => {
      ctrl.dispose();
      controllerRef.current = null;
      document.body.style.cursor = "";
    };
  }, [webgl, reduced, mountEl]);

  useEffect(() => {
    controllerRef.current?.setPlaying(playing);
  }, [playing]);

  useEffect(() => {
    controllerRef.current?.setTransitioning(transitioning);
  }, [transitioning]);

  const choosePreset = (id: LandmarkId) => {
    setActivePreset(id);
    setSelected(id === "overview" ? null : id);
    controllerRef.current?.focusZone(id);
  };

  const resetView = () => {
    setActivePreset("overview");
    setSelected(null);
    controllerRef.current?.resetView();
  };

  useEffect(() => {
    if (compact || transitioning) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < LANDMARK_ORDER.length) {
        choosePreset(LANDMARK_ORDER[idx]);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "r") {
        resetView();
      } else if (e.key.toLowerCase() === "h") {
        setHudHidden((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact, transitioning]);

  const info = selected ? OUTPOST_ZONES[selected] : null;
  const hideChrome = compact || transitioning;

  return (
    <div
      className="mars-viewer relative h-full w-full overflow-hidden select-none"
      data-testid="mars-viewer"
      data-selected={selected ?? ""}
      data-texture={worldState}
    >
      <p className="sr-only">
        Interactive 3D Mars Outpost world model. Drag to orbit, scroll to zoom, use WASD or Arrow keys to roam the surface, and click domes or rovers to inspect.
      </p>

      {!webgl ? (
        <Fallback text="This browser did not provide a WebGL context." />
      ) : (
        <StableSceneSurface>
          <div ref={setMountEl} className="h-full w-full" />
        </StableSceneSurface>
      )}

      {contextLost && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#1c100b]/90 p-6 text-center text-[#f4e7d8]" role="alert">
          <div>
            <p className="font-cell text-xl">WebGL context interrupted</p>
            <p className="mt-1 text-xs text-[#cbb099]">Restoring the Mars Outpost 3D viewport…</p>
          </div>
        </div>
      )}

      <div
        className={`exhibit-chrome absolute inset-0 pointer-events-none ${hideChrome ? "is-hidden" : ""}`}
        aria-hidden={hideChrome}
        inert={hideChrome || undefined}
      >
        {/* Top bar: compact title + telemetry + window actions */}
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
          {!hudHidden && (
            <div className="pointer-events-auto rounded-2xl border border-[#e7b589]/25 bg-[#1a100c]/88 px-3.5 py-2.5 text-[#f7ebdd] shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)]">
              <div className="flex items-center gap-2">
                <Compass className="size-4 text-[#f39c58]" />
                <p className="font-cell text-[20px] leading-none tracking-tight">Mars Outpost</p>
                <span className="rounded bg-[#f39c58]/15 px-1.5 py-0.5 font-mono text-[10px] text-[#f5b47c]">
                  SOL 412 · SUNSET
                </span>
              </div>
              <dl
                className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10.5px] sm:grid-cols-4"
                data-testid="list-mars-facts"
              >
                {MARS_FACTS.map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-1.5">
                    <dt className="uppercase tracking-[0.08em] text-[#b8977e] text-[9px]">{k}</dt>
                    <dd className="font-mono text-[#f7ebdd]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="pointer-events-auto ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setHudHidden((h) => !h)}
              aria-label={hudHidden ? "Show overlay HUD" : "Hide overlay HUD"}
              title={hudHidden ? "Show HUD (H)" : "Hide HUD (H)"}
              data-testid="button-mars-hud-toggle"
              className="grid place-items-center size-8 rounded-full border border-[#e7b589]/25 bg-[#1a100c]/88 text-[#f7ebdd] shadow-sm hover:bg-[#2a1a13]"
            >
              {hudHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
            {actions}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close Mars viewer"
                title="Close"
                data-testid="button-close-mars"
                className="grid place-items-center size-8 rounded-full border border-[#e7b589]/25 bg-[#1a100c]/88 text-[#f7ebdd] shadow-sm hover:bg-[#2a1a13]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Selected zone inspector card — tucked cleanly above dock */}
        {!hudHidden && info && (
          <div
            className="pointer-events-auto absolute left-4 bottom-24 w-[min(310px,calc(100%-2rem))] rounded-2xl border border-[#e7b589]/30 bg-[#1a100c]/92 p-4 text-[#f7ebdd] shadow-[0_14px_34px_-14px_rgba(0,0,0,0.75)]"
            data-testid="panel-landmark"
          >
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: info.color }} />
              <h3 className="font-cell text-[20px] leading-none text-[#fff2e3]" data-testid="text-landmark-name">
                {info.name}
              </h3>
              <button
                aria-label="Deselect zone"
                onClick={() => setSelected(null)}
                className="ml-auto text-[#b8977e] hover:text-white"
                data-testid="button-deselect-landmark"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 font-mono text-[10.5px] text-[#7dd3fc]">{info.coordinates}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#e6d2bf]">{info.blurb}</p>
            <ul className="mt-2 space-y-1">
              {info.specs.map((f) => (
                <li
                  key={f}
                  className="relative pl-3 text-[11.5px] text-[#cbb099] before:absolute before:left-0 before:top-[7px] before:size-1 before:rounded-full before:bg-[#f39c58]"
                >
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-[#e7b589]/15 pt-2">
              {[info.source, { label: "NASA Mars Facts", url: NASA_FACTS_URL }].map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[#7dd3fc] underline decoration-[#7dd3fc]/40 underline-offset-2 hover:text-[#bae6fd]"
                  data-testid={`link-source-${info.id}`}
                >
                  {s.label}
                  <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Bottom Exploration Dock */}
        {!hudHidden && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 w-[calc(100%-2rem)] max-w-2xl">
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-full border border-[#e7b589]/25 bg-[#1a100c]/90 p-1.5 text-[#f7ebdd] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]">
              <Tool
                on={playing}
                onClick={() => setPlaying((p) => !p)}
                label={playing ? "Pause rover & wind simulation" : "Resume rover & wind simulation"}
                testid="button-mars-rotate"
              >
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </Tool>
              <Tool onClick={resetView} label="Reset view (R)" testid="button-mars-reset">
                <Scan className="size-3.5" />
              </Tool>

              <span className="mx-0.5 h-4 w-px bg-[#e7b589]/20" aria-hidden="true" />

              {dockOpen &&
                LANDMARK_ORDER.map((id, i) => {
                  const zone = OUTPOST_ZONES[id];
                  const active = activePreset === id;
                  return (
                    <button
                      key={id}
                      aria-pressed={active}
                      onClick={() => choosePreset(id)}
                      data-testid={`chip-landmark-${id}`}
                      title={`${zone.name} (${i + 1})`}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f39c58] ${
                        active
                          ? "bg-[#d96d35] text-white font-medium"
                          : "text-[#e9d5c3] hover:bg-white/10"
                      }`}
                    >
                      <span className="size-1.5 rounded-full" style={{ background: zone.color }} />
                      {zone.shortLabel}
                    </button>
                  );
                })}

              <button
                onClick={() => setDockOpen((o) => !o)}
                aria-label={dockOpen ? "Collapse viewpoint strip" : "Expand viewpoint strip"}
                title={dockOpen ? "Collapse presets" : "Expand presets"}
                className="grid place-items-center size-7 rounded-full text-[#cbb099] hover:bg-white/10 hover:text-white"
              >
                {dockOpen ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              </button>
            </div>

            {dockOpen && (
              <p className="pointer-events-none text-center text-[10.5px] text-[#f5dec9]/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                Drag to orbit · Scroll to zoom · WASD / Arrows to roam · Click domes or rovers to inspect
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tool({
  children,
  label,
  onClick,
  on,
  testid,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  on?: boolean;
  testid: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      data-testid={testid}
      className={`grid place-items-center size-7 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f39c58] ${
        on ? "bg-[#f39c58]/25 text-[#ffd5ab]" : "text-[#e9d5c3] hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
