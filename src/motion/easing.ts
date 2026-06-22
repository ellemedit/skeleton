/** Tiny, dependency-free interpolation helpers used by the animator. */

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Classic smoothstep ease-in-out over `t` in [0, 1]. */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
