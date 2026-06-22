/**
 * Myo — a stylized muscle-motion mannequin renderer.
 *
 * Public surface: build a Mannequin, drive it with an Animator (or an authored
 * Exercise), and render it with the Stage. Equipment helpers attach barbells
 * and dumbbells to the figure.
 */
export { Stage } from "./core/Stage";
export type { CameraHint } from "./core/Stage";
export * as colors from "./core/colors";

export { Mannequin } from "./anatomy/Mannequin";
export { Muscle } from "./anatomy/Muscle";
export { MUSCLE_INFO, MUSCLE_IDS, BONES, MUSCLES } from "./anatomy/rig";
export type { MuscleId, MuscleRegion, MuscleInfo } from "./anatomy/rig";
export type {
  Pose,
  EulerDeg,
  Vec3,
  MuscleActivation,
  Keyframe,
  MotionSample,
  ColorMode,
} from "./anatomy/types";

export { Animator } from "./motion/Animator";
export type { LoopMode, AnimatorOptions } from "./motion/Animator";

export { Barbell } from "./equipment/Barbell";
export { Dumbbell } from "./equipment/Dumbbell";
export { Bench } from "./equipment/Bench";

export { EXERCISES, squat, benchPress, deadlift, dumbbellCurl } from "./exercises";
export type { Exercise, ExerciseInstance } from "./exercises";

// Rigged human-model rendering (loads a GLB, retargets the rig poses, paints
// muscle activation onto the skin).
export { HumanFigure } from "./human/HumanFigure";
export { Retargeter } from "./human/retarget";
export type { ArmPose } from "./human/retarget";
export { muscleGroupOf, muscleEmissive } from "./human/muscleGroups";
export { armPoseFor, groundFor, cameraFor } from "./human/lifts";
