import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { OrganelleId, ViewMode } from "./organelles";

const Lit = createContext(false);

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function contourPts(a: number, b: number, n = 120) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), p = 0.4;
    const w = 1 + 0.03 * Math.sin(3 * t + 0.7) + 0.022 * Math.sin(5 * t + 2.1) + 0.012 * Math.sin(9 * t + 0.4);
    pts.push(new THREE.Vector2(a * Math.sign(c) * Math.abs(c) ** p * w, b * Math.sign(sn) * Math.abs(sn) ** p * w));
  }
  return pts;
}

/** Organic, slightly lobed superellipse outline (the third arg is kept for call compatibility). */
function rr(w: number, h: number, _r?: number) {
  void _r;
  return new THREE.Shape(contourPts(w / 2, h / 2));
}

function contourCurve(w: number, h: number, y: number) {
  return new THREE.CatmullRomCurve3(contourPts(w / 2, h / 2, 90).map((p) => new THREE.Vector3(p.x, y, -p.y)), true);
}

let bumpTex: THREE.DataTexture | null = null;
function getBump() {
  if (bumpTex) return bumpTex;
  const N = 128, d = new Uint8Array(N * N * 4), r = rng(99);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0.5 + 0.22 * Math.sin(x * 0.35 + Math.sin(y * 0.21) * 2) * Math.cos(y * 0.31 + Math.sin(x * 0.17) * 2)
      + 0.12 * Math.sin((x + y) * 0.9) * Math.sin((x - y) * 0.7) + (r() - 0.5) * 0.3;
    v = Math.max(0, Math.min(1, v)) * 255;
    const k = (y * N + x) * 4; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
  }
  bumpTex = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(3, 3);
  bumpTex.needsUpdate = true;
  return bumpTex;
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.1) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 4, curveSegments: 32 });
}

function Mat({ color, rough = 0.62, opacity = 1, clear = 0.15, side = THREE.FrontSide, bump = 1.6 }: { color: string; rough?: number; opacity?: number; clear?: number; side?: THREE.Side; bump?: number }) {
  const lit = useContext(Lit);
  return (
    <meshPhysicalMaterial color={color} roughness={rough} clearcoat={clear} clearcoatRoughness={0.45} sheen={0.15} sheenColor="#fff6e0" bumpMap={bump > 0 ? getBump() : null} bumpScale={bump}
      transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} side={side}
      emissive={color} emissiveIntensity={lit ? 0.3 : 0} />
  );
}

export interface SceneCtx {
  mode: ViewMode; cross: boolean; reduced: boolean; selected: OrganelleId | null; hovered: OrganelleId | null;
  isVisible: (id: OrganelleId) => boolean; onSelect: (id: OrganelleId) => void; onHover: (id: OrganelleId | null) => void;
}

const LIFT: Record<OrganelleId, number> = { wall: 0, cytoplasm: 0, ribosome: 0.7, vacuole: 1.1, chloroplast: 1.7, mitochondrion: 2.1, golgi: 2.4, er: 2.8, nucleus: 3.7 };

function Part({ id, ctx, children }: { id: OrganelleId; ctx: SceneCtx; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const target = ctx.mode === "exploded" ? LIFT[id] : 0;
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.position.y = ctx.reduced ? target : THREE.MathUtils.damp(g.current.position.y, target, 4.5, dt);
  });
  if (!ctx.isVisible(id)) return null;
  return (
    <group ref={g} name={id}
      onClick={(e) => { e.stopPropagation(); ctx.onSelect(id); }}
      onPointerOver={(e) => { e.stopPropagation(); ctx.onHover(id); }}
      onPointerOut={() => ctx.onHover(null)}>
      <Lit.Provider value={ctx.selected === id || ctx.hovered === id}>{children}</Lit.Provider>
    </group>
  );
}

function Dots({ points, r, color }: { points: THREE.Vector3[]; r: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    points.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); ref.current?.setMatrixAt(i, m); });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} castShadow>
      <sphereGeometry args={[r, 8, 6]} />
      <Mat color={color} rough={0.7} clear={0} />
    </instancedMesh>
  );
}

/* ---------- Wall, membrane, cytoplasm ---------- */
function Wall({ ctx }: { ctx: SceneCtx }) {
  const geo = useMemo(() => {
    const outer = rr(11, 7.6, 1.7); outer.holes.push(rr(10, 6.6, 1.25));
    const mem = rr(10.02, 6.62, 1.25); mem.holes.push(rr(9.84, 6.44, 1.15));
    const lamella = rr(11.3, 7.9, 1.8); lamella.holes.push(rr(10.9, 7.5, 1.65));
    return {
      wall: extrude(outer, 1.55, 0.16), mem: extrude(mem, 1.3, 0.03), lam: extrude(lamella, 0.35, 0.08),
      floor: extrude(rr(10.6, 7.2, 1.45), 0.18, 0.06), lid: extrude(rr(11, 7.6, 1.7), 0.16, 0.12),
    };
  }, []);
  const pores = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (const x of [-3.2, -1, 1.2, 3.4]) { out.push([x, 0.95, 3.55, 0]); out.push([x + 0.6, 0.95, -3.55, 0]); }
    for (const z of [-1.4, 1.2]) { out.push([5.25, 0.95, z, Math.PI / 2]); out.push([-5.25, 0.95, z + 0.4, Math.PI / 2]); }
    return out;
  }, []);
  const ridges = useMemo(() => [
    new THREE.TubeGeometry(contourCurve(11.05, 7.65, 1.86), 240, 0.09, 8, true),
    new THREE.TubeGeometry(contourCurve(11.12, 7.72, 1.25), 240, 0.05, 6, true),
    new THREE.TubeGeometry(contourCurve(11.12, 7.72, 0.7), 240, 0.05, 6, true),
    new THREE.TubeGeometry(contourCurve(9.96, 6.58, 1.86), 240, 0.06, 8, true),
    new THREE.TubeGeometry(contourCurve(9.86, 6.48, 1.5), 240, 0.05, 8, true),
  ], []);
  return (
    <group>
      {ridges.map((g, i) => <mesh key={i} geometry={g} castShadow><Mat color={i < 3 ? "#7f9f2c" : i === 3 ? "#a6c050" : "#d2b844"} rough={0.75} bump={2} /></mesh>)}
      <mesh geometry={geo.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow><Mat color="#6a8a28" rough={0.8} clear={0.05} /></mesh>
      <mesh geometry={geo.lam} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} castShadow><Mat color="#557420" rough={0.85} clear={0.05} bump={2.4} /></mesh>
      <mesh geometry={geo.wall} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} castShadow receiveShadow><Mat color="#8fb236" rough={0.72} clear={0.12} bump={2.6} /></mesh>
      <mesh geometry={geo.mem} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}><Mat color="#d4bb3e" rough={0.55} /></mesh>
      {pores.map(([x, y, z, ry], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, ry]}>
          <cylinderGeometry args={[0.07, 0.07, 1.1, 10]} /><Mat color="#4a6418" rough={0.9} clear={0} />
        </mesh>
      ))}
      {!ctx.cross && (
        <group position={[0, 1.95, 0]}>
          <mesh geometry={geo.lid} rotation={[-Math.PI / 2, 0, 0]} castShadow><Mat color="#99b843" rough={0.75} clear={0.1} bump={2.6} /></mesh>
          {[0.9, 2.1, 3.1].map((s, i) => (
            <mesh key={i} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[s * 1.25, s * 0.85, 1]}>
              <torusGeometry args={[1, 0.025, 6, 64]} /><Mat color="#7c9a2c" rough={0.9} clear={0} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function Cytoplasm() {
  const { geo, filaments, vesicles } = useMemo(() => {
    const r = rng(7);
    const fil: THREE.TubeGeometry[] = [];
    for (let i = 0; i < 22; i++) {
      let x = (r() - 0.5) * 9, z = (r() - 0.5) * 5.8;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 6; k++) { pts.push(new THREE.Vector3(THREE.MathUtils.clamp(x, -4.7, 4.7), 1.13 + r() * 0.08, THREE.MathUtils.clamp(z, -3, 3))); x += (r() - 0.5) * 2.4; z += (r() - 0.5) * 1.8; }
      fil.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.022, 5));
    }
    const ves: { p: [number, number, number]; s: number; c: string }[] = [];
    const cols = ["#c065d8", "#4f7fe0", "#9b4fd0", "#e46f9a", "#3f6fd0"];
    for (let i = 0; i < 26; i++) ves.push({ p: [(r() - 0.5) * 9.2, 1.15, (r() - 0.5) * 6], s: 0.07 + r() * 0.1, c: cols[i % cols.length] });
    return { geo: extrude(rr(9.85, 6.45, 1.15), 0.82, 0.05), filaments: fil, vesicles: ves };
  }, []);
  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]} receiveShadow><Mat color="#2f8576" rough={0.35} opacity={0.72} clear={0.6} bump={0.6} /></mesh>
      {filaments.map((g, i) => <mesh key={i} geometry={g}><Mat color={i % 3 ? "#d49a3a" : "#e2b55a"} rough={0.6} clear={0} /></mesh>)}
      {vesicles.map((v, i) => <mesh key={i} position={v.p} scale={v.s} castShadow><sphereGeometry args={[1, 16, 12]} /><Mat color={v.c} /></mesh>)}
      <mesh position={[1.9, 1.15, 2.7]} scale={[0.32, 0.2, 0.24]} castShadow><sphereGeometry args={[1, 24, 16]} /><Mat color="#f08a1e" /></mesh>
    </group>
  );
}

/* ---------- Vacuole ---------- */
function Vacuole() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 72, 48); const pos = g.attributes.position; const v = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      const f = 1 + 0.07 * Math.sin(v.x * 3.1 + 0.6) * Math.cos(v.z * 2.7) + 0.04 * Math.sin(v.y * 4 + v.x * 2) - 0.12 * Math.max(0, -v.y) ** 3;
      v.multiplyScalar(f); pos.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  }, []);
  return (
    <group position={[-2.0, 1.25, -0.6]}>
      <mesh geometry={geo} scale={[1.95, 0.95, 1.5]} castShadow><Mat color="#4f8fd6" rough={0.38} clear={0.7} bump={1.2} /></mesh>
      <mesh geometry={geo} scale={[2.03, 1.0, 1.58]}><Mat color="#8fbf3a" rough={0.5} opacity={0.35} bump={0} /></mesh>
      <mesh scale={[2.08, 1, 1.62]} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}><torusGeometry args={[1, 0.09, 12, 96]} /><Mat color="#8fbf3a" /></mesh>
    </group>
  );
}

/* ---------- Nucleus + ER ---------- */
function Nucleus({ cut }: { cut: boolean }) {
  const { pores, chromatin } = useMemo(() => {
    const p: { pos: THREE.Vector3; q: THREE.Quaternion }[] = [];
    const n = 90, R = 1.2;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      const dir = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad);
      p.push({ pos: dir.clone().multiplyScalar(R), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir) });
    }
    const r = rng(3); const c: THREE.Vector3[] = [];
    for (let i = 0; i < 70; i++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.5 + r() * 0.45); c.push(v); }
    return { pores: p, chromatin: c };
  }, []);
  const phi = cut ? Math.PI * 1.5 : Math.PI * 2;
  const inRemoved = (v: THREE.Vector3) => cut && v.x < 0.02 && v.z < 0.02;
  return (
    <group position={[2.6, 1.55, -1.2]} rotation={[0, 2.17, 0]} scale={1.08}>
      <mesh castShadow><sphereGeometry args={[1.2, 64, 48, 0, phi]} /><Mat color="#8a4fd8" rough={0.6} bump={2.4} /></mesh>
      <mesh><sphereGeometry args={[1.17, 64, 48, 0, phi]} /><Mat color="#5a2aa8" side={THREE.BackSide} /></mesh>
      {cut && (
        <>
          <mesh><sphereGeometry args={[1.05, 48, 32, 0, phi]} /><Mat color="#b48af0" side={THREE.BackSide} rough={0.8} bump={2.6} /></mesh>
          <mesh><circleGeometry args={[1.18, 48, Math.PI / 2, Math.PI]} /><Mat color="#9b6be0" side={THREE.DoubleSide} rough={0.8} /></mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[1.18, 48, -Math.PI / 2, Math.PI]} /><Mat color="#9b6be0" side={THREE.DoubleSide} rough={0.8} /></mesh>
          <mesh position={[0, 0, 0.002]}><ringGeometry args={[1.05, 1.18, 48, 1, Math.PI / 2, Math.PI]} /><Mat color="#6a34c0" side={THREE.DoubleSide} /></mesh>
          <Dots points={chromatin.filter((v) => !(v.x < 0 && v.z < 0))} r={0.05} color="#4b1f96" />
        </>
      )}
      <mesh castShadow><sphereGeometry args={[0.42, 40, 28]} /><Mat color="#4a1c9c" rough={0.4} clear={0.6} bump={1.5} /></mesh>
      {pores.filter((p) => !inRemoved(p.pos)).map((p, i) => (
        <mesh key={i} position={p.pos} quaternion={p.q}><torusGeometry args={[0.06, 0.022, 6, 14]} /><Mat color="#5a2fb0" /></mesh>
      ))}
    </group>
  );
}

function ER() {
  const { tubes, ribos } = useMemo(() => {
    const t: THREE.TubeGeometry[] = []; const rib: THREE.Vector3[] = []; const r = rng(11);
    for (let i = 0; i < 6; i++) {
      for (const lift of [0, 0.11]) {
        const R = 1.32 + i * 0.12; const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 80; k++) {
          const a = 2.54 + (k / 80) * Math.PI * 1.5;
          const rad = R + 0.05 * Math.sin(a * 11 + i * 2);
          pts.push(new THREE.Vector3(Math.cos(a) * rad, (5 - i) * 0.05 + lift + 0.06 * Math.sin(a * 6 + i), Math.sin(a) * rad));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        t.push(new THREE.TubeGeometry(curve, 160, 0.055, 8));
        if (lift === 0 && i % 2 === 0) for (let k = 0; k < 40; k++) { const p = curve.getPoint(r()); p.y += 0.09; rib.push(p); }
      }
    }
    return { tubes: t, ribos: rib };
  }, []);
  return (
    <group position={[2.6, 0.98, -1.2]}>
      {tubes.map((g, i) => <mesh key={i} geometry={g} castShadow><Mat color={i % 2 ? "#9467e0" : "#7244c8"} /></mesh>)}
      <Dots points={ribos} r={0.035} color="#3e2c66" />
    </group>
  );
}

/* ---------- Golgi ---------- */
function Golgi() {
  const tubes = useMemo(() => {
    const out: THREE.TubeGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const R = 0.42 + i * 0.15; const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 40; k++) { const a = Math.PI * 0.1 + (k / 40) * Math.PI * 0.8; pts.push(new THREE.Vector3(Math.cos(a) * R, 0.03 * Math.sin(a * 8 + i), Math.sin(a) * R)); }
      out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.065, 10));
    }
    return out;
  }, []);
  const ends = useMemo(() => tubes.map((_, i) => {
    const R = 0.42 + i * 0.15;
    return [[Math.cos(Math.PI * 0.1) * R, 0, Math.sin(Math.PI * 0.1) * R], [Math.cos(Math.PI * 0.9) * R, 0, Math.sin(Math.PI * 0.9) * R]] as [number, number, number][];
  }), [tubes]);
  return (
    <group position={[0.7, 1.12, 1.15]}>
      <group scale={[1, 2.2, 1]}>
        {tubes.map((g, i) => <mesh key={i} geometry={g} castShadow><Mat color={i % 2 ? "#f07a55" : "#e0573a"} /></mesh>)}
        {ends.flat().map((p, i) => <mesh key={i} position={p} scale={[0.11, 0.07, 0.11]}><sphereGeometry args={[1, 14, 10]} /><Mat color="#f58a64" /></mesh>)}
      </group>
      {[[-0.2, 0.15, 1.35], [0.4, 0.12, 1.32], [1.1, 0.14, 0.9], [-1.15, 0.12, 0.75], [0.8, 0.1, 1.5]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow><sphereGeometry args={[0.08 + (i % 2) * 0.03, 14, 10]} /><Mat color="#f47b58" /></mesh>
      ))}
    </group>
  );
}

/* ---------- Pods: chloroplasts + mitochondria ---------- */
function Pod({ scale, outer, inner, cut, children }: { scale: [number, number, number]; outer: string; inner: string; cut: boolean; children?: ReactNode }) {
  const ts = cut ? Math.PI * 0.42 : 0, tl = cut ? Math.PI * 0.58 : Math.PI;
  return (
    <group>
      <mesh scale={scale} castShadow><sphereGeometry args={[1, 48, 28, 0, Math.PI * 2, ts, tl]} /><Mat color={outer} /></mesh>
      <mesh scale={[scale[0] * 0.94, scale[1] * 0.9, scale[2] * 0.9]}><sphereGeometry args={[1, 48, 28, 0, Math.PI * 2, ts, tl]} /><Mat color={inner} side={THREE.BackSide} rough={0.75} /></mesh>
      {cut && <mesh position={[0, Math.cos(ts) * scale[1], 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[scale[0] * Math.sin(ts), scale[2] * Math.sin(ts), 1]}><ringGeometry args={[0.92, 1, 48]} /><Mat color={outer} side={THREE.DoubleSide} /></mesh>}
      {cut && children}
    </group>
  );
}

function Chloroplast({ cut }: { cut: boolean }) {
  return (
    <Pod scale={[1, 0.36, 0.55]} outer="#5fa832" inner="#b8e070" cut={cut}>
      {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
        <group key={x} position={[x, -0.12, 0]}>
          {[0, 1, 2, 3, 4].map((k) => <mesh key={k} position={[0, k * 0.05, 0]}><cylinderGeometry args={[0.12, 0.12, 0.032, 18]} /><Mat color={k % 2 ? "#236e1f" : "#38922c"} /></mesh>)}
        </group>
      ))}
      {[-0.03, 0.07].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.35, 0.014, 0.05]} /><Mat color="#3f8a2a" /></mesh>)}
    </Pod>
  );
}

function Mito({ cut }: { cut: boolean }) {
  return (
    <Pod scale={[0.78, 0.3, 0.36]} outer="#f07a24" inner="#ffc070" cut={cut}>
      {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((x, i) => (
        <mesh key={x} position={[x, -0.04, i % 2 ? 0.07 : -0.07]}><boxGeometry args={[0.045, 0.2, 0.42 - Math.abs(x) * 0.35]} /><Mat color="#c84f12" /></mesh>
      ))}
    </Pod>
  );
}

const CHLORO: [number, number, number][] = [[-4.25, -1.9, 0.5], [-4.2, 1.6, -0.4], [-2.2, 2.4, 0.05], [2.9, 2.5, -0.1], [-0.45, -2.75, 0]];
const MITO: [number, number, number][] = [[4.5, 0.9, Math.PI / 2], [-3.0, -2.75, 0], [-0.55, 2.75, 0.2]];

export function PlantCellModel({ ctx, groupRef }: { ctx: SceneCtx; groupRef: RefObject<THREE.Group | null> }) {
  const ribosomes = useMemo(() => {
    const r = rng(21); const out: THREE.Vector3[] = [];
    for (let i = 0; i < 340; i++) out.push(new THREE.Vector3((r() - 0.5) * 9.4, 1.08 + r() * 0.1, (r() - 0.5) * 6.1));
    return out;
  }, []);
  return (
    <group ref={groupRef} name="PlantCell">
      <Part id="wall" ctx={ctx}><Wall ctx={ctx} /></Part>
      <Part id="cytoplasm" ctx={ctx}><Cytoplasm /></Part>
      <Part id="ribosome" ctx={ctx}><Dots points={ribosomes} r={0.035} color="#3a2860" /></Part>
      <Part id="vacuole" ctx={ctx}><Vacuole /></Part>
      <Part id="nucleus" ctx={ctx}><Nucleus cut={ctx.cross} /></Part>
      <Part id="er" ctx={ctx}><ER /></Part>
      <Part id="golgi" ctx={ctx}><Golgi /></Part>
      <Part id="chloroplast" ctx={ctx}>
        {CHLORO.map(([x, z, ry]) => <group key={`${x}${z}`} position={[x, 1.12, z]} rotation={[0, ry, 0]}><Chloroplast cut={ctx.cross} /></group>)}
      </Part>
      <Part id="mitochondrion" ctx={ctx}>
        {MITO.map(([x, z, ry]) => <group key={`${x}${z}`} position={[x, 1.1, z]} rotation={[0, ry, 0]}><Mito cut={ctx.cross} /></group>)}
      </Part>
    </group>
  );
}
