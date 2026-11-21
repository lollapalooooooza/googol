import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OUTPOST_ZONES, type LandmarkId } from "./mars-data";
import { buildMarsOutpostScene } from "./mars-outpost-models";
import { createMarsProceduralTextures } from "./mars-procedural-textures";
import { clampOutpostTarget, marsHeightAt, sampleRoverTrack } from "./mars-terrain";

export interface MarsWorldOptions {
  container: HTMLElement;
  initialPlaying: boolean;
  reducedMotion: boolean;
  onSelectZone: (zone: LandmarkId | null) => void;
  onContextLoss: (lost: boolean) => void;
  onReady: () => void;
}

export class MarsWorldController {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly pmremGenerator: THREE.PMREMGenerator;
  private readonly envRT: THREE.WebGLRenderTarget;
  private readonly textures: ReturnType<typeof createMarsProceduralTextures>;
  private readonly handles: ReturnType<typeof buildMarsOutpostScene>;
  private readonly resizeObserver: ResizeObserver;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNDC = new THREE.Vector2();
  private readonly keys = new Set<string>();
  private readonly isSoftwareGl: boolean;
  private readonly reducedMotion: boolean;

  private readonly onSelectZone: (zone: LandmarkId | null) => void;
  private readonly onContextLoss: (lost: boolean) => void;

  private playing: boolean;
  private transitioning = false;
  private activePreset: LandmarkId | null = "overview";
  private followRover = false;
  private flyToPos: THREE.Vector3 | null = null;
  private flyToTarget: THREE.Vector3 | null = null;
  private patrolProgress = 0.08;
  private simTime = 0;
  private lastTickMs = 0;
  private rafId: number | null = null;
  private timeoutId: number | null = null;
  private renderQueued = false;
  private disposed = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private lastPoseTime = 0;

  // Scratch vectors pre-allocated outside render loop (zero per-frame GC)
  private readonly scratchForward = new THREE.Vector3();
  private readonly scratchRight = new THREE.Vector3();
  private readonly scratchUp = new THREE.Vector3(0, 1, 0);
  private readonly scratchEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly scratchVecA = new THREE.Vector3();
  private readonly scratchVecB = new THREE.Vector3();

  constructor(opts: MarsWorldOptions) {
    this.container = opts.container;
    this.playing = opts.initialPlaying;
    this.reducedMotion = opts.reducedMotion;
    this.onSelectZone = opts.onSelectZone;
    this.onContextLoss = opts.onContextLoss;

    // Detect software WebGL rasterizers (SwiftShader / llvmpipe) to pace loop cleanly
    const probeCanvas = document.createElement("canvas");
    const probeGl =
      probeCanvas.getContext("webgl2") ?? probeCanvas.getContext("webgl");
    const dbg = probeGl?.getExtension("WEBGL_debug_renderer_info");
    const glRendererName = dbg && probeGl
      ? String(probeGl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : "";
    this.isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      glRendererName,
    );

    const w = Math.max(1, this.container.clientWidth || 640);
    const h = Math.max(1, this.container.clientHeight || 420);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75),
    );
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    canvas.setAttribute("aria-label", "Interactive 3D Mars Outpost world");
    this.container.innerHTML = "";
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc76e3b);
    this.scene.fog = new THREE.FogExp2(0xc76e3b, 0.0078);

    // Keep RoomEnvironment active in both GPU and software WebGL for calibrated PBR highlights
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();

    this.camera = new THREE.PerspectiveCamera(44, w / h, 0.25, 420);
    const home = OUTPOST_ZONES.overview;
    this.camera.position.set(...home.cameraPos);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...home.cameraTarget);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 58;
    this.controls.minPolarAngle = 0.14;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.update();

    // Warm sunset key directional light + cool sky/ground HemisphereLight contrast
    const sunKey = new THREE.DirectionalLight(0xffc38e, 2.55);
    sunKey.position.set(-14, 15, -52);
    if (!this.isSoftwareGl) {
      sunKey.castShadow = true;
      sunKey.shadow.mapSize.set(1024, 1024);
      sunKey.shadow.camera.near = 4;
      sunKey.shadow.camera.far = 115;
      sunKey.shadow.camera.left = -36;
      sunKey.shadow.camera.right = 36;
      sunKey.shadow.camera.top = 36;
      sunKey.shadow.camera.bottom = -36;
      sunKey.shadow.bias = -0.0005;
      sunKey.shadow.normalBias = 0.03;
    }
    this.scene.add(sunKey);

    const rimFill = new THREE.DirectionalLight(0x88b4cc, 0.48);
    rimFill.position.set(22, 14, 28);
    this.scene.add(rimFill);

    const hemi = new THREE.HemisphereLight(0x8eb4cc, 0x622c17, 0.88);
    this.scene.add(hemi);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createMarsProceduralTextures(maxAniso);
    this.handles = buildMarsOutpostScene(this.scene, this.textures);
    this.updateAnimatedScene(0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.recordCameraPose(true);
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    // Draw initial frame immediately and notify ready
    this.renderFrame();
    opts.onReady();

    if (this.playing && !this.reducedMotion) {
      this.startLoop();
    }
  }

  public setPlaying(nextPlaying: boolean) {
    if (this.disposed) return;
    this.playing = nextPlaying;
    if (this.playing && !this.reducedMotion && !this.transitioning) {
      this.startLoop();
    } else if (!this.playing && !this.flyToPos && this.keys.size === 0) {
      this.stopLoop();
      this.requestRender();
    }
  }

  public setTransitioning(nextTransitioning: boolean) {
    this.transitioning = nextTransitioning;
    if (this.transitioning) {
      this.stopLoop();
    } else if (this.playing && !this.reducedMotion) {
      this.startLoop();
    } else {
      this.requestRender();
    }
  }

  public focusZone(zoneId: LandmarkId | null, instant = false) {
    if (this.disposed) return;
    this.activePreset = zoneId;
    if (!zoneId) {
      this.followRover = false;
      this.flyToPos = null;
      this.flyToTarget = null;
      return;
    }
    const zone = OUTPOST_ZONES[zoneId];
    this.followRover = !!zone.followRover;

    if (this.followRover) {
      const sample = sampleRoverTrack(this.patrolProgress);
      const offsetX = sample.x - Math.sin(sample.headingRad) * 6.8 + Math.cos(sample.headingRad) * 2.4;
      const offsetZ = sample.z - Math.cos(sample.headingRad) * 6.8 - Math.sin(sample.headingRad) * 2.4;
      const targetPos = new THREE.Vector3(offsetX, sample.y + 3.0, offsetZ);
      const targetLook = new THREE.Vector3(sample.x, sample.y + 1.15, sample.z);
      if (instant || this.reducedMotion) {
        this.camera.position.copy(targetPos);
        this.controls.target.copy(targetLook);
        this.controls.update();
        this.flyToPos = null;
        this.flyToTarget = null;
        this.recordCameraPose(true);
        this.requestRender();
      } else {
        this.flyToPos = targetPos;
        this.flyToTarget = targetLook;
        this.startLoop();
      }
      return;
    }

    const nextPos = new THREE.Vector3(...zone.cameraPos);
    const nextTarget = new THREE.Vector3(...zone.cameraTarget);
    if (instant || this.reducedMotion) {
      this.flyToPos = null;
      this.flyToTarget = null;
      this.camera.position.copy(nextPos);
      this.controls.target.copy(nextTarget);
      this.controls.update();
      this.recordCameraPose(true);
      this.requestRender();
    } else {
      this.flyToPos = nextPos;
      this.flyToTarget = nextTarget;
      this.startLoop();
    }
  }

  public resetView() {
    this.focusZone("overview");
  }

  public getCameraPose(): { position: number[]; target: number[]; preset: LandmarkId | null } {
    return {
      position: this.camera.position.toArray().map((n) => +n.toFixed(3)),
      target: this.controls.target.toArray().map((n) => +n.toFixed(3)),
      preset: this.activePreset,
    };
  }

  private handleResize = () => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    // Preserve framing cleanly in narrow preview capsules
    this.camera.zoom = Math.min(1, w / Math.max(1, h * 0.85));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.requestRender();
  };

  private bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("webglcontextlost", this.onWebGLContextLost);
    canvas.addEventListener("webglcontextrestored", this.onWebGLContextRestored);
    this.controls.addEventListener("start", this.onUserOrbitStart);
    this.controls.addEventListener("change", this.onControlsChange);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onUserOrbitStart = () => {
    // Manual drag cleanly interrupts automated fly-to or rover follow
    this.flyToPos = null;
    this.flyToTarget = null;
    this.followRover = false;
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private onControlsChange = () => {
    this.recordCameraPose(false);
    if (!this.playing && !this.flyToPos) {
      this.requestRender();
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons !== 0) return;
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.handles.clickables, false);
    canvas.style.cursor = hits.length > 0 ? "pointer" : "grab";
  };

  private onPointerUp = (e: PointerEvent) => {
    const canvas = this.renderer.domElement;
    canvas.style.cursor = "grab";
    if (!this.pointerDownPos) return;
    const moved = Math.hypot(
      e.clientX - this.pointerDownPos.x,
      e.clientY - this.pointerDownPos.y,
    );
    this.pointerDownPos = null;
    if (moved > 5) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.handles.clickables, false);
    if (hits.length > 0) {
      const zoneId = hits[0].object.userData.zoneId as LandmarkId | undefined;
      if (zoneId) {
        this.focusZone(zoneId);
        this.onSelectZone(zoneId);
      }
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const code = e.code;
    if (
      code === "KeyW" ||
      code === "KeyA" ||
      code === "KeyS" ||
      code === "KeyD" ||
      code === "ArrowUp" ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight"
    ) {
      this.keys.add(code);
      this.flyToPos = null;
      this.flyToTarget = null;
      this.followRover = false;
      this.startLoop();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onWebGLContextLost = (e: Event) => {
    e.preventDefault();
    this.stopLoop();
    this.onContextLoss(true);
  };

  private onWebGLContextRestored = () => {
    this.onContextLoss(false);
    this.requestRender();
    if (this.playing && !this.reducedMotion) {
      this.startLoop();
    }
  };

  private recordCameraPose(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastPoseTime < 60) return;
    this.lastPoseTime = now;
    this.renderer.domElement.dataset.cameraPose = JSON.stringify({
      position: this.camera.position.toArray().map((n) => +n.toFixed(4)),
      target: this.controls.target.toArray().map((n) => +n.toFixed(4)),
    });
  }

  private requestRender() {
    if (this.disposed || this.renderQueued || this.rafId !== null || this.timeoutId !== null) {
      return;
    }
    this.renderQueued = true;
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null;
      this.renderQueued = false;
      if (!this.disposed) {
        this.controls.update();
        this.renderFrame();
      }
    });
  }

  private startLoop() {
    if (this.disposed || this.rafId !== null || this.timeoutId !== null) return;
    this.lastTickMs = performance.now();
    const tick = (now: number) => {
      this.rafId = null;
      if (this.disposed) return;

      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;

      this.stepSimulation(dt);
      this.renderFrame();

      const stillNeedsLoop =
        (this.playing && !this.reducedMotion && !this.transitioning) ||
        this.flyToPos !== null ||
        this.keys.size > 0;

      if (stillNeedsLoop) {
        if (this.isSoftwareGl) {
          this.timeoutId = window.setTimeout(() => {
            this.timeoutId = null;
            if (!this.disposed) {
              this.rafId = window.requestAnimationFrame(tick);
            }
          }, 16);
        } else {
          this.rafId = window.requestAnimationFrame(tick);
        }
      }
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.renderQueued = false;
  }

  private stepSimulation(dt: number) {
    // Advance Patrol Rover #2, anemometers, mast scan, and dust devil when active
    if (this.playing && !this.reducedMotion && !this.transitioning) {
      this.simTime += dt;
      this.patrolProgress = (this.patrolProgress + dt * 0.017) % 1;
      this.updateAnimatedScene(dt);
    }

    // Handle WASD / Arrow key ground roaming
    if (this.keys.size > 0) {
      this.camera.getWorldDirection(this.scratchForward);
      this.scratchForward.y = 0;
      if (this.scratchForward.lengthSq() > 0.0001) {
        this.scratchForward.normalize();
      } else {
        this.scratchForward.set(0, 0, -1);
      }
      this.scratchRight.crossVectors(this.scratchForward, this.scratchUp).normalize();

      const moveF =
        (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
        (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
      const moveR =
        (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
        (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);

      if (moveF !== 0 || moveR !== 0) {
        const speed = 9.5 * dt;
        this.scratchVecA
          .set(0, 0, 0)
          .addScaledVector(this.scratchForward, moveF)
          .addScaledVector(this.scratchRight, moveR);
        if (this.scratchVecA.lengthSq() > 0) {
          this.scratchVecA.normalize().multiplyScalar(speed);
        }
        const rawTx = this.controls.target.x + this.scratchVecA.x;
        const rawTz = this.controls.target.z + this.scratchVecA.z;
        const clamped = clampOutpostTarget(rawTx, rawTz, 1.0);
        const dx = clamped.x - this.controls.target.x;
        const dz = clamped.z - this.controls.target.z;

        const targetGroundY = marsHeightAt(clamped.x, clamped.z) + 1.4;
        const dy = (targetGroundY - this.controls.target.y) * Math.min(1, 6 * dt);

        this.controls.target.x += dx;
        this.controls.target.z += dz;
        this.controls.target.y += dy;
        this.camera.position.x += dx;
        this.camera.position.z += dz;
        this.camera.position.y = Math.max(
          marsHeightAt(this.camera.position.x, this.camera.position.z) + 1.35,
          this.camera.position.y + dy,
        );
      }
    }

    // Smoothly track Patrol Rover #2 if active
    if (this.followRover && !this.flyToPos) {
      const sample = sampleRoverTrack(this.patrolProgress);
      const desiredTargetY = sample.y + 1.15;
      const desiredPosX =
        sample.x - Math.sin(sample.headingRad) * 6.8 + Math.cos(sample.headingRad) * 2.3;
      const desiredPosZ =
        sample.z - Math.cos(sample.headingRad) * 6.8 - Math.sin(sample.headingRad) * 2.3;
      const desiredPosY = Math.max(marsHeightAt(desiredPosX, desiredPosZ) + 1.5, sample.y + 3.0);

      const alpha = 1 - Math.exp(-3.4 * dt);
      this.controls.target.lerp(
        this.scratchVecA.set(sample.x, desiredTargetY, sample.z),
        alpha,
      );
      this.camera.position.lerp(
        this.scratchVecB.set(desiredPosX, desiredPosY, desiredPosZ),
        alpha,
      );
    }

    // Exponentially damped fly-to camera transition
    if (this.flyToPos && this.flyToTarget) {
      const alpha = 1 - Math.exp(-5.2 * dt);
      this.camera.position.lerp(this.flyToPos, alpha);
      this.controls.target.lerp(this.flyToTarget, alpha);
      if (
        this.camera.position.distanceTo(this.flyToPos) < 0.06 &&
        this.controls.target.distanceTo(this.flyToTarget) < 0.06
      ) {
        this.camera.position.copy(this.flyToPos);
        this.controls.target.copy(this.flyToTarget);
        this.flyToPos = null;
        this.flyToTarget = null;
      }
    }

    // Keep camera above local Martian ground height
    const minCamY = marsHeightAt(this.camera.position.x, this.camera.position.z) + 0.85;
    if (this.camera.position.y < minCamY) {
      this.camera.position.y = minCamY;
    }

    this.controls.update();
    this.recordCameraPose(false);
  }

  private updateAnimatedScene(dt: number) {
    // 1. Patrol Rover #2 along spline track
    const sample = sampleRoverTrack(this.patrolProgress);
    const pGroup = this.handles.patrolRover.group;
    pGroup.position.set(sample.x, sample.y, sample.z);
    this.scratchEuler.set(sample.pitchRad, sample.headingRad, sample.rollRad, "YXZ");
    pGroup.quaternion.setFromEuler(this.scratchEuler);

    const wheelSpin = dt * 2.2;
    for (const w of this.handles.patrolRover.wheels) {
      w.rotation.x += wheelSpin;
    }
    this.handles.patrolRover.mastHead.rotation.y = Math.sin(this.simTime * 0.8) * 0.32;

    // 2. Scout Rover #1 subtle camera-mast survey sweep
    this.handles.scoutRover.mastHead.rotation.y = Math.sin(this.simTime * 0.55 + 0.8) * 0.45;

    // 3. Weather tower anemometer cups
    for (const rotor of this.handles.anemometers) {
      rotor.rotation.y += dt * 4.2;
    }

    // 4. Swirling distant dust-devil puffs + billboard facing camera
    for (const puff of this.handles.dustDevilPuffs) {
      const b = puff.userData.base as { x: number; y: number; z: number; t: number; radius: number };
      const swirl = this.simTime * 0.85 + b.t * 4.5;
      puff.position.set(
        b.x + Math.sin(swirl) * b.radius + Math.sin(this.simTime * 0.14) * 2.2,
        b.y + 1.0 + b.t * 9.5 + Math.sin(this.simTime * 1.4 + b.t * 6) * 0.3,
        b.z + Math.cos(swirl) * b.radius,
      );
      puff.quaternion.copy(this.camera.quaternion);
    }

    // 5. Patrol Rover #2 trailing dust wake puffs
    const backX = -Math.sin(sample.headingRad);
    const backZ = -Math.cos(sample.headingRad);
    for (let i = 0; i < this.handles.wakePuffs.length; i++) {
      const wp = this.handles.wakePuffs[i];
      const dist = 1.2 + i * 0.72;
      const drift = Math.sin(this.simTime * 2.1 + i) * 0.35;
      const wx = sample.x + backX * dist + drift;
      const wz = sample.z + backZ * dist + drift * 0.6;
      wp.position.set(wx, marsHeightAt(wx, wz) + 0.42 + i * 0.16, wz);
      wp.quaternion.copy(this.camera.quaternion);
    }

    // 6. Gentle drifting wind dust motes
    const moteAttr = this.handles.windParticles.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = moteAttr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += dt * 1.65;
      if (arr[i] > 32.5) arr[i] = -32.5;
    }
    moteAttr.needsUpdate = true;
  }

  private renderFrame() {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.resizeObserver.disconnect();

    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("webglcontextlost", this.onWebGLContextLost);
    canvas.removeEventListener("webglcontextrestored", this.onWebGLContextRestored);
    this.controls.removeEventListener("start", this.onUserOrbitStart);
    this.controls.removeEventListener("change", this.onControlsChange);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);

    this.controls.dispose();
    this.handles.dispose();
    this.textures.dispose();
    this.envRT.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
