import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { motion, useReducedMotion } from "framer-motion";
import { Box, Layers, CircleDot, RotateCcw, EyeOff, Scan, Camera, Package, X, Crosshair, Scissors, ExternalLink } from "lucide-react";
import { PlantCellModel, type SceneCtx } from "./plant-cell-model";
import { NeuronModel, type NeuronCtx } from "./neuron-model";
import { ORGANELLES, ORGANELLE_ORDER, type OrganelleId, type ViewMode } from "./organelles";
import { NEURON_PARTS, NEURON_ORDER, type NeuronPartId, type PartInfo } from "./neuron-parts";
import { OrganelleNavigator, type NavItem } from "./organelle-navigator";
import { hasWebGL } from "@/lib/wiki";
import { MODEL_INFO, type ModelId } from "@/lib/model-catalog";
import { StableSceneSurface } from "./stable-scene-surface";

type Vis = { kind: "all" } | { kind: "isolate" | "hide"; id: string };
type Controls = { object: THREE.Camera; target: THREE.Vector3; update: () => void };
type Vec3 = [number, number, number];

interface ModelConfig {
  parts: Record<string, PartInfo>; items: NavItem[]; noun: string; noGL: string;
  modes: readonly (readonly [ViewMode, typeof Box, string])[]; defaultMode: ViewMode; hasCrossSwitch: boolean;
  cam: Vec3; compactCam: Vec3; target: Vec3; shadow: number; minDist: number; maxDist: number; disclaimer?: string;
}

const CONFIG: Record<ModelId, ModelConfig> = {
  "plant-cell": {
    parts: ORGANELLES, items: ORGANELLE_ORDER.map((id) => ({ id, name: ORGANELLES[id].name, color: ORGANELLES[id].color })), noun: "organelles",
    noGL: "The plant cell model needs WebGL.",
    modes: [["exterior", Box, "Exterior"], ["cutaway", Layers, "Cutaway"], ["exploded", CircleDot, "Exploded"]], defaultMode: "cutaway", hasCrossSwitch: true,
    cam: [0, 9.6, 12.8], compactCam: [0, 10.5, 13.5], target: [0, 0.9, 0], shadow: 8, minDist: 6, maxDist: 32,
  },
  neuron: {
    parts: NEURON_PARTS, items: NEURON_ORDER.map((id) => ({ id, name: NEURON_PARTS[id].name, color: NEURON_PARTS[id].color })), noun: "neuron parts",
    noGL: "The neuron model needs WebGL.",
    modes: [["exterior", Box, "Exterior"], ["cutaway", Layers, "Soma & myelin cutaway"]], defaultMode: "cutaway", hasCrossSwitch: false,
    cam: [0, 4.6, 15.5], compactCam: [0, 4.6, 15.5], target: [0, 1.7, 0], shadow: 10, minDist: 4, maxDist: 34,
    disclaimer: "Illustrative myelinated neuron. Not to scale; not all neurons are myelinated.",
  },
};

class GLBoundary extends Component<{ children: ReactNode; reason: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <NoGL reason="The 3D renderer stopped unexpectedly." detail={this.props.reason} /> : this.props.children; }
}

function NoGL({ reason, detail }: { reason: string; detail: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center" data-testid="status-no-webgl">
      <div className="max-w-sm">
        <p className="font-cell text-2xl text-[#2f2a24]">3D view unavailable</p>
        <p className="mt-2 text-sm text-[#6b6255]">{reason} {detail} Try enabling hardware acceleration or opening this page in a current desktop browser.</p>
      </div>
    </div>
  );
}

/**
 * Fits the model by projection zoom only (camera position never moves). The model's
 * bounds are measured once, then projected from the initial camera pose so that
 * orbiting or resizing never re-frames the user's view, only the lens.
 */
function FitModel({ groupRef, cam, target, margin = 1.14 }: { groupRef: { current: THREE.Group | null }; cam: Vec3; target: Vec3; margin?: number }) {
  const { camera, size, invalidate } = useThree();
  const corners = useRef<THREE.Vector3[] | null>(null);
  useEffect(() => {
    const pc = camera as THREE.PerspectiveCamera;
    const g = groupRef.current;
    if (!corners.current && g) {
      g.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(g);
      if (!box.isEmpty()) {
        const view = new THREE.Matrix4().lookAt(new THREE.Vector3(...cam), new THREE.Vector3(...target), new THREE.Vector3(0, 1, 0));
        view.setPosition(...cam);
        const inv = view.clone().invert();
        corners.current = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
          corners.current.push(new THREE.Vector3(x, y, z).applyMatrix4(inv));
      }
    }
    const pts = corners.current; if (!pts) return;
    const aspect = size.width / Math.max(1, size.height);
    const tanV = Math.tan(THREE.MathUtils.degToRad(pc.fov) / 2), tanH = tanV * aspect;
    let need = 0;
    for (const p of pts) { const d = Math.max(0.5, -p.z); need = Math.max(need, Math.abs(p.x) / (d * tanH), Math.abs(p.y) / (d * tanV)); }
    pc.zoom = 1 / (need * margin);
    pc.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, groupRef, cam, target, margin, invalidate]);
  return null;
}

export function CellViewer({ compact = false, onClose, feathered = false, actions, transitioning = false, model = "plant-cell" }: { compact?: boolean; onClose?: () => void; feathered?: boolean; actions?: ReactNode; transitioning?: boolean; model?: ModelId }) {
  const cfg = CONFIG[model];
  const meta = MODEL_INFO[model];
  const isNeuron = model === "neuron";
  const pad = feathered ? "8% 8% 8% 8%" : "16px";
  const reduced = !!useReducedMotion();
  const webgl = useMemo(() => hasWebGL(), []);
  const [mode, setModeState] = useState<ViewMode>(cfg.defaultMode);
  const [cross, setCross] = useState(true);
  const [rotate, setRotate] = useState(compact && !reduced);
  const camPos = useRef<Vec3>(compact ? cfg.compactCam : cfg.cam);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [vis, setVis] = useState<Vis>({ kind: "all" });
  const [note, setNote] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const controls = useRef<Controls | null>(null);
  const recordCamera = () => {
    const c = controls.current, canvas = glRef.current?.domElement;
    if (c && canvas) canvas.dataset.cameraPose = JSON.stringify({
      position: c.object.position.toArray(), target: c.target.toArray(),
    });
  };

  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote((n) => (n === m ? null : n)), 2600); };
  const setMode = (m: ViewMode) => { setModeState(m); setCross(m !== "exterior"); };
  const choosePart = (id: string | null) => {
    setSelected(id);
    // Keep isolation attached to the inspected part, including keyboard choices.
    if (isNeuron) setVis((current) => current.kind === "all" ? current
      : id ? { kind: current.kind, id } : { kind: "all" });
  };

  const isVisible = useCallback((id: OrganelleId) => {
    if (vis.kind === "all") return true;
    if (vis.kind === "isolate") return id === vis.id || id === "wall" || id === "cytoplasm";
    return id === vis.id;
  }, [vis]);
  const neuronVis = useCallback((id: NeuronPartId) => {
    if (vis.kind === "all" || id === vis.id) return "show" as const;
    return vis.kind === "isolate" ? "ghost" as const : "none" as const;
  }, [vis]);

  const plantCtx: SceneCtx = { mode, cross, reduced, selected: selected as OrganelleId | null, hovered: hovered as OrganelleId | null, isVisible, onSelect: choosePart, onHover: setHovered };
  const neuronCtx: NeuronCtx = { mode: mode === "exterior" ? "exterior" : "cutaway", selected: selected as NeuronPartId | null, hovered: hovered as NeuronPartId | null, visibility: neuronVis, onSelect: choosePart, onHover: setHovered };

  const resetView = () => {
    setVis({ kind: "all" }); setSelected(null); setHovered(null);
    setModeState(cfg.defaultMode); setCross(true); setRotate(false);
    const c = controls.current;
    if (c) { c.object.position.set(...cfg.cam); c.target.set(...cfg.target); c.update(); }
  };
  const visAction = (kind: "isolate" | "hide") => {
    if (!selected) { flash(`Click ${isNeuron ? "a part" : "an organelle"} first, then ` + (kind === "isolate" ? "isolate" : "hide the others") + "."); return; }
    setVis((v) => (v.kind === kind && v.id === selected ? { kind: "all" } : { kind, id: selected }));
  };
  const download = (url: string, name: string) => { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); };
  const screenshot = () => {
    const gl = glRef.current; if (!gl) { flash("Screenshot unavailable."); return; }
    try { download(gl.domElement.toDataURL("image/png"), `${meta.filename}.png`); flash(`Saved ${meta.filename}.png`); }
    catch { flash("Screenshot failed."); }
  };
  const exportGlb = async () => {
    const g = groupRef.current; if (!g) { flash("Export unavailable."); return; }
    flash("Preparing GLB…");
    try {
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
      new GLTFExporter().parse(g, (res) => {
        const blob = new Blob([res as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob); download(url, `${meta.filename}.glb`);
        setTimeout(() => URL.revokeObjectURL(url), 4000); flash(`Saved ${meta.filename}.glb`);
      }, () => flash("Export failed."), { binary: true });
    } catch { flash("Export failed."); }
  };

  const info: PartInfo | null = selected ? cfg.parts[selected] ?? null : null;
  const visAttr = vis.kind === "all" ? "all" : `${vis.kind}:${vis.id}`;

  return (
    <div className="cell-viewer relative h-full w-full overflow-hidden bg-[#f3eee2] select-none" data-testid="cell-viewer"
      data-model={model} data-selected={selected ?? ""} data-visibility={visAttr} data-mode={mode}>
      {webgl ? (
        <GLBoundary reason={cfg.noGL}>
          <StableSceneSurface>
          <Canvas shadows frameloop={transitioning || (isNeuron && !rotate) ? "demand" : "always"}
            dpr={[1, 1.5]} resize={{ debounce: 0, offsetSize: true }} gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
            camera={{ position: camPos.current, fov: 35 }}
            onCreated={({ gl, camera }) => {
              glRef.current = gl;
              if (isNeuron) camera.lookAt(...cfg.target);
              gl.domElement.dataset.cameraPose = JSON.stringify({ position: camera.position.toArray(), target: cfg.target });
            }}
            onPointerMissed={() => choosePart(null)}
            style={{ cursor: hovered ? "pointer" : "grab" }}
            aria-label={`Interactive 3D ${meta.title.toLowerCase()} model`}>
            <ambientLight intensity={isNeuron ? 0.5 : 0.55} />
            <hemisphereLight args={isNeuron ? ["#fff5ea", "#c9a99a", 0.75] : ["#fff8ec", "#c8b68c", 0.7]} />
            <directionalLight position={[6, 12, 8]} intensity={1.7} castShadow shadow-mapSize={isNeuron ? [1024, 1024] : [2048, 2048]} shadow-camera-left={-cfg.shadow} shadow-camera-right={cfg.shadow} shadow-camera-top={cfg.shadow} shadow-camera-bottom={-cfg.shadow} shadow-bias={-0.0004} />
            <directionalLight position={[-8, 6, -4]} intensity={0.45} color="#e2ebff" />
            {isNeuron && <FitModel groupRef={groupRef} cam={cfg.cam} target={cfg.target} margin={1.18} />}
            <Suspense fallback={null}>
              {isNeuron ? <NeuronModel ctx={neuronCtx} groupRef={groupRef} /> : <PlantCellModel ctx={plantCtx} groupRef={groupRef} />}
            </Suspense>
            <ContactShadows position={[0, -0.03, 0]} opacity={isNeuron ? 0.32 : 0.42} scale={isNeuron ? 26 : 20} blur={2.6} far={6} color={isNeuron ? "#5e3a3f" : "#5b4a2e"} />
            <OrbitControls ref={controls as never} makeDefault onChange={recordCamera} enabled={!transitioning} enableDamping={!reduced} target={cfg.target} autoRotate={rotate && !transitioning} autoRotateSpeed={0.55}
              minDistance={cfg.minDist} maxDistance={cfg.maxDist} maxPolarAngle={Math.PI * 0.49} enableZoom />
          </Canvas>
          </StableSceneSurface>
        </GLBoundary>
      ) : <NoGL reason="This browser did not provide a WebGL context." detail={cfg.noGL} />}

      {!compact && !transitioning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : 0.12 }}
          className="pointer-events-none absolute flex flex-wrap content-start items-start justify-between gap-2" style={{ inset: pad }}>
          <div className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-full border border-[#e2dccd] bg-[#f8f5ec]/90 backdrop-blur p-1 shadow-[0_8px_24px_-14px_rgba(70,55,30,.35)] text-[#3a342c]" role="toolbar" aria-label="Viewer tools">
            <Tool on={rotate} onClick={() => setRotate((r) => !r)} label="Rotate" testid="button-rotate"><RotateCcw className="size-4" /></Tool>
            <Tool on={vis.kind === "isolate"} onClick={() => visAction("isolate")} label="Isolate" testid="button-isolate"><Crosshair className="size-4" /></Tool>
            <Tool on={vis.kind === "hide"} onClick={() => visAction("hide")} label="Hide Others" testid="button-hide-others"><EyeOff className="size-4" /></Tool>
            <Tool onClick={resetView} label="Reset View" testid="button-reset-view"><Scan className="size-4" /></Tool>
            <Sep />
            <Tool onClick={screenshot} label="Screenshot" testid="button-screenshot" disabled={!webgl}><Camera className="size-4" /></Tool>
            <Tool onClick={exportGlb} label="3D Export" testid="button-export" disabled={!webgl}><Package className="size-4" /></Tool>
          </div>

          <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-full border border-[#e2dccd] bg-[#f8f5ec]/90 backdrop-blur p-1 shadow-[0_8px_24px_-14px_rgba(70,55,30,.35)]" role="radiogroup" aria-label="View mode">
              {cfg.modes.map(([m, Icon, label]) => (
                <button key={m} role="radio" aria-checked={mode === m} aria-label={label} title={label} data-testid={`button-mode-${m}`} onClick={() => setMode(m)}
                  className={`grid place-items-center size-8 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f8f4e] ${mode === m ? "bg-[#e4ead2] text-[#3f4f2c]" : "text-[#5c554b] hover:bg-white"}`}>
                  <Icon className="size-4" strokeWidth={1.7} />
                </button>
              ))}
              {cfg.hasCrossSwitch && (
                <>
                  <span className="w-px h-5 bg-[#d9d2c2] mx-0.5" />
                  <button role="switch" aria-checked={cross} aria-label="Cross-section" title="Cross-section" data-testid="switch-cross-section" onClick={() => setCross((c) => !c)}
                    className={`grid place-items-center size-8 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f8f4e] ${cross ? "bg-[#6f8f4e] text-[#fbf9f3]" : "text-[#5c554b] hover:bg-white"}`}>
                    <Scissors className="size-4" strokeWidth={1.7} />
                  </button>
                </>
              )}
            </div>
            {actions}
            {onClose && (
              <button onClick={onClose} aria-label="Close 3D viewer" title="Close" data-testid="button-close-viewer"
                className="grid place-items-center size-8 rounded-full bg-white/85 text-[#2a2d33] shadow-sm hover:bg-white"><X className="size-4" /></button>
            )}
          </div>

          {isNeuron && (
            <div className="basis-full pl-2 pt-0.5 text-[#3a2f2c]" data-testid="text-model-title">
              <p className="font-cell text-[22px] leading-none tracking-tight">{meta.title}</p>
              {cfg.disclaimer && <p className="mt-1 max-w-[30ch] text-[11px] leading-snug text-[#7a6a62]" data-testid="text-model-disclaimer">{cfg.disclaimer}</p>}
            </div>
          )}

          {info && selected && (
            <div className="pointer-events-auto absolute left-0 bottom-20 w-[min(300px,100%)] max-h-[min(55%,calc(100%-11rem))] overflow-auto rounded-2xl border border-[#e2dccd] bg-[#fbf8f0]/95 backdrop-blur p-4 shadow-[0_12px_30px_-16px_rgba(70,55,30,.4)]" data-testid="panel-organelle">
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: info.color }} />
                <h3 className="font-cell text-[22px] leading-none text-[#2a2520]" data-testid="text-organelle-name">{info.name}</h3>
                <button aria-label="Deselect" className="ml-auto text-[#8c8478] hover:text-[#2a2520]" onClick={() => choosePart(null)} data-testid="button-deselect"><X className="size-4" /></button>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#4a4338]">{info.blurb}</p>
              <ul className="mt-2 space-y-1">{info.facts.map((f) => <li key={f} className="text-[12px] text-[#6b6255] pl-3 relative before:absolute before:left-0 before:top-[7px] before:size-1 before:rounded-full before:bg-[#b5aa94]">{f}</li>)}</ul>
              {info.sources && (
                <div className="mt-3 border-t border-[#e7dfcf] pt-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a8f7e]">Sources</p>
                  <ul className="mt-1 space-y-1">
                    {info.sources.map((s, i) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noreferrer" data-testid={`link-source-${selected}-${i}`}
                          className="inline-flex items-start gap-1 text-[11.5px] leading-snug text-[#7d4a72] underline decoration-[#d8c3cf] underline-offset-2 hover:decoration-[#7d4a72]">
                          <span>{s.label}</span><ExternalLink className="mt-[2px] size-3 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div aria-live="polite" className="absolute left-1/2 -translate-x-1/2 bottom-20">
            {(note || hovered) && <span className="whitespace-nowrap rounded-full bg-[#2f2a24]/85 text-[#f3eee2] text-[12px] px-3 py-1" data-testid="status-viewer">{note ?? cfg.parts[hovered!]?.name}</span>}
          </div>

          <OrganelleNavigator selected={selected} onSelect={choosePart} items={cfg.items} noun={cfg.noun} />
        </motion.div>
      )}
    </div>
  );
}

function Sep() { return <span className="w-px h-5 bg-[#d9d2c2] mx-0.5" />; }
function Tool({ children, label, onClick, on, testid, disabled }: { children: ReactNode; label: string; onClick: () => void; on?: boolean; testid: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={on} disabled={disabled} data-testid={testid} aria-label={label} title={label}
      className={`grid place-items-center size-8 rounded-full transition disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f8f4e] ${on ? "bg-[#e4ead2] text-[#3f4f2c]" : "hover:bg-white"}`}>
      {children}
    </button>
  );
}
