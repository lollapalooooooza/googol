import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TowerModelController } from "./eiffel-engine/model/tower_controller.js";
import { upgradeTowerMaterialsAndDecks } from "./eiffel-engine/model/materials.js";
import { upgradeWorldFloorAndSurfaceMaterials } from "./eiffel-engine/model/floor_textures.js";
import { createParis1889World } from "./eiffel-engine/world/paris_1889.js";
import { createAtmosphereController, enforceZeroEmissiveAcrossScene } from "./eiffel-engine/world/atmosphere.js";
import { createViewportConstraints } from "./eiffel-engine/camera/viewport_constraints.js";
import { installRuntimeFpsAndDrawCallOptimizations } from "./eiffel-engine/perf/fps_and_drawcalls/index.js";
import { EIFFEL_PRESETS, type EiffelMood } from "./eiffel-data";
import {
  BEAT_A_YIELD_SEC,
  BEAT_C_LOCK_SEC,
  HERO_FINALE_CAMERA,
  WALKTHROUGH_SCHEDULE,
  WALKTHROUGH_SPEED_MULTIPLIER,
  clamp,
  computeFreeCanonicalCamera,
  computeStopCanonicalCamera,
  easeConstructionBeatB,
  getStopConfig,
  interpolateCanonicalFlight,
  lerp,
  smoothstepCubic,
  type CanonicalOpticalState,
  type WalkthroughBeat,
} from "./eiffel-walkthrough";

const RAD2DEG = 180 / Math.PI;

export interface WalkthroughFrameState {
  stopIndex: number; // Current / arriving stop (1..12)
  displayStopIndex: number; // Stop shown in date badge & placard (1..12)
  tau: number; // Continuous 0..11 progress along the 12-stop rail
  step: number; // Construction step 0.55..11.0
  beat: WalkthroughBeat;
  plateOpacity: number; // 0..1 calibrated archival plate overlay opacity
  placardOpacity: number; // 0..1 vellum museum placard opacity
  activePhotoId: string | null; // "55" | "13" | ... | null
  playing: boolean;
  userOrbited: boolean;
  manualPlateHidden: boolean;
}

export interface WalkthroughVisualFrame {
  plateOpacity: number;
  placardOpacity: number;
  tau: number;
  step: number;
}

export interface EiffelControllerCallbacks {
  onReady?: () => void;
  onStepChange?: (step: number) => void;
  onPresetClear?: () => void;
  onContextLost?: (lost: boolean) => void;
  onWalkthroughState?: (state: WalkthroughFrameState) => void;
  onVisualFrame?: (frame: WalkthroughVisualFrame) => void;
}

export interface EiffelControllerOptions {
  reducedMotion?: boolean;
  initialPlateMode?: boolean;
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

const DEFAULT_PRESET = EIFFEL_PRESETS[0];

function detectSoftwareGl(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class EiffelWorldController {
  private container: HTMLElement;
  private callbacks: EiffelControllerCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private disposed = false;
  private frameId = 0;
  private resizeObserver: ResizeObserver;

  private towerController: TowerModelController | null = null;
  private parisWorld: ReturnType<typeof createParis1889World> | null = null;
  private atmosphere: ReturnType<typeof createAtmosphereController> | null = null;
  private constraints: ReturnType<typeof createViewportConstraints> | null = null;

  private step = 11.0;
  private lastShadowStep = -1;
  private mood: EiffelMood = "day";
  private reducedMotion = false;
  private lastTickMs = performance.now();
  private elapsedSec = 0;
  private lastPoseReportMs = 0;
  private lastDiscreteKey = "";

  // Authentic 4-Beat Calibrated Walkthrough State Machine
  private walkthroughActive = false; // true once initial 1884 plate settles
  private playing = false;
  private beat: WalkthroughBeat = "hold_d";
  private beatTimer = 0;
  private beatDuration = 1.5;
  private fromStopIndex = 1;
  private toStopIndex = 1;
  private displayStopIndex = 1;
  private tau = 0;
  private plateOpacity = 1;
  private placardOpacity = 1;
  private activePhotoId: string | null = "55";
  private userOrbited = false;
  private manualPlateHidden = false;
  private plateFadeTarget: number | null = null;
  private currentCanonical: CanonicalOpticalState | null = null;
  private flightStartCanonical: CanonicalOpticalState | null = null;
  private flightEndCanonical: CanonicalOpticalState | null = null;
  private flightFromStep = 11.0;
  private flightToStep = 11.0;
  private flightAutoContinue = true;

  // Free orbit / preset camera animation (Stop 12 & user interaction)
  private turntable = false;
  private activePresetId = "overview";
  private unconstrainedPreset = false;
  private camGoalPos: THREE.Vector3 | null = null;
  private camGoalTarget: THREE.Vector3 | null = null;
  private camGoalFov: number | null = null;

  private handleContextLost: (e: Event) => void;
  private handleContextRestored: () => void;
  private handleControlsStart: () => void;

  constructor(
    container: HTMLElement,
    callbacks: EiffelControllerCallbacks = {},
    optionsOrReduced: boolean | EiffelControllerOptions = false,
  ) {
    const opts: EiffelControllerOptions =
      typeof optionsOrReduced === "boolean" ? { reducedMotion: optionsOrReduced } : optionsOrReduced;
    const reducedMotion = !!opts.reducedMotion;
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();
    this.reducedMotion = reducedMotion;
    const startsInPlate = !!opts.initialPlateMode;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.className = "block h-full w-full outline-none";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D 1889 Eiffel Tower");
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.45, 4500);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.065;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.85;
    this.controls.panSpeed = 0.58;
    this.controls.screenSpacePanning = false;

    if (startsInPlate) {
      this.fromStopIndex = 1;
      this.toStopIndex = 1;
      this.displayStopIndex = 1;
      this.tau = 0;
      this.step = 11.0;
      this.beat = "hold_d";
      this.plateOpacity = 1;
      this.placardOpacity = 1;
      this.activePhotoId = "55";
      this.turntable = false;
      this.controls.enabled = false;
      const stop1Cam = computeStopCanonicalCamera(1, w, h);
      this.applyCanonicalState(stop1Cam, w, h);
    } else {
      this.fromStopIndex = 12;
      this.toStopIndex = 12;
      this.displayStopIndex = 12;
      this.tau = 11;
      this.step = 11.0;
      this.beat = "finale_orbit";
      this.plateOpacity = 0;
      this.placardOpacity = 1;
      this.activePhotoId = null;
      this.turntable = !reducedMotion;
      this.controls.enabled = true;
      this.camera.position.set(...HERO_FINALE_CAMERA.position);
      this.controls.target.set(...HERO_FINALE_CAMERA.target);
      this.camera.fov = HERO_FINALE_CAMERA.fovYDeg;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    }

    this.handleControlsStart = () => {
      this.camGoalPos = null;
      this.camGoalTarget = null;
      this.camGoalFov = null;
      this.turntable = false;
      this.unconstrainedPreset = false;
      this.activePresetId = "custom";
      if (this.playing || this.plateOpacity > 0.01) {
        this.playing = false;
        this.userOrbited = true;
        this.manualPlateHidden = true;
        this.plateFadeTarget = 0;
        this.camera.clearViewOffset();
        this.camera.updateProjectionMatrix();
        this.emitWalkthroughState(true);
      }
      this.callbacks.onPresetClear?.();
    };
    this.controls.addEventListener("start", this.handleControlsStart);

    this.handleContextLost = (e: Event) => {
      e.preventDefault();
      this.stopLoop();
      this.callbacks.onContextLost?.(true);
    };
    this.handleContextRestored = () => {
      this.callbacks.onContextLost?.(false);
      this.startLoop();
    };
    this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.handleContextRestored);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    void this.initScene(reducedMotion, startsInPlate);
  }

  private async initScene(reducedMotion: boolean, startsInPlate: boolean) {
    try {
      const atmosphere = createAtmosphereController({
        THREE,
        scene: this.scene,
        renderer: this.renderer,
        isSoftwareWebGL: this.isSoftwareGl,
      });
      if (this.isSoftwareGl && this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = false;
      }
      this.atmosphere = atmosphere;

      await yieldFrame();
      if (this.disposed) return;

      const parisWorld = createParis1889World({
        THREE,
        scene: this.scene,
        skipOverwrittenFloorMaps: true,
      });
      this.parisWorld = parisWorld;
      parisWorld.setMood?.(this.mood);
      atmosphere.setMood(this.mood, { immediate: true });

      await yieldFrame();
      if (this.disposed) return;

      const towerController = new TowerModelController({
        THREE,
        scene: this.scene,
        renderer: this.renderer,
      });
      await towerController.init();
      if (this.disposed) return;
      this.towerController = towerController;

      await yieldFrame();
      if (this.disposed) return;

      upgradeWorldFloorAndSurfaceMaterials(parisWorld, THREE);
      upgradeTowerMaterialsAndDecks(towerController, THREE, towerController.materials);
      enforceZeroEmissiveAcrossScene(this.scene);

      await yieldFrame();
      if (this.disposed) return;

      installRuntimeFpsAndDrawCallOptimizations({
        THREE,
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        towerController,
        parisWorld,
        atmosphere,
        isSoftwareWebGL: this.isSoftwareGl,
        prewarmMode: this.isSoftwareGl ? "manual" : "idle",
      });

      this.constraints = createViewportConstraints({
        THREE,
        camera: this.camera,
        controls: this.controls,
      });

      this.installTelephotoFogCompensation();

      this.applyStep(this.step, true);
      if (startsInPlate) {
        const w = Math.max(this.container.clientWidth, 1);
        const h = Math.max(this.container.clientHeight, 1);
        this.applyCanonicalState(computeStopCanonicalCamera(this.toStopIndex, w, h), w, h);
      } else if (reducedMotion) {
        this.turntable = false;
      }

      await yieldFrame();
      if (this.disposed) return;

      this.renderNow();
      this.emitWalkthroughState(true);
      this.callbacks.onReady?.();
      this.startLoop();
    } catch (err) {
      console.error("[EiffelWorldController] Failed to initialize 3D Tower:", err);
      this.callbacks.onReady?.();
    }
  }

  private getStageSize(): { w: number; h: number } {
    return {
      w: Math.max(this.container.clientWidth, 1),
      h: Math.max(this.container.clientHeight, 1),
    };
  }

  /**
   * Applies a canonical optical state (`position`, `quaternion`, `tanHalfY`, `shiftX`, `shiftY`)
   * directly to `this.camera`, guaranteeing 0.000px registration with the centered archival glass plate.
   */
  private applyCanonicalState(state: CanonicalOpticalState, vpWidth: number, vpHeight: number) {
    const W = Math.max(1, vpWidth);
    const H = Math.max(1, vpHeight);
    this.currentCanonical = state;

    this.camera.position.set(state.position[0], state.position[1], state.position[2]);
    this.camera.quaternion.set(
      state.quaternion[0],
      state.quaternion[1],
      state.quaternion[2],
      state.quaternion[3],
    );
    const fovDeg = clamp(2.0 * Math.atan(Math.max(1e-5, state.tanHalfY)) * RAD2DEG, 0.8, 172.0);
    this.camera.fov = fovDeg;
    this.camera.aspect = W / H;
    this.camera.near = clamp(state.near, 0.25, 1200);
    this.camera.far = Math.max(4500, state.far);

    if (Math.abs(state.shiftX) < 1e-6 && Math.abs(state.shiftY) < 1e-6) {
      this.camera.clearViewOffset();
    } else {
      const offX = 0.5 * W * state.shiftX;
      const offY = -0.5 * H * state.shiftY;
      this.camera.setViewOffset(W, H, offX, offY, W, H);
    }

    this.controls.target.set(state.focalPoint[0], state.focalPoint[1], state.focalPoint[2]);
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
  }

  private applyStep(nextStep: number, forceShadow = false) {
    const clamped = clamp(nextStep, 0, 11);
    this.step = clamped;
    this.towerController?.setStep(clamped);
    this.parisWorld?.setStep?.(clamped);
    this.atmosphere?.setStep?.(clamped);
    // Throttle expensive full-scene shadow map rebuilds during Beat B flights for locked 60fps
    if (!this.isSoftwareGl && (forceShadow || Math.abs(clamped - this.lastShadowStep) >= 0.48)) {
      this.lastShadowStep = clamped;
      this.atmosphere?.requestShadowUpdate?.();
    }
    this.callbacks.onStepChange?.(clamped);
  }

  private renderNow() {
    if (this.disposed) return;
    this.atmosphere?.update?.(0);
    this.renderer.render(this.scene, this.camera);
    this.updatePoseAttribute(true);
  }

  private emitVisualFrame() {
    this.callbacks.onVisualFrame?.({
      plateOpacity: this.plateOpacity,
      placardOpacity: this.placardOpacity,
      tau: this.tau,
      step: this.step,
    });
  }

  private emitWalkthroughState(force = false) {
    // Always push 60fps continuous visual values directly to DOM refs (zero React re-render overhead!)
    this.emitVisualFrame();

    const discreteKey = `${this.toStopIndex}|${this.displayStopIndex}|${this.beat}|${this.activePhotoId ?? ""}|${this.playing ? 1 : 0}|${this.userOrbited ? 1 : 0}|${this.manualPlateHidden ? 1 : 0}`;
    if (!force && discreteKey === this.lastDiscreteKey) return;
    this.lastDiscreteKey = discreteKey;

    this.callbacks.onWalkthroughState?.({
      stopIndex: this.toStopIndex,
      displayStopIndex: this.displayStopIndex,
      tau: this.tau,
      step: this.step,
      beat: this.beat,
      plateOpacity: this.plateOpacity,
      placardOpacity: this.placardOpacity,
      activePhotoId: this.activePhotoId,
      playing: this.playing,
      userOrbited: this.userOrbited,
      manualPlateHidden: this.manualPlateHidden,
    });
  }

  /**
   * Zero-leak telephoto fog & South Expo dome compensation ported from
   * `walkthrough_camera_choreography.js`: shifts `scene.fog.near/far` and
   * `parisWorld.mistUniforms` only inside `onBeforeRender` -> `onAfterRender`
   * so Stop 1 (#55 at z=3600m) reveals a razor-sharp 300-meter 3D Eiffel Tower!
   */
  private installTelephotoFogCompensation() {
    const targetScene = this.scene;
    const prevBefore = targetScene.onBeforeRender;
    const prevAfter = targetScene.onAfterRender;
    let cachedExpoGrand: THREE.Object3D | null | undefined = undefined;
    let saved: {
      fogNear: number;
      fogFar: number;
      camFogInner: number | null;
      camFogOuter: number | null;
      inkCamInner: number | null;
      inkCamOuter: number | null;
      hidExpoGrand: boolean;
    } | null = null;

    targetScene.onBeforeRender = (renderer, scn, cam, geometry, material, group) => {
      const fog = scn?.fog;
      if (cam && fog instanceof THREE.Fog && !saved) {
        const rCamXZ = Math.hypot(cam.position.x, cam.position.z);
        if (rCamXZ > 540.0) {
          const teleShift = Math.max(0.0, rCamXZ - 480.0);
          const mu = (this.parisWorld as unknown as {
            mistUniforms?: {
              uCamFogInner?: { value: number };
              uCamFogOuter?: { value: number };
              uInkCamFadeInner?: { value: number };
              uInkCamFadeOuter?: { value: number };
            };
          } | null)?.mistUniforms;
          if (cachedExpoGrand === undefined) {
            cachedExpoGrand = scn.getObjectByName("cdm_dome_central_machines") ?? null;
          }
          const hideSouthExpo = cam.position.z > 820.0 && Boolean(cachedExpoGrand?.visible);
          saved = {
            fogNear: fog.near,
            fogFar: fog.far,
            camFogInner: mu?.uCamFogInner ? mu.uCamFogInner.value : null,
            camFogOuter: mu?.uCamFogOuter ? mu.uCamFogOuter.value : null,
            inkCamInner: mu?.uInkCamFadeInner ? mu.uInkCamFadeInner.value : null,
            inkCamOuter: mu?.uInkCamFadeOuter ? mu.uInkCamFadeOuter.value : null,
            hidExpoGrand: hideSouthExpo,
          };
          if (hideSouthExpo && cachedExpoGrand) {
            cachedExpoGrand.visible = false;
          }
          if (rCamXZ > 600.0) {
            fog.near = saved.fogNear + teleShift;
            fog.far = saved.fogFar + teleShift;
            if (mu?.uCamFogInner && saved.camFogInner !== null) mu.uCamFogInner.value = saved.camFogInner + teleShift;
            if (mu?.uCamFogOuter && saved.camFogOuter !== null) mu.uCamFogOuter.value = saved.camFogOuter + teleShift;
            if (mu?.uInkCamFadeInner && saved.inkCamInner !== null) mu.uInkCamFadeInner.value = saved.inkCamInner + teleShift;
            if (mu?.uInkCamFadeOuter && saved.inkCamOuter !== null) mu.uInkCamFadeOuter.value = saved.inkCamOuter + teleShift;
          }
        }
      }
      if (typeof prevBefore === "function") {
        prevBefore.call(targetScene, renderer, scn, cam, geometry, material, group);
      }
    };

    targetScene.onAfterRender = (renderer, scn, cam, geometry, material, group) => {
      const fog = scn?.fog;
      if (saved && fog instanceof THREE.Fog) {
        if (saved.hidExpoGrand && cachedExpoGrand) {
          cachedExpoGrand.visible = true;
        }
        fog.near = saved.fogNear;
        fog.far = saved.fogFar;
        const mu = (this.parisWorld as unknown as {
          mistUniforms?: {
            uCamFogInner?: { value: number };
            uCamFogOuter?: { value: number };
            uInkCamFadeInner?: { value: number };
            uInkCamFadeOuter?: { value: number };
          };
        } | null)?.mistUniforms;
        if (mu?.uCamFogInner && saved.camFogInner !== null) mu.uCamFogInner.value = saved.camFogInner;
        if (mu?.uCamFogOuter && saved.camFogOuter !== null) mu.uCamFogOuter.value = saved.camFogOuter;
        if (mu?.uInkCamFadeInner && saved.inkCamInner !== null) mu.uInkCamFadeInner.value = saved.inkCamInner;
        if (mu?.uInkCamFadeOuter && saved.inkCamOuter !== null) mu.uInkCamFadeOuter.value = saved.inkCamOuter;
        saved = null;
      }
      if (typeof prevAfter === "function") {
        prevAfter.call(targetScene, renderer, scn, cam, geometry, material, group);
      }
    };
  }

  /**
   * Called once the lifted 1884 plate settles cleanly at screen center (replacing the old "EXPLORE ->" click).
   * Holds briefly on Stop 1 (#55) with left placard & dark museum bar, then launches the exact 4-Beat
   * calibrated exhibition walkthrough:
   *   Hold D (Stop 1) -> Beat A (fade out 1884 plate to reveal aligned 300m 3D Tower) ->
   *   Beat B (fly down Champ-de-Mars into West Pier while rewinding step 11.0 -> 0.55) ->
   *   Beat C (fade in aligned archival glass plate #13 over 3D caissons) -> Hold D -> ... -> Stop 12 Hero Orbit.
   */
  beginExhibitionFrom1884() {
    if (this.walkthroughActive) return;
    this.walkthroughActive = true;
    const { w, h } = this.getStageSize();
    const stop1 = getStopConfig(1);
    this.fromStopIndex = 1;
    this.toStopIndex = 1;
    this.displayStopIndex = 1;
    this.tau = 0;
    this.activePhotoId = stop1.photoId;
    this.plateOpacity = 1;
    this.placardOpacity = 1;
    this.userOrbited = false;
    this.manualPlateHidden = false;
    this.plateFadeTarget = null;
    this.controls.enabled = false;
    this.turntable = false;
    this.applyStep(stop1.step);
    this.applyCanonicalState(computeStopCanonicalCamera(1, w, h), w, h);

    this.beat = "hold_d";
    this.beatTimer = 0;
    this.beatDuration = this.reducedMotion ? 0.8 : stop1.holdDurationSec;
    this.playing = true;
    this.lastTickMs = performance.now();
    this.emitWalkthroughState(true);
    this.renderNow();
  }

  private startBeatAYield(fromStopIdx: number, nextStopIdx: number, autoContinue: boolean) {
    this.fromStopIndex = fromStopIdx;
    this.toStopIndex = nextStopIdx;
    this.flightAutoContinue = autoContinue;
    this.beat = "beat_a_yield";
    this.beatTimer = 0;
    this.beatDuration = this.reducedMotion ? 0.18 : BEAT_A_YIELD_SEC;
    this.controls.enabled = false;
    this.turntable = false;
    this.plateFadeTarget = null;
    this.emitWalkthroughState(true);
  }

  private startBeatBFlight(
    fromStopIdx: number,
    toStopIdx: number,
    {
      durationOverrideSec,
      autoContinue = true,
    }: { durationOverrideSec?: number; autoContinue?: boolean } = {},
  ) {
    const { w, h } = this.getStageSize();
    const fromCfg = getStopConfig(fromStopIdx);
    const toCfg = getStopConfig(toStopIdx);

    this.fromStopIndex = fromStopIdx;
    this.toStopIndex = toStopIdx;
    this.flightAutoContinue = autoContinue;
    this.userOrbited = false;
    this.manualPlateHidden = false;
    this.plateFadeTarget = null;
    this.plateOpacity = 0;
    this.placardOpacity = 0;
    this.controls.enabled = false;
    this.turntable = false;
    this.camGoalPos = null;
    this.camGoalTarget = null;
    this.camGoalFov = null;

    // Capture exact start canonical camera (either current canonical or current free Orbit camera)
    if (this.currentCanonical && !this.userOrbited) {
      this.flightStartCanonical = {
        ...this.currentCanonical,
        position: [...this.currentCanonical.position],
        quaternion: [...this.currentCanonical.quaternion],
        focalPoint: [...this.currentCanonical.focalPoint],
      };
    } else {
      this.flightStartCanonical = computeFreeCanonicalCamera(
        [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        [this.controls.target.x, this.controls.target.y, this.controls.target.z],
        this.camera.fov,
      );
    }

    this.flightEndCanonical = computeStopCanonicalCamera(toStopIdx, w, h);
    this.flightFromStep = this.step;
    this.flightToStep = toCfg.step;

    this.beat = "beat_b_flight";
    this.beatTimer = 0;
    const baseSec =
      typeof durationOverrideSec === "number"
        ? durationOverrideSec
        : fromCfg.flightDurationSec;
    this.beatDuration = this.reducedMotion ? 0.25 : Math.max(0.8, baseSec);
    this.emitWalkthroughState(true);
  }

  private enterStopLock(stopIdx: number) {
    const { w, h } = this.getStageSize();
    const cfg = getStopConfig(stopIdx);
    this.fromStopIndex = stopIdx;
    this.toStopIndex = stopIdx;
    this.displayStopIndex = stopIdx;
    this.tau = stopIdx - 1;
    this.applyStep(cfg.step, true);

    if (cfg.photoId) {
      this.activePhotoId = cfg.photoId;
      this.manualPlateHidden = false;
      this.plateFadeTarget = null;
      this.controls.enabled = false;
      this.turntable = false;
      this.applyCanonicalState(computeStopCanonicalCamera(stopIdx, w, h), w, h);
      this.beat = "beat_c_lock";
      this.beatTimer = 0;
      this.beatDuration = this.reducedMotion ? 0.16 : BEAT_C_LOCK_SEC;
    } else {
      // Stop 12: Hero 1889 3D Showcase Orbit (free OrbitControls enabled)
      this.activePhotoId = null;
      this.plateOpacity = 0;
      this.placardOpacity = 1;
      this.beat = "finale_orbit";
      this.playing = false;
      this.controls.enabled = true;
      this.turntable = !this.reducedMotion;
      this.camera.clearViewOffset();
      this.camera.position.set(...HERO_FINALE_CAMERA.position);
      this.controls.target.set(...HERO_FINALE_CAMERA.target);
      this.camera.fov = HERO_FINALE_CAMERA.fovYDeg;
      this.camera.near = 0.45;
      this.camera.far = 4500;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    }

    this.emitWalkthroughState(true);
    this.renderNow();
  }

  togglePlay() {
    this.walkthroughActive = true;
    this.plateFadeTarget = null;
    if (this.playing) {
      this.playing = false;
      // Allow immediate 3D drag-orbit when paused with no plate covering the canvas
      if (this.plateOpacity < 0.08) {
        this.controls.enabled = true;
      }
      this.emitWalkthroughState(true);
      return;
    }

    // Resume or restart from Stop 1 if at Stop 12 finale
    if (this.beat === "finale_orbit" || this.toStopIndex >= WALKTHROUGH_SCHEDULE.length) {
      this.jumpToStop(1, { autoPlayAfterLock: true, fastFlight: true });
      return;
    }

    // If user hid the plate manually on an archival stop, launch directly into Beat B to next stop
    if (this.manualPlateHidden && this.toStopIndex < WALKTHROUGH_SCHEDULE.length) {
      this.playing = true;
      this.startBeatBFlight(this.toStopIndex, this.toStopIndex + 1, { autoContinue: true });
      return;
    }

    this.playing = true;
    this.lastTickMs = performance.now();
    // If we were resting at the end of hold_d, move immediately into Beat A yield
    if (this.beat === "hold_d" && this.beatTimer >= this.beatDuration * 0.6) {
      this.startBeatAYield(this.toStopIndex, Math.min(12, this.toStopIndex + 1), true);
    } else {
      this.emitWalkthroughState(true);
    }
  }

  jumpToStop(
    stopIndex: number,
    {
      autoPlayAfterLock = false,
      fastFlight = true,
    }: { autoPlayAfterLock?: boolean; fastFlight?: boolean } = {},
  ) {
    this.walkthroughActive = true;
    const targetIdx = Math.max(1, Math.min(WALKTHROUGH_SCHEDULE.length, Math.round(stopIndex)));
    const wasPlaying = this.playing;
    this.playing = autoPlayAfterLock || wasPlaying;
    this.plateFadeTarget = null;
    this.manualPlateHidden = false;

    if (targetIdx === this.toStopIndex && this.beat === "hold_d" && !this.userOrbited) {
      // Already locked at this stop; restore its calibrated photo if hidden
      const cfg = getStopConfig(targetIdx);
      if (cfg.photoId) {
        this.activePhotoId = cfg.photoId;
        this.plateFadeTarget = 1;
        this.placardOpacity = 1;
        this.controls.enabled = false;
        const { w, h } = this.getStageSize();
        this.applyCanonicalState(computeStopCanonicalCamera(targetIdx, w, h), w, h);
        this.emitWalkthroughState(true);
        this.renderNow();
      }
      return;
    }

    const fromIdx = this.toStopIndex;
    const distStops = Math.abs(targetIdx - fromIdx);
    const flightSec = fastFlight
      ? clamp((1.35 + distStops * 0.28) / WALKTHROUGH_SPEED_MULTIPLIER, 1.0, 2.45)
      : getStopConfig(fromIdx).flightDurationSec;

    this.startBeatBFlight(fromIdx, targetIdx, {
      durationOverrideSec: flightSec,
      autoContinue: autoPlayAfterLock || wasPlaying,
    });
  }

  /**
   * Toggles between the calibrated archival glass plate overlay and live 3D inspection
   * at the exact same optical camera pose (`Reveal 3D` <-> `Show Plate`).
   */
  toggleReveal3D() {
    this.walkthroughActive = true;
    const cfg = getStopConfig(this.toStopIndex);
    if (!cfg.photoId) {
      // On Stop 12, jump back to Stop 1 (1884 Plate)
      this.jumpToStop(1, { autoPlayAfterLock: false, fastFlight: true });
      return;
    }

    this.playing = false;
    if (this.plateOpacity > 0.35 || this.plateFadeTarget === 1) {
      // Fade out archival glass plate -> reveal live 3D model underneath & enable OrbitControls!
      this.manualPlateHidden = true;
      this.plateFadeTarget = 0;
      this.placardOpacity = 1;
      this.controls.enabled = true;
      this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.controls.update();
    } else {
      // Restore pixel-aligned calibrated camera & fade archival glass plate back in!
      const { w, h } = this.getStageSize();
      this.manualPlateHidden = false;
      this.userOrbited = false;
      this.activePhotoId = cfg.photoId;
      this.controls.enabled = false;
      this.applyStep(cfg.step);
      this.applyCanonicalState(computeStopCanonicalCamera(this.toStopIndex, w, h), w, h);
      this.plateFadeTarget = 1;
      this.placardOpacity = 1;
    }
    this.emitWalkthroughState(true);
    this.renderNow();
  }

  setMood(mood: EiffelMood) {
    this.mood = mood;
    this.parisWorld?.setMood?.(mood);
    this.atmosphere?.setMood(mood, { immediate: true });
    this.towerController?.setNightFactor?.(mood === "night" ? 1 : mood === "dusk" ? 0.35 : 0);
    if (!this.isSoftwareGl) {
      this.atmosphere?.requestShadowUpdate?.();
    }
    this.renderNow();
  }

  setPreset(presetId: string, immediate = false) {
    const preset = EIFFEL_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET;
    this.playing = false;
    this.beat = "finale_orbit";
    this.toStopIndex = 12;
    this.displayStopIndex = 12;
    this.tau = 11;
    this.activePhotoId = null;
    this.plateOpacity = 0;
    this.placardOpacity = 1;
    this.activePresetId = preset.id;
    this.unconstrainedPreset = preset.id !== "overview";
    this.turntable = this.reducedMotion ? false : preset.turntable;
    this.controls.enabled = true;
    this.camera.clearViewOffset();
    this.applyStep(11.0);

    if (immediate || this.isSoftwareGl || this.reducedMotion) {
      this.camGoalPos = null;
      this.camGoalTarget = null;
      this.camGoalFov = null;
      const prevDamp = this.controls.enableDamping;
      this.controls.enableDamping = false;
      this.camera.position.set(...preset.position);
      this.controls.target.set(...preset.target);
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.controls.enableDamping = prevDamp;
      if (!this.unconstrainedPreset) {
        this.constraints?.enforce();
      }
      this.emitWalkthroughState(true);
      this.renderNow();
      return;
    }
    this.camGoalPos = new THREE.Vector3(...preset.position);
    this.camGoalTarget = new THREE.Vector3(...preset.target);
    this.camGoalFov = preset.fov;
    this.emitWalkthroughState(true);
  }

  resetView() {
    this.setPreset("overview", this.isSoftwareGl || this.reducedMotion);
  }

  resize() {
    if (this.disposed) return;
    const { w, h } = this.getStageSize();
    this.renderer.setSize(w, h, false);

    if (
      this.beat !== "finale_orbit" &&
      !this.userOrbited &&
      this.beat !== "beat_b_flight" &&
      getStopConfig(this.toStopIndex).photoId
    ) {
      this.applyCanonicalState(computeStopCanonicalCamera(this.toStopIndex, w, h), w, h);
    } else {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.renderNow();
  }

  private advanceWalkthrough(dt: number) {
    // Handle smooth manual Reveal 3D / Show Plate fade when paused
    if (this.plateFadeTarget !== null) {
      const rate = 2.6;
      const diff = this.plateFadeTarget - this.plateOpacity;
      if (Math.abs(diff) <= 0.02) {
        this.plateOpacity = this.plateFadeTarget;
        this.plateFadeTarget = null;
        this.emitWalkthroughState(true);
      } else {
        this.plateOpacity = clamp(this.plateOpacity + Math.sign(diff) * dt * rate, 0, 1);
        this.emitWalkthroughState();
      }
    }

    if (!this.walkthroughActive) return;

    // Beat B and Beat C ALWAYS run to completion (even for manual jumps!)
    const activeTransition =
      this.beat === "beat_a_yield" ||
      this.beat === "beat_b_flight" ||
      this.beat === "beat_c_lock";
    if (!this.playing && !activeTransition) return;

    const { w, h } = this.getStageSize();
    this.beatTimer += dt;

    if (this.beat === "hold_d") {
      this.plateOpacity = this.manualPlateHidden ? 0 : 1;
      this.placardOpacity = 1;
      if (this.playing && this.beatTimer >= this.beatDuration) {
        const nextIdx = this.toStopIndex + 1;
        if (nextIdx <= WALKTHROUGH_SCHEDULE.length) {
          this.startBeatAYield(this.toStopIndex, nextIdx, true);
        } else {
          this.playing = false;
          this.emitWalkthroughState(true);
        }
      }
      return;
    }

    if (this.beat === "beat_a_yield") {
      const u = clamp(this.beatTimer / Math.max(0.05, this.beatDuration), 0, 1);
      const fade = 1.0 - smoothstepCubic(u);
      this.plateOpacity = this.manualPlateHidden ? 0 : fade;
      this.placardOpacity = fade;
      this.emitWalkthroughState();

      if (u >= 1) {
        this.plateOpacity = 0;
        this.placardOpacity = 0;
        this.startBeatBFlight(this.fromStopIndex, this.toStopIndex, {
          autoContinue: this.flightAutoContinue,
        });
      }
      return;
    }

    if (this.beat === "beat_b_flight") {
      const u = clamp(this.beatTimer / Math.max(0.05, this.beatDuration), 0, 1);
      const fromCfg = getStopConfig(this.fromStopIndex);
      const toCfg = getStopConfig(this.toStopIndex);

      // Update continuous timeline tau smoothly from (fromStop - 1) -> (toStop - 1)
      const eTau = easeConstructionBeatB(u);
      this.tau = lerp(this.fromStopIndex - 1, this.toStopIndex - 1, eTau);

      // Update display stop date once approaching destination
      if (u >= 0.84 && this.displayStopIndex !== this.toStopIndex) {
        this.displayStopIndex = this.toStopIndex;
      }

      // Smoothly animate construction step (rewinds 11.0 -> 0.55 on Stop 1->2, builds up on Stops 2->9!)
      if (Math.abs(this.flightToStep - this.flightFromStep) > 1e-4) {
        const nextStep = lerp(this.flightFromStep, this.flightToStep, eTau);
        this.applyStep(nextStep);
      }

      // Interpolate calibrated optical camera continuously along flight path
      if (this.flightStartCanonical && this.flightEndCanonical) {
        const stateNow = interpolateCanonicalFlight(
          this.flightStartCanonical,
          this.flightEndCanonical,
          u,
          { fromPhotoId: fromCfg.photoId, toPhotoId: toCfg.photoId },
        );
        this.applyCanonicalState(stateNow, w, h);
      }

      this.plateOpacity = 0;
      this.placardOpacity = 0;
      this.emitWalkthroughState();

      if (u >= 1) {
        this.playing = this.flightAutoContinue && this.toStopIndex < WALKTHROUGH_SCHEDULE.length;
        this.enterStopLock(this.toStopIndex);
      }
      return;
    }

    if (this.beat === "beat_c_lock") {
      const u = clamp(this.beatTimer / Math.max(0.05, this.beatDuration), 0, 1);
      const fadeIn = smoothstepCubic(u);
      this.plateOpacity = fadeIn;
      this.placardOpacity = fadeIn;
      this.emitWalkthroughState();

      if (u >= 1) {
        this.plateOpacity = 1;
        this.placardOpacity = 1;
        this.beat = "hold_d";
        this.beatTimer = 0;
        this.beatDuration = this.reducedMotion ? 0.9 : getStopConfig(this.toStopIndex).holdDurationSec;
        this.emitWalkthroughState(true);
      }
    }
  }

  private updatePoseAttribute(force = false) {
    const now = performance.now();
    if (!force && now - this.lastPoseReportMs < 110) return;
    this.lastPoseReportMs = now;
    const p = this.camera.position;
    const t = this.controls.target;
    this.renderer.domElement.setAttribute(
      "data-camera-pose",
      `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}->${t.x.toFixed(1)},${t.y.toFixed(1)},${t.z.toFixed(1)}`,
    );
    this.renderer.domElement.setAttribute("data-mood", this.mood);
    this.renderer.domElement.setAttribute("data-step", this.step.toFixed(2));
    this.renderer.domElement.setAttribute("data-beat", this.beat);
    this.renderer.domElement.setAttribute("data-preset", this.activePresetId);
  }

  private startLoop() {
    if (this.disposed || this.frameId) return;
    this.lastTickMs = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - this.lastTickMs) / 1000);
      // Allow wall-clock walkthrough progression in headless software WebGL while keeping smooth GPU frames
      const walkthroughDt = Math.min(this.isSoftwareGl ? 1.8 : 0.08, rawDt);
      const dt = Math.min(0.08, rawDt);
      this.lastTickMs = now;
      this.elapsedSec += dt;

      this.advanceWalkthrough(walkthroughDt);

      // Handle free OrbitControls / Hero Finale turntable when not in calibrated portal lock
      if (this.beat === "finale_orbit" || this.userOrbited || (this.controls.enabled && this.plateOpacity < 0.05)) {
        if (this.camGoalPos && this.camGoalTarget) {
          this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camGoalPos.x, 10.5, dt);
          this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camGoalPos.y, 10.5, dt);
          this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camGoalPos.z, 10.5, dt);
          this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.camGoalTarget.x, 10.5, dt);
          this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.camGoalTarget.y, 10.5, dt);
          this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.camGoalTarget.z, 10.5, dt);
          if (this.camGoalFov !== null) {
            this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.camGoalFov, 10.5, dt);
            this.camera.updateProjectionMatrix();
          }
          if (
            this.camera.position.distanceTo(this.camGoalPos) < 0.65 &&
            this.controls.target.distanceTo(this.camGoalTarget) < 0.45
          ) {
            this.camera.position.copy(this.camGoalPos);
            this.controls.target.copy(this.camGoalTarget);
            if (this.camGoalFov !== null) {
              this.camera.fov = this.camGoalFov;
              this.camera.updateProjectionMatrix();
            }
            this.camGoalPos = null;
            this.camGoalTarget = null;
            this.camGoalFov = null;
          }
        } else if (this.turntable && !this.isSoftwareGl) {
          const offsetX = this.camera.position.x - this.controls.target.x;
          const offsetZ = this.camera.position.z - this.controls.target.z;
          const angle = dt * 0.08;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          this.camera.position.x = this.controls.target.x + offsetX * cosA - offsetZ * sinA;
          this.camera.position.z = this.controls.target.z + offsetX * sinA + offsetZ * cosA;
        }
        this.controls.update();
        if (!this.unconstrainedPreset && this.beat === "finale_orbit") {
          this.constraints?.enforce();
        }
      }

      this.atmosphere?.update?.(dt);
      this.parisWorld?.update?.(dt, this.elapsedSec);
      this.towerController?.update?.(dt, this.elapsedSec);
      this.renderer.render(this.scene, this.camera);
      this.updatePoseAttribute();

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = typeof gl.fenceSync === "function" ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 8);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 90);
      }
    };
    this.frameId = window.setTimeout(poll, 8);
  }

  private stopLoop() {
    if (!this.frameId) return;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.frameId = 0;
  }

  dispose() {
    this.disposed = true;
    this.stopLoop();
    this.resizeObserver.disconnect();
    this.controls.removeEventListener("start", this.handleControlsStart);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.handleContextRestored);

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.InstancedMesh) {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m?.dispose?.());
        } else {
          obj.material?.dispose?.();
        }
      }
    });
    this.towerController?.dispose?.();
    this.parisWorld?.dispose?.();
    this.atmosphere?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
