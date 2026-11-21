export interface OutpostPad {
  id: string;
  x: number;
  z: number;
  flatRadius: number;
  blendRadius: number;
  baseHeight: number;
}

export interface OutpostCollider {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface TrackSample {
  x: number;
  y: number;
  z: number;
  headingRad: number;
  pitchRad: number;
  rollRad: number;
}

export const WORLD_PLAY_RADIUS = 50;
export const WORLD_EXTENT = 120;

export const OUTPOST_PADS: readonly OutpostPad[] = [
  { id: "habitat", x: 12.5, z: 6.5, flatRadius: 6.4, blendRadius: 11.5, baseHeight: 0.12 },
  { id: "biodome", x: -2.0, z: -26.0, flatRadius: 7.4, blendRadius: 13.5, baseHeight: 0.08 },
  { id: "solar", x: 7.2, z: -23.5, flatRadius: 4.5, blendRadius: 8.5, baseHeight: 0.1 },
  { id: "yard", x: -3.5, z: 10.5, flatRadius: 5.5, blendRadius: 11.0, baseHeight: 0.02 },
];

export const OUTPOST_COLLIDERS: readonly OutpostCollider[] = [
  { id: "habitat", x: 12.5, z: 6.5, radius: 5.8 },
  { id: "biodome", x: -2.0, z: -26.0, radius: 6.3 },
  { id: "solar", x: 7.2, z: -23.5, radius: 3.1 },
  { id: "rover1", x: -5.8, z: 9.2, radius: 2.1 },
];

/**
 * Closed patrol loop for Rover #2: starts on the main dual tracks near the
 * Habitat yard, drives north-northwest toward the Hydroponic Biodome, curves
 * around the east Solar Array, and returns along the outer dust track.
 */
export const ROVER_TRACK_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [3.4, 8.2],
  [0.2, 0.5],
  [-1.2, -10.0],
  [-3.8, -17.5],
  [2.5, -20.5],
  [10.2, -26.8],
  [4.0, -35.5],
  [-11.5, -33.0],
  [-13.5, -18.5],
  [-6.8, -4.5],
  [-1.6, 8.8],
  [3.8, 12.8],
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic Martian terrain heightfield in meters.
 * Flat graded aprons support structures cleanly without floating/sinking,
 * subtle dual-track ruts carve slightly along the main yard-to-biodome lane,
 * and undulating dunes rise into distant crater rim hills past r > 44m.
 */
export function marsHeightAt(x: number, z: number): number {
  // Multi-octave undulating Martian regolith dunes
  const dune1 = Math.sin(x * 0.075 + z * 0.045) * 0.42;
  const dune2 = Math.cos(x * 0.04 - z * 0.085 + 1.1) * 0.34;
  const ripple = Math.sin(x * 0.24 - z * 0.19) * 0.07;
  const craterDip = -0.65 * Math.exp(-((x + 21) ** 2 + (z + 18) ** 2) / 140);
  let h = dune1 + dune2 + ripple + craterDip;

  // Outer perimeter crater ridges rising naturally at distance
  const r = Math.hypot(x, z);
  if (r > 42) {
    const rimT = smoothstep(42, 95, r);
    const ridgeNoise =
      1.0 +
      0.42 * Math.sin(Math.atan2(z, x) * 5.0 + 0.6) +
      0.24 * Math.cos(Math.atan2(z, x) * 11.0 - 1.2);
    h += rimT * rimT * 10.5 * ridgeNoise;
  }

  // Blend smoothly toward graded outpost pads
  for (const pad of OUTPOST_PADS) {
    const d = Math.hypot(x - pad.x, z - pad.z);
    if (d < pad.blendRadius) {
      const k = 1 - smoothstep(pad.flatRadius, pad.blendRadius, d);
      h = h * (1 - k) + pad.baseHeight * k;
    }
  }

  // Subtle carved dual tire-track corridor from yard (-1.8, 16) toward biodome (-2.0, -18)
  if (z >= -20 && z <= 18) {
    const laneCenterX = -1.6 + Math.sin(z * 0.09) * 0.85;
    const laneBlend = smoothstep(-20, -15, z) * (1 - smoothstep(14, 18, z));
    const dxLeft = Math.abs(x - (laneCenterX - 0.82));
    const dxRight = Math.abs(x - (laneCenterX + 0.82));
    const rutL = Math.exp(-(dxLeft * dxLeft) / 0.11);
    const rutR = Math.exp(-(dxRight * dxRight) / 0.11);
    h -= (rutL + rutR) * 0.045 * laneBlend;
  }

  return h;
}

export function marsNormalAt(x: number, z: number, eps = 0.35): [number, number, number] {
  const hL = marsHeightAt(x - eps, z);
  const hR = marsHeightAt(x + eps, z);
  const hD = marsHeightAt(x, z - eps);
  const hU = marsHeightAt(x, z + eps);
  const nx = hL - hR;
  const ny = 2 * eps;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Samples a closed smooth loop position and terrain-aligned orientation for Patrol Rover #2.
 */
export function sampleRoverTrack(tNormalized: number): TrackSample {
  const pts = ROVER_TRACK_WAYPOINTS;
  const n = pts.length;
  const wrapped = ((tNormalized % 1) + 1) % 1;
  const scaled = wrapped * n;
  const i1 = Math.floor(scaled) % n;
  const frac = scaled - Math.floor(scaled);

  const i0 = (i1 - 1 + n) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;

  const x = catmullRom(pts[i0][0], pts[i1][0], pts[i2][0], pts[i3][0], frac);
  const z = catmullRom(pts[i0][1], pts[i1][1], pts[i2][1], pts[i3][1], frac);

  const dt = 0.004;
  const nextWrapped = ((wrapped + dt) % 1 + 1) % 1;
  const nextScaled = nextWrapped * n;
  const ni1 = Math.floor(nextScaled) % n;
  const nfrac = nextScaled - Math.floor(nextScaled);
  const ni0 = (ni1 - 1 + n) % n;
  const ni2 = (ni1 + 1) % n;
  const ni3 = (ni1 + 2) % n;

  const nx = catmullRom(pts[ni0][0], pts[ni1][0], pts[ni2][0], pts[ni3][0], nfrac);
  const nz = catmullRom(pts[ni0][1], pts[ni1][1], pts[ni2][1], pts[ni3][1], nfrac);

  const dx = nx - x;
  const dz = nz - z;
  const headingRad = Math.atan2(dx, dz);

  const y = marsHeightAt(x, z);
  const fwdDist = 1.1;
  const sideDist = 0.85;
  const fx = Math.sin(headingRad);
  const fz = Math.cos(headingRad);
  const rx = fz;
  const rz = -fx;

  const hFront = marsHeightAt(x + fx * fwdDist, z + fz * fwdDist);
  const hBack = marsHeightAt(x - fx * fwdDist, z - fz * fwdDist);
  const hRight = marsHeightAt(x + rx * sideDist, z + rz * sideDist);
  const hLeft = marsHeightAt(x - rx * sideDist, z - rz * sideDist);

  const pitchRad = Math.atan2(hBack - hFront, fwdDist * 2);
  const rollRad = Math.atan2(hLeft - hRight, sideDist * 2);

  return { x, y, z, headingRad, pitchRad, rollRad };
}

/**
 * Checks whether a world (x, z) point lies inside a cleared pad or rover track
 * so scattered volcanic boulders never spawn inside buildings or directly in front of doors.
 */
export function isClearedForOutpost(x: number, z: number): boolean {
  for (const pad of OUTPOST_PADS) {
    if (Math.hypot(x - pad.x, z - pad.z) < pad.flatRadius + 1.4) {
      return true;
    }
  }
  // Keep main rover track corridor free of large rocks
  for (let i = 0; i < 48; i++) {
    const s = sampleRoverTrack(i / 48);
    if (Math.hypot(x - s.x, z - s.z) < 2.3) {
      return true;
    }
  }
  // Keep direct foreground camera lane clear
  if (z > -20 && z < 20 && Math.abs(x + 1.5) < 2.8) {
    return true;
  }
  return false;
}

/**
 * Pushes free-roam camera targets out of dome/collider footprints and clamps
 * within the explorable crater basin.
 */
export function clampOutpostTarget(x: number, z: number, margin = 1.2): { x: number; z: number } {
  let cx = x;
  let cz = z;

  for (const col of OUTPOST_COLLIDERS) {
    const dx = cx - col.x;
    const dz = cz - col.z;
    const dist = Math.hypot(dx, dz);
    const minDist = col.radius + margin;
    if (dist < minDist) {
      if (dist < 0.001) {
        cx = col.x;
        cz = col.z + minDist;
      } else {
        const push = minDist / dist;
        cx = col.x + dx * push;
        cz = col.z + dz * push;
      }
    }
  }

  const radial = Math.hypot(cx, cz);
  if (radial > WORLD_PLAY_RADIUS) {
    const scale = WORLD_PLAY_RADIUS / radial;
    cx *= scale;
    cz *= scale;
  }

  return { x: cx, z: cz };
}
