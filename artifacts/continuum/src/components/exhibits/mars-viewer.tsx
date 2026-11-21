import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, Scan, X, ExternalLink, RefreshCw } from "lucide-react";
import { hasWebGL } from "@/lib/wiki";
import { StableSceneSurface } from "@/components/cell/stable-scene-surface";
import { LANDMARKS, LANDMARK_ORDER, MARS_FACTS, NASA_FACTS_URL, TEXTURE_SOURCE_URL, latLonToVec, type LandmarkId } from "./mars-data";
import "./exhibits.css";

type Controls = { object: THREE.Camera; target: THREE.Vector3; update: () => void };
const HOME: [number, number, number] = [0, 0.9, 4.2];

function ResponsiveLens() {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    // Fit the narrow dimension without changing the user's orbit or distance.
    (camera as THREE.PerspectiveCamera).zoom = Math.min(1, size.width / Math.max(1, size.height));
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Fallback text="The 3D renderer stopped unexpectedly." /> : this.props.children; }
}

function Fallback({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center" data-testid="status-no-webgl">
      <div className="max-w-sm">
        <p className="font-cell text-2xl text-[#3b2a22]">3D Mars unavailable</p>
        <p className="mt-2 text-sm text-[#6b5a4c]">{text} Mars has a radius of 3,389.5 km and its landmarks are listed below.</p>
      </div>
    </div>
  );
}

function Planet({ texture, selected, onSelect }: { texture: THREE.Texture; selected: LandmarkId | null; onSelect: (id: LandmarkId | null) => void }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [selected, invalidate]);
  return (
    <group>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(null); }}>
        <sphereGeometry args={[1, 128, 64]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[1, 64, 32]} />
        <meshBasicMaterial color="#e9a27a" transparent opacity={0.08} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {LANDMARK_ORDER.map((id) => {
        const l = LANDMARKS[id]; const on = selected === id;
        const p = latLonToVec(l.lat, l.lonE, 1.004);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...p).normalize());
        return (
          <group key={id} position={p} quaternion={q}>
            <mesh onClick={(e) => { e.stopPropagation(); onSelect(on ? null : id); }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { document.body.style.cursor = ""; }}>
              <circleGeometry args={[0.045, 24]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh><ringGeometry args={[on ? 0.026 : 0.018, on ? 0.036 : 0.026, 32]} /><meshBasicMaterial color={on ? "#f6efe0" : l.color} /></mesh>
            <mesh><circleGeometry args={[0.009, 16]} /><meshBasicMaterial color={l.color} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

export function MarsViewer({ compact = false, transitioning = false, actions, onClose, textureUrl }: {
  compact?: boolean; transitioning?: boolean; actions?: ReactNode; onClose?: () => void; textureUrl: string;
}) {
  const reduced = !!useReducedMotion();
  const webgl = useMemo(() => hasWebGL(), []);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [texState, setTexState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [rotate, setRotate] = useState(!reduced);
  const [selected, setSelected] = useState<LandmarkId | null>(null);
  const controls = useRef<Controls | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const invalidateRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!webgl) return;
    let alive = true; setTexState("loading");
    new THREE.TextureLoader().load(attempt ? `${textureUrl}${textureUrl.includes("?") ? "&" : "?"}r=${attempt}` : textureUrl, (t) => {
      if (!alive) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      setTexture(t); setTexState("ready");
    }, undefined, () => { if (alive) setTexState("error"); });
    return () => { alive = false; };
  }, [textureUrl, attempt, webgl]);
  useEffect(() => () => { texture?.dispose(); }, [texture]);
  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  const record = () => {
    const c = controls.current, cv = glRef.current?.domElement;
    if (c && cv) cv.dataset.cameraPose = JSON.stringify({ position: c.object.position.toArray().map((n) => +n.toFixed(4)), target: c.target.toArray() });
  };
  const focus = (id: LandmarkId | null) => {
    setSelected(id);
    const c = controls.current;
    if (id && c) {
      const l = LANDMARKS[id]; const dist = c.object.position.length();
      c.object.position.set(...latLonToVec(l.lat, l.lonE, dist)); c.update(); setRotate(false); record(); invalidateRef.current();
    }
  };
  const reset = () => {
    const c = controls.current; setSelected(null);
    if (c) { c.object.position.set(...HOME); c.target.set(0, 0, 0); c.update(); record(); invalidateRef.current(); }
  };

  const info = selected ? LANDMARKS[selected] : null;
  const hide = compact || transitioning;
  const pill = "flex items-center gap-0.5 rounded-full border border-[#e3d6c4] bg-[#f8f3ea]/90 backdrop-blur p-1 shadow-[0_8px_24px_-14px_rgba(90,45,25,.4)] text-[#3b2a22]";

  return (
    <div className="mars-viewer relative h-full w-full overflow-hidden select-none" data-testid="mars-viewer" data-selected={selected ?? ""} data-texture={texState}>
      <p className="sr-only">Interactive globe of Mars built from an enhanced-colour map. Drag to rotate, scroll or pinch to zoom. Landmarks: Olympus Mons, Valles Marineris and Jezero crater.</p>
      {!webgl ? <Fallback text="This browser did not provide a WebGL context." /> : (
        <GLBoundary>
          <StableSceneSurface>
          <Canvas frameloop={(rotate && !transitioning) ? "always" : "demand"} dpr={[1, 1.75]} resize={{ debounce: 0, offsetSize: true }}
            gl={{ antialias: true, alpha: true }} camera={{ position: HOME, fov: 32, near: 0.05, far: 50 }}
            onCreated={({ gl, invalidate }) => { glRef.current = gl; invalidateRef.current = invalidate; gl.domElement.dataset.cameraPose = JSON.stringify({ position: HOME, target: [0, 0, 0] }); }}
            aria-label="Interactive 3D Mars globe" style={{ cursor: "grab", touchAction: "none" }}>
            <ResponsiveLens />
            <ambientLight intensity={0.09} color="#9fb8c4" />
            <directionalLight position={[5, 1.6, 3.2]} intensity={2.6} color="#fff1df" />
            <directionalLight position={[-6, -1, -3]} intensity={0.12} color="#5aa0a6" />
            {texture && <Planet texture={texture} selected={selected} onSelect={focus} />}
            <OrbitControls ref={controls as never} makeDefault onChange={record} enabled={!transitioning} enablePan={false}
              enableDamping={!reduced} minDistance={1.6} maxDistance={8} autoRotate={rotate && !transitioning} autoRotateSpeed={0.35} enableZoom />
          </Canvas>
          </StableSceneSurface>
        </GLBoundary>
      )}

      {webgl && texState !== "ready" && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none" role="status" data-testid="status-mars-texture">
          {texState === "loading" ? <div className="mars-skeleton" aria-label="Loading Mars surface map" /> : (
            <div className="pointer-events-auto max-w-xs rounded-2xl border border-[#e3d6c4] bg-[#fbf7ef]/95 p-4 text-center">
              <p className="font-cell text-xl text-[#3b2a22]">Surface map did not load</p>
              <p className="mt-1 text-[12px] text-[#6b5a4c]">The globe needs the Mars image to render. Check the connection and try again.</p>
              <button onClick={() => setAttempt((a) => a + 1)} data-testid="button-retry-texture" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#2f6f6d] px-3 py-1.5 text-[12px] text-[#f6efe0]"><RefreshCw className="size-3.5" />Retry</button>
            </div>
          )}
        </div>
      )}

      <div className={`exhibit-chrome absolute inset-0 pointer-events-none ${hide ? "is-hidden" : ""}`} aria-hidden={hide} inert={hide || undefined}>
        <div className="absolute left-4 right-4 top-4 flex flex-wrap items-start justify-between gap-2">
          <div className={`pointer-events-auto ${pill}`} role="toolbar" aria-label="Mars tools">
            <Tool on={rotate} onClick={() => setRotate((r) => !r)} label={rotate ? "Pause rotation" : "Resume rotation"} testid="button-mars-rotate">{rotate ? <Pause className="size-4" /> : <Play className="size-4" />}</Tool>
            <Tool onClick={reset} label="Reset view" testid="button-mars-reset"><Scan className="size-4" /></Tool>
          </div>
          <div className="pointer-events-auto ml-auto flex items-center gap-1.5">
            {actions}
            {onClose && <button onClick={onClose} aria-label="Close Mars viewer" title="Close" data-testid="button-close-mars" className="grid place-items-center size-8 rounded-full bg-[#fbf7ef]/90 text-[#3b2a22] shadow-sm hover:bg-white"><X className="size-4" /></button>}
          </div>
          <div className="basis-full pl-1 text-[#3b2a22]">
            <p className="font-cell text-[24px] leading-none">Mars</p>
            <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-[11px] w-max" data-testid="list-mars-facts">
              {MARS_FACTS.map(([k, v]) => <div key={k} className="contents"><dt className="text-[#8a7462] uppercase tracking-[0.12em] text-[9.5px] pt-[2px]">{k}</dt><dd className="font-mono text-[#4a3a2e]">{v}</dd></div>)}
            </dl>
          </div>
        </div>

        {info && (
          <div className="pointer-events-auto absolute left-4 bottom-24 w-[min(290px,calc(100%-2rem))] rounded-2xl border border-[#e3d6c4] bg-[#fbf7ef]/95 backdrop-blur p-4 shadow-[0_12px_30px_-16px_rgba(90,45,25,.45)]" data-testid="panel-landmark">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: info.color }} />
              <h3 className="font-cell text-[22px] leading-none text-[#2e2019]" data-testid="text-landmark-name">{info.name}</h3>
              <button aria-label="Deselect landmark" onClick={() => setSelected(null)} className="ml-auto text-[#8a7462] hover:text-[#2e2019]" data-testid="button-deselect-landmark"><X className="size-4" /></button>
            </div>
            <p className="mt-1 font-mono text-[11px] text-[#2f6f6d]">{info.label} <span className="text-[#9a8574]">(representative)</span></p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#4a3a2e]">{info.blurb}</p>
            <ul className="mt-2 space-y-1">{info.facts.map((f) => <li key={f} className="relative pl-3 text-[12px] text-[#6b5a4c] before:absolute before:left-0 before:top-[7px] before:size-1 before:rounded-full before:bg-[#c08a6a]">{f}</li>)}</ul>
            <div className="mt-3 border-t border-[#ecdfcc] pt-2 space-y-1">
              {[info.source, { label: "NASA Science: Mars facts", url: NASA_FACTS_URL }].map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11.5px] text-[#2f6f6d] underline decoration-[#b9d3cf] underline-offset-2" data-testid={`link-source-${info.id}`}>{s.label}<ExternalLink className="size-3" /></a>
              ))}
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-[calc(100%-2rem)]">
          <div className={`pointer-events-auto ${pill} max-w-full overflow-x-auto chip-scroll`} role="toolbar" aria-label="Landmarks">
            {LANDMARK_ORDER.map((id) => (
              <button key={id} aria-pressed={selected === id} onClick={() => focus(selected === id ? null : id)} data-testid={`chip-landmark-${id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f6f6d] ${selected === id ? "bg-[#2f6f6d] text-[#f6efe0]" : "hover:bg-white"}`}>
                <span className="size-2 rounded-full" style={{ background: LANDMARKS[id].color }} />{LANDMARKS[id].name}
              </button>
            ))}
          </div>
          <p className="pointer-events-auto text-center text-[10.5px] leading-snug text-[#7a6455]" data-testid="text-mars-attribution">
            Map: <a className="underline" href={TEXTURE_SOURCE_URL} target="_blank" rel="noreferrer">Solar System Scope</a>, CC BY 4.0, derived from NASA imagery; colour enhanced, some gaps filled. Smooth sphere, no relief.
          </p>
        </div>
      </div>
    </div>
  );
}

function Tool({ children, label, onClick, on, testid }: { children: ReactNode; label: string; onClick: () => void; on?: boolean; testid: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label} title={label} data-testid={testid}
      className={`grid place-items-center size-8 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f6f6d] ${on ? "bg-[#dfe9e4] text-[#24504e]" : "hover:bg-white"}`}>{children}</button>
  );
}
