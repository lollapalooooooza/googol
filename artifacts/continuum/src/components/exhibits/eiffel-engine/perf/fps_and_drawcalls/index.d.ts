export function installRuntimeFpsAndDrawCallOptimizations(opts: {
  THREE: unknown;
  scene: unknown;
  camera: unknown;
  renderer: unknown;
  towerController: unknown;
  parisWorld: unknown;
  atmosphere?: unknown;
  isSoftwareWebGL?: boolean;
  prewarmMode?: "idle" | "immediate" | "manual";
}): {
  ensureShadersPrewarmed?(): void;
};
