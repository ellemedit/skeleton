import { Mesh, MeshStandardMaterial, SphereGeometry, MathUtils, Vector3 } from "three";
import type { MuscleId, MuscleInstance } from "./rig";
import { MUSCLE_CLAY, activationColor } from "../core/colors";
import type { ColorMode } from "./types";

/** Shared unit-sphere geometry; each muscle scales it into an ellipsoid. */
const UNIT_SPHERE = new SphereGeometry(1, 20, 16);

/** Peak emissive intensity at full activation. */
const MAX_GLOW = 1.9;
/** How much a muscle thickens (perpendicular to its length) when fully active. */
const BULGE = 0.4;

/**
 * A single muscle overlay. It renders as a soft ellipsoid sitting just proud
 * of the limb. Its activation (0..1) drives an emissive "heat" highlight and a
 * contraction bulge so the muscle visibly swells as it works.
 */
export class Muscle {
  readonly name: string;
  readonly id: MuscleId;
  readonly mesh: Mesh;
  private readonly material: MeshStandardMaterial;
  private readonly baseScale: Vector3;
  private activation = 0;

  constructor(def: MuscleInstance) {
    this.name = def.name;
    this.id = def.id;
    this.material = new MeshStandardMaterial({
      color: MUSCLE_CLAY,
      roughness: 0.72,
      metalness: 0.0,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    this.mesh = new Mesh(UNIT_SPHERE, this.material);
    this.mesh.name = def.name;
    this.mesh.position.set(def.offset[0], def.offset[1], def.offset[2]);
    this.baseScale = new Vector3(def.size[0], def.size[1], def.size[2]);
    this.mesh.scale.copy(this.baseScale);
    this.mesh.castShadow = true;
  }

  /** Update color/intensity and bulge from an activation level. */
  setActivation(a: number, mode: ColorMode): void {
    this.activation = MathUtils.clamp(a, 0, 1);
    const eased = MathUtils.smoothstep(this.activation, 0, 1);

    activationColor(this.activation, mode, this.material.emissive);
    this.material.emissiveIntensity = eased * MAX_GLOW;

    // Thicken across the short axes (x, z); barely change length (y).
    const swell = 1 + eased * BULGE;
    const lengthSwell = 1 + eased * BULGE * 0.25;
    this.mesh.scale.set(
      this.baseScale.x * swell,
      this.baseScale.y * lengthSwell,
      this.baseScale.z * swell,
    );
  }

  /** Re-apply the current activation (e.g. after a color-mode change). */
  refresh(mode: ColorMode): void {
    this.setActivation(this.activation, mode);
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  /** Current activation level (0..1). */
  getActivation(): number {
    return this.activation;
  }

  /** World position of the muscle's center (matrices must be up to date). */
  getWorldPosition(target = new Vector3()): Vector3 {
    return this.mesh.getWorldPosition(target);
  }

  /** Mean rest radius, useful for sizing overlays/labels. */
  get meanRadius(): number {
    return (this.baseScale.x + this.baseScale.y + this.baseScale.z) / 3;
  }
}
