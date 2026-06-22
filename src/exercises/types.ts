import type { Object3D } from "three";
import type { Mannequin } from "../anatomy/Mannequin";
import type { Keyframe, Vec3 } from "../anatomy/types";
import type { LoopMode } from "../motion/Animator";

/** Suggested camera framing for an exercise. */
export interface CameraHint {
  target: Vec3;
  position: Vec3;
}

/** A live exercise: equipment placed in the scene plus a per-frame glue hook. */
export interface ExerciseInstance {
  /** Called every frame, after the pose is applied, to attach equipment to the body. */
  update(): void;
  /** Remove any equipment this exercise added to the scene. */
  dispose(): void;
  readonly camera: CameraHint;
}

/** A self-contained, authored lift: keyframes plus its scene setup. */
export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly nameKo: string;
  readonly description: string;
  /** Duration of one pass (eccentric or concentric) in seconds. */
  readonly duration: number;
  readonly loop: LoopMode;
  readonly keyframes: Keyframe[];
  /** Build equipment and return a per-frame instance. */
  setup(scene: Object3D, mannequin: Mannequin): ExerciseInstance;
}
