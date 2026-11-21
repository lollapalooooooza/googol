import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { NeuronMode, NeuronPartId } from "./neuron-parts";

export interface NeuronCtx {
  mode: NeuronMode; selected: NeuronPartId | null; hovered: NeuronPartId | null;
  /** "show" renders normally, "ghost" renders a faint non-interactive silhouette, "none" removes the part. */
  visibility: (id: NeuronPartId) => "show" | "ghost" | "none";
  onSelect: (id: NeuronPartId) => void; onHover: (id: NeuronPartId | null) => void;
}

const Lit = createContext(false);
const Ghost = createContext(false);
type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SubCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private base: THREE.Curve<THREE.Vector3>, private a: number, private b: number) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) { return this.base.getPointAt(this.a + (this.b - this.a) * t, target); }
}

/** Swept tube with a radius profile and optional partial arc (for cutaways). */
function sweep(curve: THREE.Curve<V3>, segs: number, radial: number, rad: (t: number) => number, a0 = 0, arc = Math.PI * 2) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const up = V(), N = V(), B = V(), c = V();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curve.getPointAt(t, c); const T = curve.getTangentAt(t).normalize();
    up.set(0, 1, 0); if (Math.abs(T.dot(up)) > 0.95) up.set(1, 0, 0);
    N.crossVectors(T, up).normalize(); B.crossVectors(N, T).normalize();
    const r = rad(t);
    for (let j = 0; j <= radial; j++) {
      const a = a0 + (arc * j) / radial, ca = Math.cos(a), sa = Math.sin(a);
      const nx = ca * N.x + sa * B.x, ny = ca * N.y + sa * B.y, nz = ca * N.z + sa * B.z;
      pos.push(c.x + nx * r, c.y + ny * r, c.z + nz * r); nor.push(nx, ny, nz); uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function merge(list: THREE.BufferGeometry[]) {
  const m = mergeGeometries(list, false) ?? list[0];
  list.forEach((g) => { if (g !== m) g.dispose(); });
  return m;
}

function useDispose(items: (THREE.BufferGeometry | undefined)[]) {
  useEffect(() => () => items.forEach((g) => g?.dispose()), [items]);
}

function Mat({ color, rough = 0.55, clear = 0.2, side = THREE.FrontSide, sheen = 0.4 }: { color: string; rough?: number; clear?: number; side?: THREE.Side; sheen?: number }) {
  const lit = useContext(Lit), ghost = useContext(Ghost);
  return (
    <meshPhysicalMaterial color={color} roughness={rough} clearcoat={clear} clearcoatRoughness={0.4} sheen={sheen} sheenColor="#fff1e2" sheenRoughness={0.6}
      side={side} transparent={ghost} opacity={ghost ? 0.13 : 1} depthWrite={!ghost}
      emissive={color} emissiveIntensity={lit ? 0.32 : 0} />
  );
}

function Part({ id, ctx, children }: { id: NeuronPartId; ctx: NeuronCtx; children: ReactNode }) {
  const v = ctx.visibility(id);
  if (v === "none") return null;
  const ghost = v === "ghost";
  return (
    <group name={id}
      onClick={ghost ? undefined : (e) => { e.stopPropagation(); ctx.onSelect(id); }}
      onPointerOver={ghost ? undefined : (e) => { e.stopPropagation(); ctx.onHover(id); }}
      onPointerOut={ghost ? undefined : () => ctx.onHover(null)}>
      <Ghost.Provider value={ghost}>
        <Lit.Provider value={!ghost && (ctx.selected === id || ctx.hovered === id)}>{children}</Lit.Provider>
      </Ghost.Provider>
    </group>
  );
}

function Instanced({ items, color, r, rough = 0.5 }: { items: { p: V3; s: [number, number, number] }[]; color: string; r: number; rough?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    items.forEach((it, i) => { o.position.copy(it.p); o.scale.set(...it.s); o.updateMatrix(); ref.current?.setMatrixAt(i, o.matrix); });
    if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); }
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow>
      <sphereGeometry args={[r, 10, 8]} />
      <Mat color={color} rough={rough} />
    </instancedMesh>
  );
}

/* ---------------- Layout (local units; not to scale) ---------------- */
const SOMA = V(-4.4, 0, 0);
const SOMA_R = 1.02;
const AXON_PTS = [V(-2.5, 0, 0), V(-1, -0.14, 0.1), V(1, -0.05, -0.16), V(3, 0.14, 0), V(5, 0, 0.14), V(5.9, -0.08, 0.08)];
const AX_R = 0.11;
const MY_START = 0.065, MY_END = 0.935, INTERNODES = 6, GAP = 0.024;

function axonCurve() { return new THREE.CatmullRomCurve3(AXON_PTS, false, "centripetal"); }
function internodes() {
  const seg = (MY_END - MY_START - GAP * (INTERNODES - 1)) / INTERNODES;
  return Array.from({ length: INTERNODES }, (_, i) => { const a = MY_START + i * (seg + GAP); return [a, a + seg] as const; });
}

function grow(out: THREE.BufferGeometry[], r: () => number, start: V3, dir: V3, len: number, r0: number, depth: number, maxDepth: number,
  leaves: V3[] | null, spines: { p: V3; s: [number, number, number] }[] | null, floorY: number) {
  const pts = [start.clone()]; let p = start.clone(); const d = dir.clone().normalize();
  for (let k = 1; k <= 4; k++) {
    d.add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.42)).normalize();
    p = p.clone().addScaledVector(d, len / 4);
    if (p.y < floorY) { p.y = floorY + (r() * 0.1); d.y = Math.abs(d.y) * 0.3; d.normalize(); }
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const r1 = r0 * (depth === maxDepth ? 0.28 : 0.62);
  out.push(sweep(curve, 14, 8, (t) => r0 + (r1 - r0) * Math.pow(t, 0.8)));
  if (spines && depth >= 1) {
    const n = Math.round(len * 9);
    for (let s = 0; s < n; s++) {
      const t = 0.12 + r() * 0.85; const c = curve.getPointAt(t);
      const off = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(); const rr = r0 + (r1 - r0) * t;
      const k = 0.7 + r() * 0.6;
      spines.push({ p: c.addScaledVector(off, rr + 0.03), s: [k, k, k] });
    }
  }
  if (depth < maxDepth) {
    for (let k = 0; k < 2; k++) {
      const kd = d.clone().add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.25)).normalize();
      grow(out, r, p, kd, len * (0.62 + r() * 0.16), r1 * 0.92, depth + 1, maxDepth, leaves, spines, floorY);
    }
  } else if (leaves) leaves.push(p.clone().addScaledVector(d, 0.04));
}

/* ---------------- Parts ---------------- */
function Soma({ cut }: { cut: boolean }) {
  const nissl = useMemo(() => {
    const r = rng(41); const out: { p: V3; s: [number, number, number] }[] = [];
    for (let i = 0; i < 70; i++) {
      const R = SOMA_R * 0.94, ang = Math.PI / 2 + r() * Math.PI, rad = 0.5 + r() * (R - 0.55);
      const a = Math.cos(ang) * rad, b = Math.sin(ang) * rad;
      out.push({ p: i % 2 ? V(a, b, 0.012) : V(0.012, b, -Math.abs(a)), s: [1.4, 0.7, 1.4] });
    }
    return out;
  }, []);
  const phi = cut ? Math.PI * 1.5 : Math.PI * 2;
  return (
    <group position={SOMA} scale={[1.12, 0.94, 1]} rotation={[0, Math.PI - 0.49, 0]}>
      <mesh castShadow receiveShadow><sphereGeometry args={[SOMA_R, 64, 48, 0, phi]} /><Mat color="#b75a6c" rough={0.62} /></mesh>
      {cut && (
        <>
          <mesh><sphereGeometry args={[SOMA_R * 0.97, 48, 36, 0, phi]} /><Mat color="#7e3248" side={THREE.BackSide} rough={0.8} /></mesh>
          <mesh><circleGeometry args={[SOMA_R * 0.985, 56, Math.PI / 2, Math.PI]} /><Mat color="#e7b3ad" side={THREE.DoubleSide} rough={0.85} clear={0} /></mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[SOMA_R * 0.985, 56, -Math.PI / 2, Math.PI]} /><Mat color="#deaaa6" side={THREE.DoubleSide} rough={0.85} clear={0} /></mesh>
          <mesh position={[0, 0, 0.004]}><ringGeometry args={[SOMA_R * 0.9, SOMA_R, 56, 1, Math.PI / 2, Math.PI]} /><Mat color="#9a4258" side={THREE.DoubleSide} /></mesh>
          <Instanced items={nissl} r={0.035} color="#7a2c4c" rough={0.7} />
        </>
      )}
    </group>
  );
}

function Nucleus() {
  return (
    <group position={SOMA}>
      <mesh castShadow><sphereGeometry args={[0.42, 48, 32]} /><Mat color="#4e4f93" rough={0.45} clear={0.5} /></mesh>
      <mesh position={[0.12, 0.14, 0.24]}><sphereGeometry args={[0.15, 28, 20]} /><Mat color="#2c2a63" rough={0.35} clear={0.7} /></mesh>
    </group>
  );
}

function Dendrites() {
  const { geo, spines } = useMemo(() => {
    const r = rng(17); const out: THREE.BufferGeometry[] = []; const sp: { p: V3; s: [number, number, number] }[] = [];
    const dirs: [number, number, number, number, number][] = [
      [-0.35, 1, 0.1, 2.0, 0.27], [-1, 0.25, 0.15, 1.5, 0.21], [-0.75, -0.45, 0.5, 1.3, 0.19], [-0.5, -0.5, -0.7, 1.3, 0.18],
      [-0.8, 0.35, -0.75, 1.35, 0.18], [0.05, 0.55, 0.9, 1.2, 0.17], [0.15, -0.6, 0.85, 1.15, 0.16], [0.25, 0.7, -0.75, 1.1, 0.16],
    ];
    for (const [x, y, z, len, r0] of dirs) {
      const d = V(x, y, z).normalize();
      grow(out, r, SOMA.clone().addScaledVector(d, SOMA_R * 0.82), d, len, r0, 0, 2, null, sp, -1.85);
    }
    return { geo: merge(out), spines: sp };
  }, []);
  useDispose(useMemo(() => [geo], [geo]));
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow><Mat color="#cf8a86" rough={0.6} /></mesh>
      <Instanced items={spines} r={0.04} color="#e0a49a" rough={0.55} />
    </group>
  );
}

function Hillock() {
  const { lathe, initial } = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(AX_R + 0.36 * Math.pow(1 - t, 2.2), t)); }
    const c = axonCurve();
    return { lathe: new THREE.LatheGeometry(pts, 40), initial: sweep(new SubCurve(c, 0, MY_START), 12, 24, () => AX_R + 0.022) };
  }, []);
  useDispose(useMemo(() => [lathe, initial], [lathe, initial]));
  return (
    <group>
      <mesh geometry={lathe} position={[-3.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 0.94, 1]} castShadow><Mat color="#dc8a5a" rough={0.55} /></mesh>
      <mesh geometry={initial} castShadow><Mat color="#e39a6c" rough={0.5} /></mesh>
    </group>
  );
}

function Axon() {
  const geo = useMemo(() => sweep(axonCurve(), 220, 18, () => AX_R), []);
  useDispose(useMemo(() => [geo], [geo]));
  return <mesh geometry={geo} castShadow><Mat color="#7d4a72" rough={0.45} clear={0.4} /></mesh>;
}

const SS = THREE.MathUtils.smoothstep;
function sheathR(t: number, scale = 1) { return AX_R + 0.22 * scale * SS(t, 0, 0.12) * SS(1 - t, 0, 0.12) + 0.005; }

function Myelin({ cut }: { cut: boolean }) {
  const geos = useMemo(() => {
    const c = axonCurve();
    const full: THREE.BufferGeometry[] = [], open: THREE.BufferGeometry[] = [], inner: THREE.BufferGeometry[] = [];
    const bumps: { p: V3; s: [number, number, number] }[] = [];
    internodes().forEach(([a, b], i) => {
      const sc = new SubCurve(c, a, b);
      full.push(sweep(sc, 48, 28, (t) => sheathR(t)));
      open.push(sweep(sc, 48, 24, (t) => sheathR(t), Math.PI / 2, Math.PI * 1.5));
      for (const s of [0.72, 0.45]) inner.push(sweep(sc, 40, 22, (t) => sheathR(t, s), Math.PI / 2, Math.PI * 1.5));
      const mid = sc.getPointAt(0.35 + (i % 3) * 0.12);
      bumps.push({ p: mid.add(V(0, 0.3, -0.06)), s: [2.6, 0.75, 1.3] });
    });
    return { full: merge(full), open: merge(open), inner: merge(inner), bumps };
  }, []);
  useDispose(useMemo(() => [geos.full, geos.open, geos.inner], [geos]));
  return cut ? (
    <group>
      <mesh geometry={geos.open} castShadow><Mat color="#efe0b4" rough={0.42} clear={0.45} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geos.inner}><Mat color="#d9c08a" rough={0.5} side={THREE.DoubleSide} /></mesh>
    </group>
  ) : (
    <group>
      <mesh geometry={geos.full} castShadow receiveShadow><Mat color="#efe0b4" rough={0.42} clear={0.45} /></mesh>
      <Instanced items={geos.bumps} r={0.09} color="#c9ad74" rough={0.55} />
    </group>
  );
}

function Nodes() {
  const geo = useMemo(() => {
    const c = axonCurve(); const nodes = internodes(); const out: THREE.BufferGeometry[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i][1] - 0.003, b = nodes[i + 1][0] + 0.003;
      out.push(sweep(new SubCurve(c, a, b), 10, 24, (t) => AX_R + 0.035 + 0.02 * Math.sin(Math.PI * t)));
    }
    return merge(out);
  }, []);
  useDispose(useMemo(() => [geo], [geo]));
  return <mesh geometry={geo} castShadow><Mat color="#3f8e88" rough={0.38} clear={0.6} /></mesh>;
}

function Terminals() {
  const { geo, boutons } = useMemo(() => {
    const c = axonCurve(); const r = rng(73); const out: THREE.BufferGeometry[] = []; const leaves: V3[] = [];
    const end = c.getPointAt(1), tan = c.getTangentAt(1);
    out.push(sweep(new SubCurve(c, MY_END, 1), 10, 14, (t) => AX_R * (1 - 0.25 * t)));
    for (const [y, z] of [[0.7, 0.2], [-0.6, 0.35], [0.25, -0.75], [-0.2, 0.85]] as const) {
      grow(out, r, end, tan.clone().add(V(0, y, z)).normalize(), 0.95, 0.075, 0, 2, leaves, null, -1.85);
    }
    const bt = leaves.map((p) => { const k = 0.9 + r() * 0.35; return { p, s: [k * 1.15, k, k] as [number, number, number] }; });
    return { geo: merge(out), boutons: bt };
  }, []);
  useDispose(useMemo(() => [geo], [geo]));
  return (
    <group>
      <mesh geometry={geo} castShadow><Mat color="#b98a3c" rough={0.5} /></mesh>
      <Instanced items={boutons} r={0.12} color="#cf9a3a" rough={0.38} />
    </group>
  );
}

export function NeuronModel({ ctx, groupRef }: { ctx: NeuronCtx; groupRef: RefObject<THREE.Group | null> }) {
  const cut = ctx.mode === "cutaway";
  const somaCut = cut || ctx.selected === "nucleus" || ctx.visibility("soma") === "ghost";
  return (
    <group ref={groupRef} name="Neuron" position={[-0.3, 2.05, 0]}>
      <Part id="dendrites" ctx={ctx}><Dendrites /></Part>
      <Part id="soma" ctx={ctx}><Soma cut={somaCut} /></Part>
      <Part id="nucleus" ctx={ctx}><Nucleus /></Part>
      <Part id="hillock" ctx={ctx}><Hillock /></Part>
      <Part id="axon" ctx={ctx}><Axon /></Part>
      <Part id="myelin" ctx={ctx}><Myelin cut={cut} /></Part>
      <Part id="nodes" ctx={ctx}><Nodes /></Part>
      <Part id="terminals" ctx={ctx}><Terminals /></Part>
    </group>
  );
}
