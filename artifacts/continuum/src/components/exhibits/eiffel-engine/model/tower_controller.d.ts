export class TowerModelController {
  materials: Record<string, unknown> | null;
  rootGroup: unknown;
  step: number;
  constructor(opts: { THREE: unknown; scene: unknown; renderer?: unknown });
  init(): Promise<void>;
  setStep(step: number): void;
  getStep(): number;
  setNightFactor?(factor: number): void;
  update?(dtSec: number, elapsedSec: number): void;
  dispose?(): void;
}
