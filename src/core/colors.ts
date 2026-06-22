import { Color, MathUtils } from "three";
import type { ColorMode } from "../anatomy/types";

/** Matte "clay" tone used for the inert mannequin body and relaxed muscles. */
export const CLAY = new Color("#cdc6bd");
/** Slightly warmer tone for the muscle overlays so they read as separate bumps. */
export const MUSCLE_CLAY = new Color("#bdb2a6");
/** Single accent color used in "accent" color mode. */
export const ACCENT = new Color("#ff5a1f");

/** Background / ground tones for the stage. */
export const BACKGROUND = new Color("#15171c");
export const GROUND = new Color("#1d2026");

/**
 * Map a muscle activation `a` (0..1) to a heatmap color: a cool teal at low
 * activation rising through green/yellow to a hot red at full activation.
 * Implemented in HSL so the ramp stays vivid.
 */
export function heatColor(a: number, out = new Color()): Color {
  const t = MathUtils.clamp(a, 0, 1);
  // Hue sweeps 170° (teal) -> 0° (red) as activation climbs.
  const hue = MathUtils.lerp(170, 0, t) / 360;
  const sat = 0.85;
  const light = MathUtils.lerp(0.42, 0.52, t);
  return out.setHSL(hue, sat, light);
}

/** Resolve the emissive color for a muscle given its activation and mode. */
export function activationColor(a: number, mode: ColorMode, out = new Color()): Color {
  if (mode === "accent") return out.copy(ACCENT);
  return heatColor(a, out);
}
