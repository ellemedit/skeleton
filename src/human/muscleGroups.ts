/**
 * Maps a rigged humanoid mesh's vertices to muscle groups so activation can be
 * painted onto the skin as a heatmap.
 *
 * The classification is a heuristic on each vertex's dominant skinning bone
 * plus its position in the bind pose (the model faces +Z, Y is up), which is
 * enough to separate front/back/inner regions (e.g. quadriceps vs hamstrings).
 */
import { Color } from "three";
import type { MuscleId } from "../anatomy/rig";
import { heatColor } from "../core/colors";

/**
 * Classify a vertex given the name of its dominant (highest-weight) bone and
 * its bind-pose position. Returns a muscle id or null (unhighlighted skin).
 * Works with Mixamo bone names (e.g. "mixamorigLeftUpLeg").
 */
export function muscleGroupOf(boneName: string, _x: number, y: number, z: number): MuscleId | null {
  const n = boneName;
  if (n.includes("UpLeg")) return z < -0.02 ? "hamstrings" : z > 0.05 ? "quadriceps" : "adductors";
  if (n.includes("Leg")) return z < 0 ? "calves" : null;
  if (n.endsWith("Hips")) return z < 0 ? "gluteus" : null;
  if (n.endsWith("Spine") || n.endsWith("Spine1")) return z < 0 ? "erector_spinae" : "abdominals";
  if (n.endsWith("Spine2")) return z > 0 ? "pectoral" : y > 1.45 ? "trapezius" : "latissimus";
  if (n.includes("ForeArm")) return "forearm";
  if (n.includes("Arm")) return y > 1.45 ? "deltoid" : z > 0 ? "biceps" : "triceps";
  if (n.includes("Shoulder")) return "trapezius";
  return null;
}

/** Peak emissive intensity at full activation for the skin heat overlay. */
export const MUSCLE_GLOW = 1.7;

/**
 * Emissive color contribution for an activation level (0 when relaxed). The
 * same heatmap the rest of the renderer uses, eased so low activation stays dim.
 */
export function muscleEmissive(activation: number, out = new Color()): Color {
  const a = activation < 0 ? 0 : activation > 1 ? 1 : activation;
  if (a <= 0.04) return out.setRGB(0, 0, 0);
  const eased = a * a * (3 - 2 * a) * MUSCLE_GLOW;
  return heatColor(a, out).multiplyScalar(eased);
}
