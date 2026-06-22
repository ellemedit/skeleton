import type { EulerDeg, Keyframe, MotionSample, MuscleActivation, Pose, Vec3 } from "../anatomy/types";
import { clamp01, lerp, smoothstep } from "./easing";

export type LoopMode = "loop" | "pingpong" | "once";

export interface AnimatorOptions {
  /** Duration of a single pass, in seconds. */
  duration: number;
  loop: LoopMode;
  /** Playback rate multiplier (1 = normal). */
  speed?: number;
}

const REST: EulerDeg = [0, 0, 0];
const ZERO: Vec3 = [0, 0, 0];

/**
 * Plays a list of keyframes, interpolating both joint rotations and muscle
 * activations. The math is pure (no three.js), so it can be unit-tested and
 * also reused to drive any rig.
 */
export class Animator {
  private readonly keyframes: Keyframe[];
  private readonly duration: number;
  private readonly loop: LoopMode;
  private speed: number;

  /** Elapsed playback time in seconds (monotonic while playing). */
  private time = 0;
  private playing = true;

  constructor(keyframes: Keyframe[], opts: AnimatorOptions) {
    if (keyframes.length < 2) throw new Error("Animator needs at least 2 keyframes");
    this.keyframes = [...keyframes].sort((a, b) => a.t - b.t);
    this.duration = Math.max(0.001, opts.duration);
    this.loop = opts.loop;
    this.speed = opts.speed ?? 1;
  }

  /** Advance by `dt` seconds and return the interpolated sample. */
  update(dt: number): MotionSample {
    if (this.playing) this.time += dt * this.speed;
    return this.sample(this.progress());
  }

  /** Normalized progress 0..1 within the current pass (handles loop modes). */
  progress(): number {
    const u = this.time / this.duration;
    switch (this.loop) {
      case "once": {
        const p = clamp01(u);
        if (u >= 1) this.playing = false;
        return p;
      }
      case "loop":
        return u - Math.floor(u);
      case "pingpong": {
        const m = ((u % 2) + 2) % 2; // 0..2
        return m <= 1 ? m : 2 - m;
      }
    }
  }

  /** Sample the motion at a normalized progress, without advancing time. */
  sample(progress: number): MotionSample {
    const p = clamp01(progress);
    const kfs = this.keyframes;

    // Find the segment [a, b] that contains p.
    let i = 0;
    while (i < kfs.length - 2 && p > kfs[i + 1].t) i++;
    const a = kfs[i];
    const b = kfs[i + 1] ?? a;

    const span = b.t - a.t;
    const localRaw = span > 1e-6 ? (p - a.t) / span : 0;
    const local = smoothstep(localRaw);

    return {
      pose: interpolatePose(a.pose, b.pose, local),
      muscles: interpolateMuscles(a.muscles, b.muscles, local),
      root: interpolateVec3(a.root ?? ZERO, b.root ?? ZERO, local),
      rootRot: interpolateVec3(a.rootRot ?? ZERO, b.rootRot ?? ZERO, local),
      label: localRaw < 0.5 ? a.label : b.label,
      progress: p,
    };
  }

  seek(progress: number): void {
    const p = clamp01(progress);
    // Map a 0..1 scrub back onto the timeline (forward leg for pingpong).
    this.time = p * this.duration;
  }

  reset(): void {
    this.time = 0;
    this.playing = true;
  }

  play(): void {
    this.playing = true;
  }
  pause(): void {
    this.playing = false;
  }
  toggle(): boolean {
    this.playing = !this.playing;
    return this.playing;
  }
  isPlaying(): boolean {
    return this.playing;
  }
  setSpeed(speed: number): void {
    this.speed = speed;
  }
}

function interpolatePose(a: Pose, b: Pose, t: number): Pose {
  const out: Record<string, EulerDeg> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const ra = a[k] ?? REST;
    const rb = b[k] ?? REST;
    out[k] = [lerp(ra[0], rb[0], t), lerp(ra[1], rb[1], t), lerp(ra[2], rb[2], t)];
  }
  return out;
}

function interpolateMuscles(a: MuscleActivation, b: MuscleActivation, t: number): MuscleActivation {
  const out: Record<string, number> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  }
  return out;
}

function interpolateVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
