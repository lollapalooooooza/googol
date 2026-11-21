export function createParis1889World(opts: {
  THREE: unknown;
  scene: unknown;
  skipOverwrittenFloorMaps?: boolean;
}): {
  setStep?(step: number): void;
  setMood?(mood: string): void;
  setEdgesVisible?(visible: boolean): void;
  update?(dt?: number, elapsedSec?: number): void;
  dispose?(): void;
};
