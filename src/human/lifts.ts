/**
 * Per-exercise settings for driving the rigged human model: arm poses (authored
 * directly on the Mixamo rig, since arms don't retarget cleanly from the
 * A-pose source) and whether to ground the figure by its feet. Shared by the
 * headless renderer and the browser demo.
 */
import type { ArmPose } from "./retarget";

export const ARM_POSES: Record<string, ArmPose> = {
  squat: {
    mixamorigLeftArm: [0, 0, -32], mixamorigRightArm: [0, 0, 32],
    mixamorigLeftForeArm: [0, -150, 0], mixamorigRightForeArm: [0, 150, 0],
  },
  bench: { mixamorigLeftArm: [0, 0, -78], mixamorigRightArm: [0, 0, 78] },
  deadlift: { mixamorigLeftArm: [0, 0, -80], mixamorigRightArm: [0, 0, 80] },
  curl: {
    mixamorigLeftArm: [0, 0, -72], mixamorigRightArm: [0, 0, 72],
    mixamorigLeftForeArm: [0, -120, 0], mixamorigRightForeArm: [0, 120, 0],
  },
};

/** Exercises that should NOT be grounded by the feet (e.g. lying on a bench). */
export const NO_GROUND = new Set(["bench"]);

export const armPoseFor = (id: string): ArmPose => ARM_POSES[id] ?? {};
export const groundFor = (id: string): boolean => !NO_GROUND.has(id);

/** Suggested orbit camera (target + position) per exercise, for the demo. */
export interface CameraHint { target: [number, number, number]; position: [number, number, number] }
const CAMERA: Record<string, CameraHint> = {
  squat: { target: [0, 0.7, 0], position: [2.4, 1.15, 2.9] },
  bench: { target: [0, 0.6, 0], position: [2.7, 1.7, 2.2] },
  deadlift: { target: [0, 0.7, 0], position: [2.8, 1.05, 2.8] },
  curl: { target: [0, 1.0, 0], position: [2.1, 1.2, 2.8] },
};
export const cameraFor = (id: string): CameraHint => CAMERA[id] ?? { target: [0, 1, 0], position: [2.6, 1.3, 3] };
