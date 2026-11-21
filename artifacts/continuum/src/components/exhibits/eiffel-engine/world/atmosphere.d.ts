export function createAtmosphereController(opts: {
  THREE: unknown;
  scene: unknown;
  renderer: unknown;
  isSoftwareWebGL?: boolean;
}): {
  setMood(mood: string, opts?: { immediate?: boolean }): string;
  getMood(): string;
  setStep?(step: number): void;
  requestShadowUpdate?(): void;
  isTransitioning?(): boolean;
  update?(dt?: number): void;
  dispose?(): void;
};

export function enforceZeroEmissiveAcrossScene(scene: unknown): void;
