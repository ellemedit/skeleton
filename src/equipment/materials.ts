import { MeshStandardMaterial } from "three";

/** Brushed-steel look for bars, handles, and frames. */
export const STEEL = new MeshStandardMaterial({
  color: "#41454d",
  metalness: 0.85,
  roughness: 0.38,
});

/** Dark iron/rubber look for weight plates and dumbbell heads. */
export const IRON = new MeshStandardMaterial({
  color: "#1c1e23",
  metalness: 0.35,
  roughness: 0.72,
});

/** Padded upholstery for the bench. */
export const PAD = new MeshStandardMaterial({
  color: "#2b2f38",
  metalness: 0.0,
  roughness: 0.95,
});
