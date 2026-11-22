/**
 * Pure Calibrated Optical Camera, Archival Plate Geometry & 4-Beat Walkthrough Math
 * ported faithfully from https://github.com/lollapalooooooza/Eiffel-Tower
 * (`data/catalog/photo_cameras_3d.json`, `portals/photo_portals.js`,
 * `camera/optical_camera_rig.js`, `story/walkthrough_pacing.js`).
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface CalibratedPhotoCamera {
  id: string;
  stopIndex: number;
  step: number;
  imageSize: [number, number];
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fovYDeg: number;
  viewOffset: {
    fullWidth: number;
    fullHeight: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  };
  near: number;
  far: number;
}

export interface PlateRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanonicalOpticalState {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  tanHalfY: number;
  shiftX: number;
  shiftY: number;
  focalPoint: [number, number, number];
  near: number;
  far: number;
  rect: PlateRect | null;
}

export type WalkthroughBeat =
  | "hold_d"
  | "beat_a_yield"
  | "beat_b_flight"
  | "beat_c_lock"
  | "finale_orbit";

export interface WalkthroughStopConfig {
  stopIndex: number; // 1..12
  photoId: string | null;
  step: number;
  flightDurationSec: number; // Duration of Beat B from this stop -> next stop
  holdDurationSec: number;
}

export const HERO_FINALE_CAMERA = {
  position: [-140, 128, 420] as [number, number, number],
  target: [0, 134, 0] as [number, number, number],
  fovYDeg: 40,
};

/**
 * All 11 PnP-calibrated archival glass-plate cameras from `photo_cameras_3d.json`,
 * keyed by normalized 2-digit photo ID.
 */
export const CALIBRATED_PHOTO_CAMERAS: Record<string, CalibratedPhotoCamera> = {
  "55": {
    id: "55",
    stopIndex: 1,
    step: 11.0,
    imageSize: [1517, 2896],
    position: [0, 156, 3600],
    quaternion: [0, 0, 0, 1],
    fovYDeg: 8.26416513,
    viewOffset: {
      fullWidth: 4000,
      fullHeight: 4000,
      offsetX: 1222.5,
      offsetY: 450.4426,
      width: 1517,
      height: 2896,
    },
    near: 600,
    far: 6500,
  },
  "13": {
    id: "13",
    stopIndex: 2,
    step: 0.55,
    imageSize: [5441.597, 3341.968],
    position: [-47.1426, 3.9513, -30.2702],
    quaternion: [-0.040226, 0.1198457, 0.0293848, 0.9915419],
    fovYDeg: 41.44314,
    viewOffset: {
      fullWidth: 5441.597,
      fullHeight: 3341.968,
      offsetX: 431.4685,
      offsetY: -269.266,
      width: 5441.597,
      height: 3341.968,
    },
    near: 0.45,
    far: 4500,
  },
  "09": {
    id: "09",
    stopIndex: 3,
    step: 1.5,
    imageSize: [5390, 3882.201],
    position: [-64.8924, 3.3511, 33.2911],
    quaternion: [0.0431081, -0.9456443, 0.0995327, 0.3065809],
    fovYDeg: 52.81052,
    viewOffset: {
      fullWidth: 5390,
      fullHeight: 3882.201,
      offsetX: -388.11,
      offsetY: 478.1492,
      width: 5390,
      height: 3882.201,
    },
    near: 0.45,
    far: 4500,
  },
  "51": {
    id: "51",
    stopIndex: 4,
    step: 3.55,
    imageSize: [5390.222, 3877.829],
    position: [-26.9746, 49.6649, 27.1967],
    quaternion: [-0.0463295, -0.3715932, -0.0314903, 0.9267041],
    fovYDeg: 28.20473,
    viewOffset: {
      fullWidth: 5390.222,
      fullHeight: 3877.829,
      offsetX: -288.319,
      offsetY: 34.754,
      width: 5390.222,
      height: 3877.829,
    },
    near: 18.6,
    far: 4500,
  },
  "23": {
    id: "23",
    stopIndex: 5,
    step: 3.6,
    imageSize: [3669, 2307.433],
    position: [19.6142, 4.4408, 405.8668],
    quaternion: [-0.0470153, 0.0114059, 0.0015337, 0.9988279],
    fovYDeg: 11.26925,
    viewOffset: {
      fullWidth: 3669,
      fullHeight: 2307.433,
      offsetX: -326.36,
      offsetY: -2239.7878,
      width: 3669,
      height: 2307.433,
    },
    near: 0.45,
    far: 4500,
  },
  "14": {
    id: "14",
    stopIndex: 6,
    step: 4.85,
    imageSize: [2721, 2205.108],
    position: [4.0028, 9.9426, 363.2111],
    quaternion: [-0.0468198, 0.0078928, 0.0011598, 0.9988715],
    fovYDeg: 18.63744,
    viewOffset: {
      fullWidth: 2721,
      fullHeight: 2205.108,
      offsetX: 1.46,
      offsetY: -1277.5318,
      width: 2721,
      height: 2205.108,
    },
    near: 0.45,
    far: 4500,
  },
  "01": {
    id: "01",
    stopIndex: 7,
    step: 5.66,
    imageSize: [2533.054, 3401.905],
    position: [-1.2296, 6.9639, 256.962],
    quaternion: [0.1029039, 0.0036629, -0.000585, 0.9946844],
    fovYDeg: 39.10553,
    viewOffset: {
      fullWidth: 2533.054,
      fullHeight: 3401.905,
      offsetX: 86.4594,
      offsetY: -270.81,
      width: 2533.054,
      height: 3401.905,
    },
    near: 0.45,
    far: 4500,
  },
  "46": {
    id: "46",
    stopIndex: 8,
    step: 6.52,
    imageSize: [2524.054, 3048.067],
    position: [0.0267, 4.4632, 265.1589],
    quaternion: [0.208793, 0.0013738, -0.0002732, 0.9779589],
    fovYDeg: 44.62086,
    viewOffset: {
      fullWidth: 2524.054,
      fullHeight: 3048.067,
      offsetX: 7.7231,
      offsetY: 198.0068,
      width: 2524.054,
      height: 3048.067,
    },
    near: 0.45,
    far: 4500,
  },
  "18": {
    id: "18",
    stopIndex: 9,
    step: 11.0,
    imageSize: [2925.741, 3987.47],
    position: [-3.3263, 0.8, 539.9811],
    quaternion: [0.1463351, -0.0034924, 0.0002574, 0.9892289],
    fovYDeg: 32.07993,
    viewOffset: {
      fullWidth: 2925.741,
      fullHeight: 3987.47,
      offsetX: -88.7722,
      offsetY: 363.555,
      width: 2925.741,
      height: 3987.47,
    },
    near: 0.45,
    far: 4500,
  },
  "36": {
    id: "36",
    stopIndex: 10,
    step: 11.0,
    imageSize: [1600, 1256],
    position: [0.5518, 2.8, -63.7114],
    quaternion: [-0.0041034, 0.9986933, -0.0019274, -0.0509027],
    fovYDeg: 41.24108,
    viewOffset: {
      fullWidth: 1600,
      fullHeight: 1256,
      offsetX: 158.31,
      offsetY: -192.545,
      width: 1600,
      height: 1256,
    },
    near: 0.45,
    far: 4500,
  },
  "38": {
    id: "38",
    stopIndex: 11,
    step: 11.0,
    imageSize: [1600, 1204],
    position: [-1.5613, 2.8, -28.4935],
    quaternion: [0.0041009, 0.9997462, 0.0046419, -0.0216608],
    fovYDeg: 50.78535,
    viewOffset: {
      fullWidth: 1600,
      fullHeight: 1204,
      offsetX: -71.793,
      offsetY: -175.96,
      width: 1600,
      height: 1204,
    },
    near: 0.45,
    far: 4500,
  },
};

/**
 * 30% faster post-center chronological walkthrough speed (`1.3x`) while preserving
 * exact C1 easing curves and optical camera endpoint registration.
 */
export const WALKTHROUGH_SPEED_MULTIPLIER = 1.3;

function scaleWalkthroughSec(baseSec: number): number {
  return baseSec <= 0 ? 0 : Number((baseSec / WALKTHROUGH_SPEED_MULTIPLIER).toFixed(2));
}

/**
 * Exact chronological 12-stop exhibition schedule matching the user's video
 * & original repo (`WALKTHROUGH_STOPS` + `walkthrough_pacing.js`), accelerated 30% for crisp flow.
 */
export const WALKTHROUGH_SCHEDULE: readonly WalkthroughStopConfig[] = [
  { stopIndex: 1, photoId: "55", step: 11.0, flightDurationSec: scaleWalkthroughSec(8.8), holdDurationSec: 0.32 },
  { stopIndex: 2, photoId: "13", step: 0.55, flightDurationSec: scaleWalkthroughSec(7.4), holdDurationSec: scaleWalkthroughSec(3.1) },
  { stopIndex: 3, photoId: "09", step: 1.5, flightDurationSec: scaleWalkthroughSec(7.2), holdDurationSec: scaleWalkthroughSec(3.1) },
  { stopIndex: 4, photoId: "51", step: 3.55, flightDurationSec: scaleWalkthroughSec(6.4), holdDurationSec: scaleWalkthroughSec(3.0) },
  { stopIndex: 5, photoId: "23", step: 3.6, flightDurationSec: scaleWalkthroughSec(6.4), holdDurationSec: scaleWalkthroughSec(3.0) },
  { stopIndex: 6, photoId: "14", step: 4.85, flightDurationSec: scaleWalkthroughSec(6.0), holdDurationSec: scaleWalkthroughSec(3.0) },
  { stopIndex: 7, photoId: "01", step: 5.66, flightDurationSec: scaleWalkthroughSec(5.8), holdDurationSec: scaleWalkthroughSec(3.0) },
  { stopIndex: 8, photoId: "46", step: 6.52, flightDurationSec: scaleWalkthroughSec(7.8), holdDurationSec: scaleWalkthroughSec(3.0) },
  { stopIndex: 9, photoId: "18", step: 11.0, flightDurationSec: scaleWalkthroughSec(6.8), holdDurationSec: scaleWalkthroughSec(3.1) },
  { stopIndex: 10, photoId: "36", step: 11.0, flightDurationSec: scaleWalkthroughSec(4.2), holdDurationSec: scaleWalkthroughSec(3.0) },
  { stopIndex: 11, photoId: "38", step: 11.0, flightDurationSec: scaleWalkthroughSec(5.2), holdDurationSec: scaleWalkthroughSec(3.0) },
  { stopIndex: 12, photoId: null, step: 11.0, flightDurationSec: scaleWalkthroughSec(4.8), holdDurationSec: 0 },
];

export const BEAT_A_YIELD_SEC = scaleWalkthroughSec(0.85);
export const BEAT_C_LOCK_SEC = scaleWalkthroughSec(0.95);

export function getStopConfig(stopIndex: number): WalkthroughStopConfig {
  const idx = Math.max(1, Math.min(WALKTHROUGH_SCHEDULE.length, Math.round(stopIndex))) - 1;
  return WALKTHROUGH_SCHEDULE[idx];
}

export function getArchivalPhotoUrl(photoId: string | null): string | null {
  if (!photoId) return null;
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  if (photoId === "55") {
    return `${prefix}eiffel-thumbs/55_elevation_plate.jpg`;
  }
  return `${prefix}eiffel-photos/${photoId}.jpg`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstepCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function smoothstepQuintic(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Exact C¹ construction easing curve from `walkthrough_pacing.js` (`easeConstructionBeatB`).
 */
export function easeConstructionBeatB(u: number): number {
  const x = clamp(u, 0, 1);
  if (x <= 0 || x >= 1) return x;
  const collar = 0.12;
  const m = 1.0 / (1.0 - collar);
  let ramp: number;
  if (x < collar) {
    ramp = (m * x * x) / (2.0 * collar);
  } else if (x > 1.0 - collar) {
    const dx = 1.0 - x;
    ramp = 1.0 - (m * dx * dx) / (2.0 * collar);
  } else {
    ramp = m * (x - 0.5 * collar);
  }
  return clamp(0.74 * ramp + 0.26 * smoothstepCubic(x), 0, 1);
}

/**
 * Exact centered glass-plate rectangle inside the exhibition stage `(stageW, stageH)`,
 * ported from `_computeCenteredPlateRect` in `portals/photo_portals.js`.
 * Using the stage's own width & height guarantees 1:1 pixel registration with the WebGL canvas!
 */
export function computeArchivalPlateRect(
  photoId: string,
  stageW: number,
  stageH: number,
): PlateRect {
  const cam = CALIBRATED_PHOTO_CAMERAS[photoId] ?? CALIBRATED_PHOTO_CAMERAS["55"];
  const [imgW, imgH] = cam.imageSize;
  const W = Math.max(1, stageW);
  const H = Math.max(1, stageH);
  const imgAspect = imgW / imgH;

  if (W <= 768) {
    const topClear = 52;
    const bottomReserved = Math.min(H * 0.28, 220);
    const availH = Math.max(180, H - topClear - bottomReserved);
    const maxW = W * 0.92;
    const maxH = availH;
    let w = maxW;
    let h = w / imgAspect;
    if (h > maxH) {
      h = maxH;
      w = h * imgAspect;
    }
    return {
      x: (W - w) * 0.5,
      y: topClear + (availH - h) * 0.38,
      w,
      h,
    };
  }

  const maxW = W * 0.83;
  const maxH = H * 0.77;
  let w = maxW;
  let h = w / imgAspect;
  if (h > maxH) {
    h = maxH;
    w = h * imgAspect;
  }
  const x = (W - w) * 0.5;
  const y = Math.max(46, (H - h - 24) * 0.43);
  return { x, y, w, h };
}

function normalizeQuat(q: [number, number, number, number]): [number, number, number, number] {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function applyQuatToVec(
  v: [number, number, number],
  q: [number, number, number, number],
): [number, number, number] {
  const [vx, vy, vz] = v;
  const [qx, qy, qz, qw] = q;
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function computeRayTowerAnchorDistance(
  pos: [number, number, number],
  rayDir: [number, number, number],
): number {
  const denom = rayDir[0] * rayDir[0] + rayDir[2] * rayDir[2];
  if (denom < 1e-6) return Math.max(25, Math.hypot(pos[0], pos[2]));
  const lambda = -(pos[0] * rayDir[0] + pos[2] * rayDir[2]) / denom;
  if (lambda > 8 && lambda < 4800) return lambda;
  return Math.max(25, Math.hypot(pos[0], pos[2]));
}

/**
 * Converts a PnP-calibrated photo camera + viewport dimensions `(stageW, stageH)` into
 * the exact canonical optical state (`position`, `quaternion`, `tanHalfY`, `shiftX`, `shiftY`)
 * so that the 3D Eiffel Tower projects pixel-for-pixel inside `computeArchivalPlateRect(...)`.
 */
export function computePortalCanonicalCamera(
  photoId: string,
  stageW: number,
  stageH: number,
): CanonicalOpticalState {
  const cam = CALIBRATED_PHOTO_CAMERAS[photoId] ?? CALIBRATED_PHOTO_CAMERAS["55"];
  const W = Math.max(1, stageW);
  const H = Math.max(1, stageH);
  const aspect = W / H;
  const rect = computeArchivalPlateRect(cam.id, W, H);
  const vo = cam.viewOffset;
  const s = vo.width / Math.max(1e-6, rect.w);

  const offsetX = vo.offsetX - rect.x * s;
  const offsetY = vo.offsetY - rect.y * s;
  const subWidth = W * s;
  const subHeight = H * s;

  const tanHalfY =
    Math.tan(cam.fovYDeg * 0.5 * DEG2RAD) * (subHeight / Math.max(1e-6, vo.fullHeight));
  const tanHalfX = tanHalfY * aspect;
  const shiftX = (2.0 * offsetX + subWidth - vo.fullWidth) / Math.max(1e-6, subWidth);
  const shiftY = (vo.fullHeight - 2.0 * offsetY - subHeight) / Math.max(1e-6, subHeight);

  const quat = normalizeQuat(cam.quaternion);
  const localRayLen = Math.hypot(shiftX * tanHalfX, shiftY * tanHalfY, 1.0) || 1;
  const localRay: [number, number, number] = [
    (shiftX * tanHalfX) / localRayLen,
    (shiftY * tanHalfY) / localRayLen,
    -1.0 / localRayLen,
  ];
  const worldRay = applyQuatToVec(localRay, quat);
  const lambda = computeRayTowerAnchorDistance(cam.position, worldRay);
  const focalPoint: [number, number, number] = [
    cam.position[0] + worldRay[0] * lambda,
    cam.position[1] + worldRay[1] * lambda,
    cam.position[2] + worldRay[2] * lambda,
  ];

  return {
    position: [...cam.position],
    quaternion: quat,
    tanHalfY,
    shiftX,
    shiftY,
    focalPoint,
    near: cam.near,
    far: cam.far,
    rect,
  };
}

/**
 * Builds a canonical symmetric pinhole camera state for a free 3D `(position, target, fovYDeg)` pose
 * (e.g. Stop 12 Hero Finale).
 */
export function computeFreeCanonicalCamera(
  position: [number, number, number],
  target: [number, number, number],
  fovYDeg: number,
): CanonicalOpticalState {
  const safeFov = clamp(fovYDeg, 12, 120);
  const tanHalfY = Math.tan(safeFov * 0.5 * DEG2RAD);

  // Build standard right-handed camera lookAt basis (Z points from target -> eye)
  let zx = position[0] - target[0];
  let zy = position[1] - target[1];
  let zz = position[2] - target[2];
  const zLen = Math.hypot(zx, zy, zz) || 1;
  zx /= zLen;
  zy /= zLen;
  zz /= zLen;

  // X = normalize(up x Z) with up = (0, 1, 0)
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xLen = Math.hypot(xx, xy, xz);
  if (xLen < 1e-6) {
    xx = 1;
    xy = 0;
    xz = 0;
  } else {
    xx /= xLen;
    xy /= xLen;
    xz /= xLen;
  }

  // Y = Z x X
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  // Convert 3x3 rotation matrix [X, Y, Z] columns to unit quaternion
  const trace = xx + yy + zz;
  let qx: number, qy: number, qz: number, qw: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    qw = 0.25 * s;
    qx = (yz - zy) / s;
    qy = (zx - xz) / s;
    qz = (xy - yx) / s;
  } else if (xx > yy && xx > zz) {
    const s = Math.sqrt(1.0 + xx - yy - zz) * 2;
    qw = (yz - zy) / s;
    qx = 0.25 * s;
    qy = (yx + xy) / s;
    qz = (zx + xz) / s;
  } else if (yy > zz) {
    const s = Math.sqrt(1.0 + yy - xx - zz) * 2;
    qw = (zx - xz) / s;
    qx = (yx + xy) / s;
    qy = 0.25 * s;
    qz = (zy + yz) / s;
  } else {
    const s = Math.sqrt(1.0 + zz - xx - yy) * 2;
    qw = (xy - yx) / s;
    qx = (zx + xz) / s;
    qy = (zy + yz) / s;
    qz = 0.25 * s;
  }

  return {
    position: [...position],
    quaternion: normalizeQuat([qx, qy, qz, qw]),
    tanHalfY,
    shiftX: 0,
    shiftY: 0,
    focalPoint: [...target],
    near: 0.45,
    far: 4500,
    rect: null,
  };
}

export function computeStopCanonicalCamera(
  stopIndex: number,
  stageW: number,
  stageH: number,
): CanonicalOpticalState {
  const stop = getStopConfig(stopIndex);
  if (stop.photoId) {
    return computePortalCanonicalCamera(stop.photoId, stageW, stageH);
  }
  return computeFreeCanonicalCamera(
    HERO_FINALE_CAMERA.position,
    HERO_FINALE_CAMERA.target,
    HERO_FINALE_CAMERA.fovYDeg,
  );
}

function slerpQuat(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  let [ax, ay, az, aw] = a;
  let [bx, by, bz, bw] = b;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (dot > 0.9995) {
    return normalizeQuat([
      lerp(ax, bx, t),
      lerp(ay, by, t),
      lerp(az, bz, t),
      lerp(aw, bw, t),
    ]);
  }
  const theta0 = Math.acos(clamp(dot, -1, 1));
  const sinTheta0 = Math.sin(theta0);
  const theta = theta0 * t;
  const s0 = Math.sin(theta0 - theta) / sinTheta0;
  const s1 = Math.sin(theta) / sinTheta0;
  return normalizeQuat([
    ax * s0 + bx * s1,
    ay * s0 + by * s1,
    az * s0 + bz * s1,
    aw * s0 + bw * s1,
  ]);
}

/**
 * Evaluates a smooth Beat-B optical camera flight between two canonical stops (`u` in `[0, 1]`).
 * Uses the exact original repo's axial Champ-de-Mars dive for Stop 1 `#55` <-> Stop 2 `#13`,
 * log-radial telephoto dolly-zoom for extreme telephoto transitions, and smooth tower-cleared
 * polar sweeps for cross-axis foundation / parvis hops.
 */
export function interpolateCanonicalFlight(
  from: CanonicalOpticalState,
  to: CanonicalOpticalState,
  uRaw: number,
  options: { fromPhotoId?: string | null; toPhotoId?: string | null } = {},
): CanonicalOpticalState {
  const u = clamp(uRaw, 0, 1);
  if (u <= 0) return { ...from, position: [...from.position], quaternion: [...from.quaternion], focalPoint: [...from.focalPoint] };
  if (u >= 1) return { ...to, position: [...to.position], quaternion: [...to.quaternion], focalPoint: [...to.focalPoint] };

  const e = smoothstepQuintic(u);
  const rStartXZ = Math.hypot(from.position[0], from.position[2]);
  const rEndXZ = Math.hypot(to.position[0], to.position[2]);

  const isTeleAxialDive =
    (options.fromPhotoId === "55" && options.toPhotoId === "13") ||
    (options.fromPhotoId === "13" && options.toPhotoId === "55") ||
    (Math.max(rStartXZ, rEndXZ) > 1500 && Math.min(rStartXZ, rEndXZ) < 120);

  let pos: [number, number, number];

  if (isTeleAxialDive) {
    // Exact axial Champ-de-Mars dive from `optical_camera_rig.js` (`isTelephotoAxialFoundations`)
    const fromTele = rStartXZ >= rEndXZ;
    const pTele = fromTele ? from.position : to.position;
    const pNear = fromTele ? to.position : from.position;
    const t = fromTele ? e : 1.0 - e;
    const om = 1.0 - t;
    const zShift = 68.0;
    const zNow =
      (pTele[2] + zShift) * Math.pow((pNear[2] + zShift) / (pTele[2] + zShift), t) - zShift;
    const xNow = lerp(pTele[0], pNear[0], t * t * t * t);
    const yNow =
      om * om * om * pTele[1] +
      3.0 * om * om * t * 128.0 +
      3.0 * om * t * t * 18.0 +
      t * t * t * pNear[1];
    pos = [xNow, yNow, zNow];
  } else {
    const thetaA = Math.atan2(from.position[0], from.position[2]);
    const thetaB = Math.atan2(to.position[0], to.position[2]);
    let dTheta = thetaB - thetaA;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;

    if (Math.abs(dTheta) > 0.45 && Math.min(rStartXZ, rEndXZ) > 15) {
      // Cylindrical polar arc around the Tower so cross-axis hops (#13->#09, #18->#36) swing cleanly outside the piers
      const rLog = Math.pow(Math.max(15, rStartXZ), 1 - e) * Math.pow(Math.max(15, rEndXZ), e);
      const minArcLift = Math.abs(dTheta) > 1.2 ? 18 * Math.sin(Math.PI * e) : 0;
      const rNow = rLog + minArcLift;
      const thNow = thetaA + dTheta * e;
      const yLift = Math.abs(dTheta) > 1.2 ? 14 * Math.sin(Math.PI * e) : 0;
      pos = [
        rNow * Math.sin(thNow),
        Math.max(2.2, lerp(from.position[1], to.position[1], e) + yLift),
        rNow * Math.cos(thNow),
      ];
    } else {
      // Smooth direct log-radial glide for axial Champ-de-Mars hops (#23 -> #14 -> #01 -> #46 -> #18)
      const rGeo =
        Math.max(rStartXZ, rEndXZ) > 1200
          ? Math.pow(Math.max(1, rStartXZ), 1 - e) * Math.pow(Math.max(1, rEndXZ), e)
          : null;
      if (rGeo !== null && rStartXZ > 10 && rEndXZ > 10) {
        const thNow = thetaA + dTheta * e;
        pos = [
          rGeo * Math.sin(thNow),
          lerp(from.position[1], to.position[1], e),
          rGeo * Math.cos(thNow),
        ];
      } else {
        pos = [
          lerp(from.position[0], to.position[0], e),
          lerp(from.position[1], to.position[1], e),
          lerp(from.position[2], to.position[2], e),
        ];
      }
    }
  }

  // Log-linear tanHalfY prevents telephoto-to-wide zoom sag
  const tanHalfY = Math.exp(
    lerp(Math.log(Math.max(1e-5, from.tanHalfY)), Math.log(Math.max(1e-5, to.tanHalfY)), e),
  );
  const shiftX = lerp(from.shiftX, to.shiftX, e);
  const shiftY = lerp(from.shiftY, to.shiftY, e);
  const near = Math.exp(
    lerp(Math.log(Math.max(0.25, from.near)), Math.log(Math.max(0.25, to.near)), e),
  );
  const far = lerp(from.far, to.far, e);

  // Focal point interpolation + gaze-anchored quaternion blended with exact endpoint quaternions
  // so camera always keeps the Tower framed mid-flight while locking with 0.000px error at u=0 and u=1.
  const focalPoint: [number, number, number] = [
    lerp(from.focalPoint[0], to.focalPoint[0], e),
    lerp(from.focalPoint[1], to.focalPoint[1], e),
    lerp(from.focalPoint[2], to.focalPoint[2], e),
  ];

  let quaternion = slerpQuat(from.quaternion, to.quaternion, e);
  if (Math.hypot(to.position[0] - from.position[0], to.position[2] - from.position[2]) > 85) {
    const midWeight = Math.sin(Math.PI * e) * 0.65;
    if (midWeight > 0.01) {
      const lookTarget: [number, number, number] = [
        lerp(focalPoint[0], 0, 0.35),
        clamp(focalPoint[1], 10, 190),
        lerp(focalPoint[2], 0, 0.35),
      ];
      const aimState = computeFreeCanonicalCamera(pos, lookTarget, 2 * Math.atan(tanHalfY) * RAD2DEG);
      quaternion = slerpQuat(quaternion, aimState.quaternion, midWeight);
    }
  }

  return {
    position: pos,
    quaternion,
    tanHalfY,
    shiftX,
    shiftY,
    focalPoint,
    near,
    far,
    rect: null,
  };
}
