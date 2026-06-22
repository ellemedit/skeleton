/**
 * Core data types shared across the renderer.
 *
 * These types are intentionally free of any three.js imports so that the
 * motion/pose logic stays pure and can be unit-tested in Node without a WebGL
 * context (see scripts/verify.ts).
 */

/** A rotation expressed as Euler angles in **degrees**, order XYZ. */
export type EulerDeg = readonly [x: number, y: number, z: number];

/** A position/vector in meters. */
export type Vec3 = readonly [x: number, y: number, z: number];

/**
 * A pose is a sparse map from joint name to its absolute local rotation.
 * Joints that are not listed are assumed to be at their rest rotation
 * `[0, 0, 0]` (the neutral standing build).
 */
export type Pose = Readonly<Record<string, EulerDeg>>;

/**
 * Per-muscle activation level in the range `[0, 1]`. Muscles not listed are
 * treated as fully relaxed (`0`). Drives both the highlight color/intensity
 * and the contraction "bulge" of a muscle.
 */
export type MuscleActivation = Readonly<Record<string, number>>;

/** A single authored keyframe of an exercise. */
export interface Keyframe {
  /** Normalized time within the motion, `0..1`. */
  readonly t: number;
  /** Short human-readable phase label, e.g. "bottom", "lockout". */
  readonly label: string;
  /** Joint rotations at this instant. */
  readonly pose: Pose;
  /** Muscle activation at this instant. */
  readonly muscles: MuscleActivation;
  /** World position of the whole figure (pelvis root). Defaults to origin. */
  readonly root?: Vec3;
  /** World rotation of the whole figure, in degrees. Defaults to upright. */
  readonly rootRot?: Vec3;
}

/** The interpolated state produced by the animator for a given time. */
export interface MotionSample {
  readonly pose: Pose;
  readonly muscles: MuscleActivation;
  readonly root: Vec3;
  readonly rootRot: Vec3;
  readonly label: string;
  /** Normalized progress through the motion, `0..1`. */
  readonly progress: number;
}

/** How muscle activation is mapped to color. */
export type ColorMode = "heatmap" | "accent";
