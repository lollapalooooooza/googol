import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LandmarkId } from "./mars-data";
import type { MarsProceduralTextures } from "./mars-procedural-textures";
import {
  ROVER_TRACK_WAYPOINTS,
  isClearedForOutpost,
  marsHeightAt,
  marsNormalAt,
} from "./mars-terrain";

export interface AnimatedRoverHandle {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  mastHead: THREE.Object3D;
  dish: THREE.Object3D;
}

export interface MarsOutpostHandles {
  clickables: THREE.Object3D[];
  anemometers: THREE.Object3D[];
  scoutRover: AnimatedRoverHandle;
  patrolRover: AnimatedRoverHandle;
  dustDevilPuffs: THREE.Mesh[];
  wakePuffs: THREE.Mesh[];
  windParticles: THREE.Points;
  dispose: () => void;
}

function createContactShadowDisc(
  textures: MarsProceduralTextures,
  radiusX: number,
  radiusZ: number,
  opacity = 0.72,
  disposables?: Array<{ dispose: () => void }>,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(2, 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: textures.softShadow,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(geo, mat);
  disc.scale.set(radiusX, 1, radiusZ);
  disc.position.y = 0.025;
  disposables?.push(geo, mat);
  return disc;
}

function addZoneCollider(
  clickables: THREE.Object3D[],
  zoneId: LandmarkId,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
): THREE.Mesh {
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 14),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  col.position.set(x, y + height * 0.5, z);
  col.userData.zoneId = zoneId;
  clickables.push(col);
  return col;
}

function buildSkyAndMesas(scene: THREE.Scene, disposables: Array<{ dispose: () => void }>) {
  // Custom sunset gradient sky dome + pale blue Martian sunset sun
  const sunDir = new THREE.Vector3(-0.035, 0.132, -1).normalize();
  const skyGeo = new THREE.SphereGeometry(230, 40, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: sunDir },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      varying vec3 vWorldDir;
      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, -0.15, 1.0);
        vec3 zenith = vec3(0.56, 0.34, 0.24);
        vec3 midSky = vec3(0.83, 0.51, 0.31);
        vec3 horizon = vec3(0.90, 0.62, 0.39);
        vec3 lowHaze = vec3(0.54, 0.25, 0.14);

        vec3 col = mix(horizon, midSky, smoothstep(0.0, 0.24, h));
        col = mix(col, zenith, smoothstep(0.24, 0.72, h));
        if (h < 0.0) {
          col = mix(horizon, lowHaze, smoothstep(0.0, -0.14, h));
        }

        // Authentic Martian blue sunset dust scattering around solar disc
        float mu = max(dot(dir, normalize(uSunDir)), 0.0);
        float wideWarm = pow(mu, 4.0) * 0.35;
        float blueHalo = pow(mu, 44.0) * 0.85;
        float sunCore = smoothstep(0.99912, 0.99964, mu);

        col += vec3(0.95, 0.62, 0.34) * wideWarm;
        col = mix(col, vec3(0.58, 0.79, 0.93), clamp(blueHalo, 0.0, 0.88));
        col = mix(col, vec3(0.95, 0.99, 1.0), sunCore);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  disposables.push(skyGeo, skyMat);

  // Distant flat-topped Martian canyon mesas encircling the horizon, grounded deep below rim terrain
  const mesaParts: THREE.BufferGeometry[] = [];
  const mesaMat = new THREE.MeshStandardMaterial({
    color: 0x6c331c,
    roughness: 0.96,
    metalness: 0.02,
  });
  const count = 30;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.08;
    const radius = 92 + Math.sin(i * 2.7) * 11;
    const width = 20 + (i % 4) * 6;
    // Keep the mesa directly behind -Z slightly lower so the blue sunset sun sits cleanly on the ridge
    const nearSunGap = Math.abs(Math.sin(angle) + 1) < 0.18 ? 0.68 : 1.0;
    const height = (13.5 + ((i * 7) % 5) * 2.4) * nearSunGap;
    const depth = 13 + (i % 3) * 4;
    const mesa = new THREE.CylinderGeometry(width * 0.58, width * 1.12, height, 7, 1);
    mesa.scale(1, 1, depth / width);
    mesa.rotateY(angle + Math.PI * 0.5 + (i % 2) * 0.35);
    mesa.translate(Math.cos(angle) * radius, height * 0.34 - 2.6, Math.sin(angle) * radius);
    mesaParts.push(mesa);
  }
  const mergedMesas = mergeGeometries(mesaParts);
  mesaParts.forEach((g) => g.dispose());
  if (mergedMesas) {
    const mesaMesh = new THREE.Mesh(mergedMesas, mesaMat);
    scene.add(mesaMesh);
    disposables.push(mergedMesas, mesaMat);
  }
}

function buildTerrainAndTracks(
  scene: THREE.Scene,
  textures: MarsProceduralTextures,
  disposables: Array<{ dispose: () => void }>,
) {
  // Displaced regolith terrain mesh
  const geo = new THREE.PlaneGeometry(210, 210, 128, 128);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = marsHeightAt(x, z);
    pos.setY(i, y);

    // Subtle vertex shade variation by elevation and track proximity
    const elevShade = THREE.MathUtils.clamp(0.92 + y * 0.04, 0.72, 1.12);
    c.setRGB(elevShade, elevShade * 0.95, elevShade * 0.92);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.regolithColor,
    bumpMap: textures.regolithBump,
    bumpScale: 0.16,
    roughness: 0.94,
    metalness: 0.02,
    vertexColors: true,
  });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  scene.add(terrain);
  disposables.push(geo, mat);

  // Dual rover tire-track ribbon hugging the terrain from yard to biodome & loop
  const trackCurvePts = ROVER_TRACK_WAYPOINTS.map(([wx, wz]) => new THREE.Vector3(wx, 0, wz));
  const curve = new THREE.CatmullRomCurve3(trackCurvePts, true, "centripetal", 0.5);
  const segs = 180;
  const ribbonPositions: number[] = [];
  const ribbonUVs: number[] = [];
  const ribbonIndices: number[] = [];
  const halfWidth = 1.45;
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    const lx = pt.x - right.x * halfWidth;
    const lz = pt.z - right.z * halfWidth;
    const rx = pt.x + right.x * halfWidth;
    const rz = pt.z + right.z * halfWidth;

    ribbonPositions.push(lx, marsHeightAt(lx, lz) + 0.032, lz);
    ribbonPositions.push(rx, marsHeightAt(rx, rz) + 0.032, rz);
    ribbonUVs.push(0, t * 24, 1, t * 24);

    if (i < segs) {
      const a = i * 2;
      const b = a + 1;
      const cIdx = a + 2;
      const d = a + 3;
      ribbonIndices.push(a, b, cIdx, b, d, cIdx);
    }
  }

  const trackGeo = new THREE.BufferGeometry();
  trackGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribbonPositions, 3));
  trackGeo.setAttribute("uv", new THREE.Float32BufferAttribute(ribbonUVs, 2));
  trackGeo.setIndex(ribbonIndices);
  trackGeo.computeVertexNormals();

  const trackMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.tireTrack,
    transparent: true,
    opacity: 0.9,
    roughness: 0.96,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const trackMesh = new THREE.Mesh(trackGeo, trackMat);
  trackMesh.receiveShadow = true;
  scene.add(trackMesh);
  disposables.push(trackGeo, trackMat);

  // Foreground straight-ish dual tracks leading directly from foreground yard toward biodome
  const approachPts = [
    new THREE.Vector3(-1.4, 0, 19),
    new THREE.Vector3(-1.5, 0, 10),
    new THREE.Vector3(-1.8, 0, 0),
    new THREE.Vector3(-1.9, 0, -10),
    new THREE.Vector3(-2.0, 0, -19.2),
  ];
  const appCurve = new THREE.CatmullRomCurve3(approachPts);
  const appSegs = 48;
  const appPos: number[] = [];
  const appUvs: number[] = [];
  const appIdx: number[] = [];
  for (let i = 0; i <= appSegs; i++) {
    const t = i / appSegs;
    const pt = appCurve.getPointAt(t);
    const tan = appCurve.getTangentAt(t).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const lx = pt.x - right.x * 1.42;
    const lz = pt.z - right.z * 1.42;
    const rx = pt.x + right.x * 1.42;
    const rz = pt.z + right.z * 1.42;
    appPos.push(lx, marsHeightAt(lx, lz) + 0.036, lz);
    appPos.push(rx, marsHeightAt(rx, rz) + 0.036, rz);
    appUvs.push(0, t * 8, 1, t * 8);
    if (i < appSegs) {
      const a = i * 2;
      appIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const appGeo = new THREE.BufferGeometry();
  appGeo.setAttribute("position", new THREE.Float32BufferAttribute(appPos, 3));
  appGeo.setAttribute("uv", new THREE.Float32BufferAttribute(appUvs, 2));
  appGeo.setIndex(appIdx);
  appGeo.computeVertexNormals();
  const appMesh = new THREE.Mesh(appGeo, trackMat);
  appMesh.receiveShadow = true;
  scene.add(appMesh);
  disposables.push(appGeo);
}

function buildAnemometerMast(
  height: number,
  metalMat: THREE.Material,
  accentMat: THREE.Material,
  dishMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>,
): { group: THREE.Group; rotor: THREE.Group } {
  const mast = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, height, 10);
  const pole = new THREE.Mesh(poleGeo, metalMat);
  pole.position.y = height * 0.5;
  pole.castShadow = true;
  mast.add(pole);
  disposables.push(poleGeo);

  // Dish antenna arm at 72% height
  const dishGeo = new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.38);
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.position.set(-0.28, height * 0.76, 0);
  dish.rotation.set(0.3, 0, Math.PI * 0.42);
  mast.add(dish);
  disposables.push(dishGeo);

  // Crossbar + spinning 3-cup anemometer at top
  const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.85, 8);
  barGeo.rotateZ(Math.PI / 2);
  const bar = new THREE.Mesh(barGeo, metalMat);
  bar.position.y = height * 0.88;
  mast.add(bar);
  disposables.push(barGeo);

  const rotor = new THREE.Group();
  rotor.position.y = height + 0.08;
  const armGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6);
  const cupGeo = new THREE.SphereGeometry(0.08, 10, 8, 0, Math.PI);
  disposables.push(armGeo, cupGeo);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const armHolder = new THREE.Group();
    armHolder.rotation.y = a;
    const arm = new THREE.Mesh(armGeo, metalMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = 0.21;
    const cup = new THREE.Mesh(cupGeo, accentMat);
    cup.position.set(0.42, 0, 0);
    cup.rotation.y = Math.PI / 2;
    armHolder.add(arm, cup);
    rotor.add(armHolder);
  }
  mast.add(rotor);

  // Amber beacon tip
  const beaconGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xffaa44,
    emissive: 0xff7b1a,
    emissiveIntensity: 1.5,
    roughness: 0.3,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = height + 0.22;
  mast.add(beacon);
  disposables.push(beaconGeo, beaconMat);

  return { group: mast, rotor };
}

function buildCargoCrate(
  textures: MarsProceduralTextures,
  scale = 1,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const g = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(1.15 * scale, 0.74 * scale, 0.78 * scale);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.cratePanel,
    roughness: 0.58,
    metalness: 0.18,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.37 * scale;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const trimGeo = new THREE.BoxGeometry(1.2 * scale, 0.08 * scale, 0.83 * scale);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x353941, roughness: 0.45, metalness: 0.5 });
  const topTrim = new THREE.Mesh(trimGeo, trimMat);
  topTrim.position.y = 0.72 * scale;
  const botTrim = new THREE.Mesh(trimGeo, trimMat);
  botTrim.position.y = 0.04 * scale;
  g.add(topTrim, botTrim);

  disposables.push(bodyGeo, bodyMat, trimGeo, trimMat);
  return g;
}

function buildHabitatDome(
  scene: THREE.Scene,
  textures: MarsProceduralTextures,
  clickables: THREE.Object3D[],
  anemometers: THREE.Object3D[],
  disposables: Array<{ dispose: () => void }>,
) {
  const hx = 12.5;
  const hz = 6.5;
  const hy = marsHeightAt(hx, hz);

  const hab = new THREE.Group();
  hab.position.set(hx, hy, hz);
  // Orient airlock hatch clearly toward the rover yard & overview camera
  hab.rotation.y = -Math.PI * 0.54;

  // Foundation plinth collar
  const baseGeo = new THREE.CylinderGeometry(5.15, 5.45, 0.55, 28);
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x454a52, roughness: 0.48, metalness: 0.6 });
  const base = new THREE.Mesh(baseGeo, darkMetal);
  base.position.y = 0.275;
  base.castShadow = true;
  base.receiveShadow = true;
  hab.add(base);

  // Ribbed composite shell dome
  const domeGeo = new THREE.SphereGeometry(5.05, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.48);
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.domeRibColor,
    bumpMap: textures.domeRibBump,
    bumpScale: 0.04,
    roughness: 0.66,
    metalness: 0.12,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = 0.42;
  dome.castShadow = true;
  dome.receiveShadow = true;
  hab.add(dome);

  // Structural arch ribs over dome
  const ribGeo = new THREE.TorusGeometry(5.07, 0.055, 8, 36, Math.PI);
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(ribGeo, darkMetal);
    rib.position.y = 0.42;
    rib.rotation.y = (i * Math.PI) / 6;
    hab.add(rib);
  }

  // Protruding circular airlock vestibule
  const vestGroup = new THREE.Group();
  vestGroup.position.set(0, 1.55, 4.45);

  const tunnelGeo = new THREE.CylinderGeometry(1.55, 1.65, 1.8, 24);
  tunnelGeo.rotateX(Math.PI / 2);
  const whiteTrim = new THREE.MeshStandardMaterial({ color: 0xd9d2c7, roughness: 0.52, metalness: 0.25 });
  const tunnel = new THREE.Mesh(tunnelGeo, whiteTrim);
  tunnel.castShadow = true;
  vestGroup.add(tunnel);

  // Glowing golden-amber pressurized interior recess + outer rim ring
  const glowBackGeo = new THREE.CylinderGeometry(1.24, 1.24, 0.25, 24);
  glowBackGeo.rotateX(Math.PI / 2);
  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffebb8,
    emissive: 0xffa732,
    emissiveIntensity: 2.6,
    roughness: 0.25,
  });
  const glowBack = new THREE.Mesh(glowBackGeo, warmGlowMat);
  glowBack.position.z = 0.72;
  vestGroup.add(glowBack);

  const glowTubeGeo = new THREE.CylinderGeometry(1.26, 1.26, 0.48, 24, 1, true);
  glowTubeGeo.rotateX(Math.PI / 2);
  const warmWallMat = new THREE.MeshStandardMaterial({
    color: 0xffd788,
    emissive: 0xff9d2e,
    emissiveIntensity: 1.8,
    side: THREE.BackSide,
    roughness: 0.4,
  });
  const glowTube = new THREE.Mesh(glowTubeGeo, warmWallMat);
  glowTube.position.z = 0.74;
  vestGroup.add(glowTube);

  // Outer bevelled circular hatch ring
  const frameGeo = new THREE.TorusGeometry(1.36, 0.16, 12, 28);
  const frame = new THREE.Mesh(frameGeo, darkMetal);
  frame.position.z = 0.92;
  vestGroup.add(frame);

  // Swung-open curved airlock hatch door on hinge
  const doorGeo = new THREE.CylinderGeometry(1.12, 1.12, 0.12, 24);
  doorGeo.rotateX(Math.PI / 2);
  const door = new THREE.Mesh(doorGeo, whiteTrim);
  door.position.set(-1.35, 0, 1.32);
  door.rotation.y = Math.PI * 0.44;
  door.castShadow = true;
  vestGroup.add(door);

  // Warm interior PointLight illuminating the vestibule & steps
  const airlockLight = new THREE.PointLight(0xffb554, 5.2, 16, 1.5);
  airlockLight.position.set(0, 0.3, 1.35);
  vestGroup.add(airlockLight);

  hab.add(vestGroup);

  // 3-step metallic access stairs anchored flush onto the vestibule threshold
  const stairGroup = new THREE.Group();
  stairGroup.position.set(0, 0, 5.28);
  const stepGeo = new THREE.BoxGeometry(2.05, 0.1, 0.38);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.35, metalness: 0.72 });
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(stepGeo, darkMetal);
    step.position.set(0, 0.12 + s * 0.18, 0.85 - s * 0.34);
    step.castShadow = true;
    step.receiveShadow = true;
    stairGroup.add(step);
  }
  const railGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8);
  for (const side of [-1.0, 1.0]) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(side, 0.72, 0.36);
    rail.rotation.x = Math.PI * 0.28;
    stairGroup.add(rail);
  }
  hab.add(stairGroup);

  // Flanking life-support utility box & crate
  const utilGeo = new THREE.BoxGeometry(1.4, 1.15, 0.9);
  const utilBox = new THREE.Mesh(utilGeo, darkMetal);
  utilBox.position.set(3.8, 0.575, 3.6);
  utilBox.rotation.y = 0.55;
  utilBox.castShadow = true;
  hab.add(utilBox);

  const habCrate = buildCargoCrate(textures, 0.95, disposables);
  habCrate.position.set(-3.4, 0, 4.1);
  habCrate.rotation.y = 0.4;
  hab.add(habCrate);

  // Weather & Comms mast next to habitat
  const { group: mastGroup, rotor } = buildAnemometerMast(6.4, railMat, whiteTrim, whiteTrim, disposables);
  mastGroup.position.set(-2.5, 0.2, -3.5);
  hab.add(mastGroup);
  anemometers.push(rotor);

  hab.add(createContactShadowDisc(textures, 6.2, 6.2, 0.65, disposables));
  scene.add(hab);
  disposables.push(glowTubeGeo, warmWallMat);

  const collider = addZoneCollider(clickables, "habitat", hx, hy, hz, 5.6, 6.2);
  scene.add(collider);

  disposables.push(
    baseGeo,
    darkMetal,
    domeGeo,
    domeMat,
    ribGeo,
    tunnelGeo,
    whiteTrim,
    glowBackGeo,
    warmGlowMat,
    frameGeo,
    doorGeo,
    stepGeo,
    railGeo,
    railMat,
    utilGeo,
  );
}

function buildHydroponicBiodome(
  scene: THREE.Scene,
  textures: MarsProceduralTextures,
  clickables: THREE.Object3D[],
  disposables: Array<{ dispose: () => void }>,
) {
  const bx = -2.0;
  const bz = -26.0;
  const by = marsHeightAt(bx, bz);

  const bio = new THREE.Group();
  bio.position.set(bx, by, bz);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x383e47, roughness: 0.42, metalness: 0.65 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.95, metalness: 0 });
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x626b75, roughness: 0.5, metalness: 0.45 });

  // Circular foundation ring & warm lit interior deck
  const plinthGeo = new THREE.CylinderGeometry(5.65, 5.95, 0.46, 32);
  const plinth = new THREE.Mesh(plinthGeo, frameMat);
  plinth.position.y = 0.23;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  bio.add(plinth);

  const deckGeo = new THREE.CircleGeometry(5.35, 32);
  deckGeo.rotateX(-Math.PI / 2);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x555b62, roughness: 0.8, metalness: 0.15 });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = 0.47;
  deck.receiveShadow = true;
  bio.add(deck);

  // Raised hydroponic planter beds + lush green crop rows inside
  const bedGeo = new THREE.BoxGeometry(3.4, 0.55, 1.35);
  const soilGeo = new THREE.BoxGeometry(3.2, 0.14, 1.16);
  const leafGeo = new THREE.DodecahedronGeometry(0.24, 0);
  const leafMatA = new THREE.MeshStandardMaterial({ color: 0x52993a, roughness: 0.72, metalness: 0.02 });
  const leafMatB = new THREE.MeshStandardMaterial({ color: 0x72bd4b, roughness: 0.68, metalness: 0.02 });
  const growBarGeo = new THREE.BoxGeometry(3.1, 0.08, 0.14);
  const growBarMat = new THREE.MeshStandardMaterial({
    color: 0xfff5dc,
    emissive: 0xffe6b3,
    emissiveIntensity: 2.2,
  });

  const bedOffsets: Array<[number, number]> = [
    [-1.95, -1.35],
    [1.95, -1.35],
    [-1.95, 1.35],
    [1.95, 1.35],
  ];

  const leafCount = bedOffsets.length * 16;
  const leafInstA = new THREE.InstancedMesh(leafGeo, leafMatA, leafCount);
  const leafInstB = new THREE.InstancedMesh(leafGeo, leafMatB, leafCount);
  const dummy = new THREE.Object3D();
  let idxA = 0;
  let idxB = 0;

  bedOffsets.forEach(([ox, oz], bIdx) => {
    const bed = new THREE.Mesh(bedGeo, trayMat);
    bed.position.set(ox, 0.74, oz);
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.set(ox, 1.0, oz);
    bio.add(bed, soil);

    // Overhead warm grow-light bar above each planter
    const bar = new THREE.Mesh(growBarGeo, growBarMat);
    bar.position.set(ox, 2.35, oz);
    bio.add(bar);

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        const px = ox - 1.3 + c * 0.37;
        const pz = oz - 0.3 + r * 0.6;
        const s = 0.78 + ((c * 3 + r + bIdx) % 4) * 0.14;
        dummy.position.set(px, 1.18, pz);
        dummy.rotation.set(0.1 * r, c * 0.7, 0.08);
        dummy.scale.set(s * 1.15, s * 0.9, s * 1.1);
        dummy.updateMatrix();
        if ((c + r) % 2 === 0) {
          leafInstA.setMatrixAt(idxA++, dummy.matrix);
        } else {
          leafInstB.setMatrixAt(idxB++, dummy.matrix);
        }
      }
    }
  });
  leafInstA.count = idxA;
  leafInstB.count = idxB;
  leafInstA.instanceMatrix.needsUpdate = true;
  leafInstB.instanceMatrix.needsUpdate = true;
  bio.add(leafInstA, leafInstB);

  // Warm interior illumination PointLight
  const bioLight = new THREE.PointLight(0xffe8ba, 5.2, 16, 1.5);
  bioLight.position.set(0, 3.1, 0);
  bio.add(bioLight);

  // Geodesic faceted glass dome + gunmetal rib wireframe
  const glassGeo = new THREE.IcosahedronGeometry(5.35, 2);
  // Clip bottom vertices below y = 0 to form clean hemisphere
  const gPos = glassGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < gPos.count; i++) {
    if (gPos.getY(i) < 0) {
      gPos.setY(i, 0);
    }
  }
  glassGeo.computeVertexNormals();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff5e8,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.05,
    ior: 1.45,
    reflectivity: 0.85,
    envMapIntensity: 1.4,
    depthWrite: false,
  });
  const glassDome = new THREE.Mesh(glassGeo, glassMat);
  glassDome.position.y = 0.42;
  bio.add(glassDome);

  const cageGeo = new THREE.WireframeGeometry(glassGeo);
  const cageMat = new THREE.LineBasicMaterial({ color: 0x4b525c });
  const cage = new THREE.LineSegments(cageGeo, cageMat);
  cage.position.y = 0.42;
  cage.scale.setScalar(1.006);
  bio.add(cage);

  // Biodome front-left airlock door & steps facing south-southwest
  const entryGroup = new THREE.Group();
  entryGroup.position.set(-3.1, 0, 4.4);
  entryGroup.rotation.y = -0.58;

  const portBoxGeo = new THREE.BoxGeometry(1.9, 2.05, 1.35);
  const portMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc4, roughness: 0.55, metalness: 0.22 });
  const portBox = new THREE.Mesh(portBoxGeo, portMat);
  portBox.position.set(0, 1.05, 0);
  portBox.castShadow = true;

  const portGlowGeo = new THREE.CircleGeometry(0.46, 18);
  const portGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffebc2,
    emissive: 0xffb347,
    emissiveIntensity: 1.8,
  });
  const portGlow = new THREE.Mesh(portGlowGeo, portGlowMat);
  portGlow.position.set(0, 1.28, 0.69);

  const stepBoxGeo = new THREE.BoxGeometry(1.7, 0.14, 0.4);
  for (let s = 0; s < 3; s++) {
    const st = new THREE.Mesh(stepBoxGeo, frameMat);
    st.position.set(0, 0.08 + s * 0.16, 1.25 - s * 0.3);
    st.castShadow = true;
    entryGroup.add(st);
  }
  entryGroup.add(portBox, portGlow);
  bio.add(entryGroup);

  // Opposite rear utility module
  const rearModGeo = new THREE.BoxGeometry(2.1, 1.65, 1.45);
  const rearMod = new THREE.Mesh(rearModGeo, portMat);
  rearMod.position.set(4.5, 0.85, -3.2);
  rearMod.rotation.y = -0.65;
  rearMod.castShadow = true;
  bio.add(rearMod);

  // Clustered cargo crates outside biodome
  const cratePositions: Array<[number, number, number, number]> = [
    [-5.9, 2.4, 0.35, 0.92],
    [-6.6, 0.9, -0.2, 0.78],
    [4.4, 4.2, 0.6, 0.9],
    [5.8, 3.1, -0.3, 0.82],
  ];
  for (const [cx, cz, ry, sc] of cratePositions) {
    const cr = buildCargoCrate(textures, sc, disposables);
    cr.position.set(cx, 0, cz);
    cr.rotation.y = ry;
    bio.add(cr);
  }

  bio.add(createContactShadowDisc(textures, 6.7, 6.7, 0.65, disposables));
  scene.add(bio);

  const collider = addZoneCollider(clickables, "biodome", bx, by, bz, 6.2, 5.6);
  scene.add(collider);

  disposables.push(
    frameMat,
    soilMat,
    trayMat,
    plinthGeo,
    deckGeo,
    deckMat,
    bedGeo,
    soilGeo,
    leafGeo,
    leafMatA,
    leafMatB,
    growBarGeo,
    growBarMat,
    glassGeo,
    glassMat,
    cageGeo,
    cageMat,
    portBoxGeo,
    portMat,
    portGlowGeo,
    portGlowMat,
    stepBoxGeo,
    rearModGeo,
  );
}

function buildSolarAndCommsArray(
  scene: THREE.Scene,
  textures: MarsProceduralTextures,
  clickables: THREE.Object3D[],
  anemometers: THREE.Object3D[],
  disposables: Array<{ dispose: () => void }>,
) {
  const sx = 7.2;
  const sz = -23.5;
  const sy = marsHeightAt(sx, sz);

  const arrayGroup = new THREE.Group();
  arrayGroup.position.set(sx, sy, sz);

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x737b85, roughness: 0.4, metalness: 0.68 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.solarGrid,
    roughness: 0.22,
    metalness: 0.35,
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xd8d1c7, roughness: 0.55, metalness: 0.2 });

  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.35, 10);
  const panelGeo = new THREE.BoxGeometry(3.5, 0.08, 1.9);

  // Two angled photovoltaic arrays
  for (const [px, pz, rotY] of [
    [-1.6, 0.7, -0.35],
    [1.8, -0.6, -0.35],
  ] as const) {
    const unit = new THREE.Group();
    unit.position.set(px, 0, pz);
    unit.rotation.y = rotY;

    for (const lx of [-0.95, 0.95]) {
      const post = new THREE.Mesh(postGeo, metalMat);
      post.position.set(lx, 0.675, 0);
      post.castShadow = true;
      unit.add(post);
    }

    const wing = new THREE.Mesh(panelGeo, panelMat);
    wing.position.set(0, 1.42, 0);
    wing.rotation.x = 0.54;
    wing.castShadow = true;
    wing.receiveShadow = true;
    unit.add(wing);
    unit.add(createContactShadowDisc(textures, 1.95, 1.35, 0.55, disposables));
    arrayGroup.add(unit);
  }

  // Telemetry weather & comms mast behind solar wings
  const { group: tower, rotor } = buildAnemometerMast(6.8, metalMat, whiteMat, whiteMat, disposables);
  tower.position.set(0.3, 0, -2.5);
  arrayGroup.add(tower);
  anemometers.push(rotor);

  // Power battery crate
  const batteryCrate = buildCargoCrate(textures, 0.95, disposables);
  batteryCrate.position.set(2.4, 0, -2.2);
  batteryCrate.rotation.y = 0.2;
  arrayGroup.add(batteryCrate);

  scene.add(arrayGroup);
  const collider = addZoneCollider(clickables, "solar", sx, sy, sz, 3.6, 5.8);
  scene.add(collider);

  disposables.push(metalMat, panelMat, whiteMat, postGeo, panelGeo);
}

function buildMarsRover(
  zoneId: LandmarkId,
  textures: MarsProceduralTextures,
  clickables: THREE.Object3D[],
  disposables: Array<{ dispose: () => void }>,
): AnimatedRoverHandle {
  const rover = new THREE.Group();

  const whiteBody = new THREE.MeshStandardMaterial({ color: 0xe3ddd4, roughness: 0.52, metalness: 0.18 });
  const darkChassis = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.55, metalness: 0.6 });
  const goldFoil = new THREE.MeshStandardMaterial({ color: 0xc99635, roughness: 0.3, metalness: 0.78 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.88, metalness: 0.15 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb67b3c, roughness: 0.38, metalness: 0.65 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x8be2ff,
    emissive: 0x3ba8db,
    emissiveIntensity: 0.9,
    roughness: 0.15,
    metalness: 0.8,
  });

  const wheelRadius = 0.28;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.24, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.27, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.28, 0.54, 0.045);

  const wheels: THREE.Object3D[] = [];
  const xOffsets = [-0.88, 0.88];
  const zOffsets = [0.92, 0.0, -0.92];

  for (const sx of xOffsets) {
    for (const sz of zOffsets) {
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(sx, wheelRadius, sz);
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, rimMat);
      const cleat = new THREE.Mesh(spokeGeo, darkChassis);
      wheelPivot.add(tire, hub, cleat);
      rover.add(wheelPivot);
      wheels.push(wheelPivot);
    }

    // Rocker-bogie suspension struts
    const bogieGeo = new THREE.CylinderGeometry(0.036, 0.036, 1.92, 8);
    bogieGeo.rotateX(Math.PI / 2);
    const bogie = new THREE.Mesh(bogieGeo, darkChassis);
    bogie.position.set(sx * 0.86, 0.54, 0);
    rover.add(bogie);
    disposables.push(bogieGeo);

    const dropGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.38, 8);
    for (const sz of zOffsets) {
      const drop = new THREE.Mesh(dropGeo, darkChassis);
      drop.position.set(sx * 0.9, 0.38, sz);
      rover.add(drop);
    }
    disposables.push(dropGeo);
  }

  // Main chassis deck & warm white thermal box
  const chassisGeo = new THREE.BoxGeometry(1.24, 0.26, 2.05);
  const chassis = new THREE.Mesh(chassisGeo, darkChassis);
  chassis.position.set(0, 0.72, 0);
  chassis.castShadow = true;
  rover.add(chassis);

  const upperGeo = new THREE.BoxGeometry(1.16, 0.42, 1.65);
  const upper = new THREE.Mesh(upperGeo, whiteBody);
  upper.position.set(0, 0.98, 0.06);
  upper.castShadow = true;
  rover.add(upper);

  // Gold Kapton side thermal accents
  const foilGeo = new THREE.BoxGeometry(1.2, 0.24, 0.95);
  const foil = new THREE.Mesh(foilGeo, goldFoil);
  foil.position.set(0, 0.96, 0.14);
  rover.add(foil);

  // Rear RTG battery radiator fins (tilted back like Curiosity/Perseverance)
  const rtgGeo = new THREE.BoxGeometry(0.68, 0.44, 0.55);
  const rtg = new THREE.Mesh(rtgGeo, darkChassis);
  rtg.position.set(0, 0.95, -0.96);
  rtg.rotation.x = -0.35;
  rtg.castShadow = true;
  rover.add(rtg);

  // High-gain directional dish on rear deck
  const dishGroup = new THREE.Group();
  dishGroup.position.set(-0.32, 1.24, -0.45);
  const dishStemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8);
  const dishCupGeo = new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.38);
  const dishStem = new THREE.Mesh(dishStemGeo, darkChassis);
  const dishCup = new THREE.Mesh(dishCupGeo, whiteBody);
  dishCup.position.y = 0.14;
  dishCup.rotation.x = 0.55;
  dishGroup.add(dishStem, dishCup);
  rover.add(dishGroup);

  // Front remote-sensing mast & stereo navcam head
  const mastPoleGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.85, 10);
  const mastPole = new THREE.Mesh(mastPoleGeo, whiteBody);
  mastPole.position.set(0.28, 1.56, 0.62);
  mastPole.castShadow = true;
  rover.add(mastPole);

  const mastHead = new THREE.Group();
  mastHead.position.set(0.28, 2.02, 0.62);

  const headBoxGeo = new THREE.BoxGeometry(0.46, 0.22, 0.26);
  const headBox = new THREE.Mesh(headBoxGeo, whiteBody);
  headBox.castShadow = true;

  const eyeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 12);
  eyeGeo.rotateX(Math.PI / 2);
  for (const ex of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(eyeGeo, lensMat);
    eye.position.set(ex, 0.02, 0.14);
    mastHead.add(eye);
  }
  const cyclopsGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12);
  cyclopsGeo.rotateX(Math.PI / 2);
  const cyclops = new THREE.Mesh(cyclopsGeo, darkChassis);
  cyclops.position.set(0, -0.02, 0.14);
  mastHead.add(headBox, cyclops);
  rover.add(mastHead);

  // Invisible clickable proxy collider attached inside rover
  const colGeo = new THREE.CylinderGeometry(1.45, 1.45, 2.2, 12);
  const col = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ visible: false }));
  col.position.y = 1.1;
  col.userData.zoneId = zoneId;
  rover.add(col);
  clickables.push(col);

  rover.add(createContactShadowDisc(textures, 1.45, 1.65, 0.72, disposables));

  disposables.push(
    whiteBody,
    darkChassis,
    goldFoil,
    tireMat,
    rimMat,
    lensMat,
    wheelGeo,
    hubGeo,
    spokeGeo,
    chassisGeo,
    upperGeo,
    foilGeo,
    rtgGeo,
    dishStemGeo,
    dishCupGeo,
    mastPoleGeo,
    headBoxGeo,
    eyeGeo,
    cyclopsGeo,
    colGeo,
  );

  return { group: rover, wheels, mastHead, dish: dishGroup };
}

function buildRocksAndAtmosphere(
  scene: THREE.Scene,
  textures: MarsProceduralTextures,
  disposables: Array<{ dispose: () => void }>,
) {
  // Instanced sculpted Martian volcanic boulders
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rPos = rockGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const crag = 0.85 + 0.25 * Math.sin(vx * 3.1 + vz * 2.7);
    rPos.setXYZ(i, vx * crag, vy * 0.68 * crag, vz * crag);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    bumpMap: textures.regolithBump,
    bumpScale: 0.08,
    roughness: 0.94,
    metalness: 0.04,
  });

  const maxRocks = 190;
  const instRocks = new THREE.InstancedMesh(rockGeo, rockMat, maxRocks);
  instRocks.castShadow = true;
  instRocks.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let placed = 0;
  let seed = 9187;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let attempt = 0; attempt < 900 && placed < maxRocks; attempt++) {
    const angle = rnd() * Math.PI * 2;
    const rad = 4.5 + Math.pow(rnd(), 0.78) * 56;
    const rx = Math.cos(angle) * rad;
    const rz = Math.sin(angle) * rad;
    if (isClearedForOutpost(rx, rz)) continue;

    const scale = 0.24 + Math.pow(rnd(), 2.2) * 1.35;
    const ry = marsHeightAt(rx, rz);
    dummy.position.set(rx, ry + scale * 0.2, rz);
    dummy.rotation.set(rnd() * 0.35, rnd() * Math.PI * 2, rnd() * 0.35);
    dummy.scale.set(scale * (0.9 + rnd() * 0.5), scale * (0.65 + rnd() * 0.45), scale * (0.9 + rnd() * 0.5));
    dummy.updateMatrix();
    instRocks.setMatrixAt(placed, dummy.matrix);

    // Rich Martian basalt & iron-oxide sRGB rock tones (not chalky white!)
    const ironMix = rnd();
    tint.setRGB(0.24 + ironMix * 0.22, 0.11 + ironMix * 0.09, 0.07 + ironMix * 0.05, THREE.SRGBColorSpace);
    instRocks.setColorAt(placed, tint);
    placed++;
  }
  instRocks.count = placed;
  instRocks.instanceMatrix.needsUpdate = true;
  if (instRocks.instanceColor) instRocks.instanceColor.needsUpdate = true;
  scene.add(instRocks);
  disposables.push(rockGeo, rockMat);

  // Swirling dust-devil column on the left mid-ground plains (like 00:04-00:14)
  const puffGeo = new THREE.PlaneGeometry(1, 1);
  const puffMat = new THREE.MeshBasicMaterial({
    map: textures.dustSprite,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const dustDevilPuffs: THREE.Mesh[] = [];
  const devilX = -21;
  const devilZ = -17;
  const devilY = marsHeightAt(devilX, devilZ);
  for (let i = 0; i < 14; i++) {
    const puff = new THREE.Mesh(puffGeo, puffMat);
    const t = i / 13;
    const s = 2.6 + t * 5.2;
    puff.scale.set(s, s * 0.85, 1);
    puff.position.set(devilX + Math.sin(i * 1.4) * (0.6 + t * 1.6), devilY + 1.0 + t * 9.5, devilZ + Math.cos(i * 1.4) * (0.6 + t * 1.6));
    puff.userData.base = { x: devilX, y: devilY, z: devilZ, t, radius: 0.7 + t * 1.8 };
    scene.add(puff);
    dustDevilPuffs.push(puff);
  }

  // Trailing dust wake puffs for Patrol Rover #2
  const wakeMat = new THREE.MeshBasicMaterial({
    map: textures.dustSprite,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wakePuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const wp = new THREE.Mesh(puffGeo, wakeMat);
    wp.scale.setScalar(1.3 + i * 0.25);
    wp.userData.phase = i / 8;
    scene.add(wp);
    wakePuffs.push(wp);
  }

  // Ambient wind-blown dust motes
  const moteCount = 160;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (rnd() - 0.5) * 65;
    motePos[i * 3 + 1] = 0.4 + rnd() * 7.5;
    motePos[i * 3 + 2] = (rnd() - 0.5) * 65;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    map: textures.dustSprite,
    color: 0xe8a87c,
    size: 0.32,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const windParticles = new THREE.Points(moteGeo, moteMat);
  scene.add(windParticles);

  disposables.push(puffGeo, puffMat, wakeMat, moteGeo, moteMat);
  return { dustDevilPuffs, wakePuffs, windParticles };
}

export function buildMarsOutpostScene(
  scene: THREE.Scene,
  textures: MarsProceduralTextures,
): MarsOutpostHandles {
  const disposables: Array<{ dispose: () => void }> = [];
  const clickables: THREE.Object3D[] = [];
  const anemometers: THREE.Object3D[] = [];

  buildSkyAndMesas(scene, disposables);
  buildTerrainAndTracks(scene, textures, disposables);
  buildHabitatDome(scene, textures, clickables, anemometers, disposables);
  buildHydroponicBiodome(scene, textures, clickables, disposables);
  buildSolarAndCommsArray(scene, textures, clickables, anemometers, disposables);

  // Scout Rover #1 positioned on left volcanic ridge facing outpost yard (like 00:00-00:14)
  const scoutRover = buildMarsRover("rover1", textures, clickables, disposables);
  const r1x = -5.8;
  const r1z = 9.2;
  const [nx, ny, nz] = marsNormalAt(r1x, r1z);
  scoutRover.group.position.set(r1x, marsHeightAt(r1x, r1z), r1z);
  const upVec = new THREE.Vector3(0, 1, 0);
  const normVec = new THREE.Vector3(nx, ny, nz);
  const tiltQ = new THREE.Quaternion().setFromUnitVectors(upVec, normVec);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(upVec, 1.05);
  scoutRover.group.quaternion.copy(tiltQ).multiply(yawQ);
  scene.add(scoutRover.group);

  // Patrol Rover #2 driven dynamically along ROVER_TRACK_WAYPOINTS
  const patrolRover = buildMarsRover("rover2", textures, clickables, disposables);
  scene.add(patrolRover.group);

  const { dustDevilPuffs, wakePuffs, windParticles } = buildRocksAndAtmosphere(
    scene,
    textures,
    disposables,
  );

  return {
    clickables,
    anemometers,
    scoutRover,
    patrolRover,
    dustDevilPuffs,
    wakePuffs,
    windParticles,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
