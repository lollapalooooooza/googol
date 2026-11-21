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

export interface EiffelControllerCallbacks {
  onReady?: () => void;
  onStepChange?: (step: number) => void;
  onPresetClear?: () => void;
  onContextLost?: (lost: boolean) => void;
}

export interface EiffelControllerOptions {
  reducedMotion?: boolean;
  initialPlateMode?: boolean;
}

const DEFAULT_PRESET = EIFFEL_PRESETS[0];
const ARCHIVAL_HORIZON_POSE = {
  position: [0, 56, -290] as [number, number, number],
  target: [0, 142, 180] as [number, number, number],
  fov: 44,
};

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
  private playing = false;
  private turntable = true;
  private reducedMotion = false;
  private plateMode = false;
  private activePresetId = "overview";
  private unconstrainedPreset = false;
  private mood: EiffelMood = "day";
  private lastTickMs = performance.now();
  private elapsedSec = 0;
  private lastPoseReportMs = 0;
  private lastStepReportMs = 0;

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
    this.plateMode = !!opts.initialPlateMode;
    this.turntable = !reducedMotion && !this.plateMode;

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

    const startPose = this.plateMode ? ARCHIVAL_HORIZON_POSE : DEFAULT_PRESET;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(startPose.fov, w / h, 0.5, 4500);
    this.camera.position.set(...startPose.position);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.065;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.85;
    this.controls.panSpeed = 0.58;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(...startPose.target);
    this.controls.update();

    this.handleControlsStart = () => {
      this.camGoalPos = null;
      this.camGoalTarget = null;
      this.camGoalFov = null;
      this.turntable = false;
      this.unconstrainedPreset = false;
      this.activePresetId = "custom";
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

    void this.initScene(reducedMotion);
  }

  private async initScene(reducedMotion: boolean) {
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

      const parisWorld = createParis1889World({
        THREE,
        scene: this.scene,
        skipOverwrittenFloorMaps: true,
      });
      this.parisWorld = parisWorld;
      parisWorld.setMood?.(this.mood);
      atmosphere.setMood(this.mood, { immediate: true });

      const towerController = new TowerModelController({
        THREE,
        scene: this.scene,
        renderer: this.renderer,
      });
      await towerController.init();
      if (this.disposed) return;
      this.towerController = towerController;

      upgradeWorldFloorAndSurfaceMaterials(parisWorld, THREE);
      upgradeTowerMaterialsAndDecks(towerController, THREE, towerController.materials);
      enforceZeroEmissiveAcrossScene(this.scene);

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

      this.applyStep(this.step);
      this.syncTowerVisibility();
      if (this.plateMode) {
        this.camera.position.set(...ARCHIVAL_HORIZON_POSE.position);
        this.controls.target.set(...ARCHIVAL_HORIZON_POSE.target);
        this.controls.update();
      } else if (this.activePresetId !== "custom" && this.activePresetId !== "overview") {
        this.setPreset(this.activePresetId, true);
      }
      if (reducedMotion) {
        this.turntable = false;
      }
      this.renderNow();
      this.callbacks.onReady?.();
      this.startLoop();
    } catch (err) {
      console.error("[EiffelWorldController] Failed to initialize 3D Tower:", err);
      this.callbacks.onReady?.();
    }
  }

  private syncTowerVisibility() {
    const root = (this.towerController as unknown as { rootGroup?: THREE.Object3D } | null)?.rootGroup;
    if (root) {
      root.visible = !this.plateMode;
    }
  }

  private renderNow() {
    if (this.disposed) return;
    this.atmosphere?.update?.(0);
    this.renderer.render(this.scene, this.camera);
    this.updatePoseAttribute(true);
  }

  private applyStep(nextStep: number) {
    const clamped = Math.max(0, Math.min(11, nextStep));
    this.step = clamped;
    this.towerController?.setStep(clamped);
    // Keep 1889 Exposition grounds framed cleanly during the 1884 blueprint backdrop
    this.parisWorld?.setStep?.(this.plateMode ? 11.0 : clamped);
    this.atmosphere?.setStep?.(this.plateMode ? 11.0 : clamped);
    if (!this.isSoftwareGl) {
      this.atmosphere?.requestShadowUpdate?.();
    }
  }

  setExhibitionPlateMode(active: boolean, { startStep }: { startStep?: number } = {}) {
    this.plateMode = active;
    this.syncTowerVisibility();
    if (active) {
      this.playing = false;
      this.turntable = false;
      this.parisWorld?.setStep?.(11.0);
      this.atmosphere?.setStep?.(11.0);
      this.camGoalPos = null;
      this.camGoalTarget = null;
      this.camGoalFov = null;
      this.camera.position.set(...ARCHIVAL_HORIZON_POSE.position);
      this.controls.target.set(...ARCHIVAL_HORIZON_POSE.target);
      this.camera.fov = ARCHIVAL_HORIZON_POSE.fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.renderNow();
      return;
    }
    if (typeof startStep === "number") {
      this.applyStep(startStep);
    } else {
      this.applyStep(this.step);
    }
    this.setPreset("overview", this.isSoftwareGl || this.reducedMotion);
  }

  setStep(step: number) {
    if (this.plateMode) {
      this.plateMode = false;
      this.syncTowerVisibility();
    }
    this.applyStep(step);
    this.renderNow();
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
    if (playing) {
      if (this.plateMode) {
        this.plateMode = false;
        this.syncTowerVisibility();
      }
      this.lastTickMs = performance.now();
      if (this.step >= 10.95) {
        this.applyStep(0.35);
        this.callbacks.onStepChange?.(0.35);
        this.renderNow();
      }
    }
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
    this.activePresetId = preset.id;
    this.unconstrainedPreset = preset.id !== "overview";
    this.turntable = this.reducedMotion ? false : preset.turntable;
    if (immediate || this.isSoftwareGl || this.reducedMotion) {
      this.camGoalPos = null;
      this.camGoalTarget = null;
      this.camGoalFov = null;
      const prevDamp = this.controls.enableDamping;
      this.controls.enableDamping = false;
      this.camera.position.set(...preset.position);
      this.controls.target.set(...preset.target);
      if (this.camera.fov !== preset.fov) {
        this.camera.fov = preset.fov;
        this.camera.updateProjectionMatrix();
      }
      this.controls.update();
      this.controls.enableDamping = prevDamp;
      if (!this.unconstrainedPreset) {
        this.constraints?.enforce();
      }
      this.renderNow();
      return;
    }
    this.camGoalPos = new THREE.Vector3(...preset.position);
    this.camGoalTarget = new THREE.Vector3(...preset.target);
    this.camGoalFov = preset.fov;
  }

  resetView() {
    this.setStep(11.0);
    this.callbacks.onStepChange?.(11.0);
    this.setPreset("overview", this.isSoftwareGl || this.reducedMotion);
  }

  resize() {
    if (this.disposed) return;
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderNow();
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
    this.renderer.domElement.setAttribute("data-preset", this.activePresetId);
  }

  private startLoop() {
    if (this.disposed || this.frameId) return;
    this.lastTickMs = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - this.lastTickMs) / 1000);
      const dt = Math.min(0.08, rawDt);
      this.lastTickMs = now;
      this.elapsedSec += dt;

      if (this.playing) {
        const playDt = Math.min(this.isSoftwareGl ? 0.65 : 0.08, rawDt);
        const next = Math.min(11.0, this.step + playDt * 0.85);
        this.applyStep(next);
        if (now - this.lastStepReportMs > 90 || next >= 11.0) {
          this.lastStepReportMs = now;
          this.callbacks.onStepChange?.(next);
        }
        if (next >= 11.0) {
          this.playing = false;
        }
      }

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
      if (!this.unconstrainedPreset) {
        this.constraints?.enforce();
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
