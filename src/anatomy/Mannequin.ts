import {
  Group,
  Object3D,
  Mesh,
  MeshStandardMaterial,
  CapsuleGeometry,
  BoxGeometry,
  SphereGeometry,
  BufferGeometry,
  MathUtils,
  Vector3,
} from "three";
import { BONES, MUSCLES, type BoneDef } from "./rig";
import { Muscle } from "./Muscle";
import { CLAY } from "../core/colors";
import type { ColorMode, MotionSample, MuscleActivation, Pose } from "./types";

const DEG = MathUtils.degToRad;

function buildBoneGeometry(b: BoneDef): { geo: BufferGeometry; offset: Vector3 } {
  const meshOffset = b.meshOffset ?? [0, 0, 0];
  switch (b.shape) {
    case "capsule": {
      const len = b.length ?? 0.2;
      const rad = b.radius ?? 0.05;
      // Capsule is centered on its origin; shift it down so the segment hangs
      // from the joint along -Y.
      const off = b.meshOffset ? new Vector3(...meshOffset) : new Vector3(0, -len / 2, 0);
      return { geo: new CapsuleGeometry(rad, len, 6, 14), offset: off };
    }
    case "box": {
      const s = b.size ?? [0.1, 0.1, 0.1];
      return { geo: new BoxGeometry(s[0], s[1], s[2]), offset: new Vector3(...meshOffset) };
    }
    case "sphere": {
      const rad = b.radius ?? 0.1;
      return { geo: new SphereGeometry(rad, 24, 18), offset: new Vector3(...meshOffset) };
    }
  }
}

/**
 * A posable, muscle-mapped humanoid figure. Build it once, add `root` to the
 * scene, then drive it with `apply(sample)` each frame.
 */
export class Mannequin {
  /** Add this to the scene. */
  readonly root: Group = new Group();
  private readonly joints = new Map<string, Object3D>();
  private readonly muscles: Muscle[] = [];
  private readonly muscleByName = new Map<string, Muscle>();
  private colorMode: ColorMode = "heatmap";
  private readonly bodyMaterial: MeshStandardMaterial;

  constructor() {
    this.root.name = "mannequin";
    this.bodyMaterial = new MeshStandardMaterial({
      color: CLAY,
      roughness: 0.88,
      metalness: 0.0,
    });

    // Build the skeleton (BONES is ordered parents-first).
    for (const b of BONES) {
      const joint = new Group();
      joint.name = b.name;
      joint.position.set(b.offset[0], b.offset[1], b.offset[2]);

      const { geo, offset } = buildBoneGeometry(b);
      const mesh = new Mesh(geo, this.bodyMaterial);
      mesh.position.copy(offset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      joint.add(mesh);

      const parent = b.parent ? this.joints.get(b.parent) : this.root;
      if (!parent) throw new Error(`Bone "${b.name}" references missing parent "${b.parent}"`);
      parent.add(joint);
      this.joints.set(b.name, joint);
    }

    // Attach muscle overlays to their bones.
    for (const def of MUSCLES) {
      const bone = this.joints.get(def.bone);
      if (!bone) throw new Error(`Muscle "${def.name}" references missing bone "${def.bone}"`);
      const muscle = new Muscle(def);
      bone.add(muscle.mesh);
      this.muscles.push(muscle);
      this.muscleByName.set(def.name, muscle);
    }
  }

  /** Reset every joint to its neutral rotation, then apply the given pose. */
  setPose(pose: Pose): void {
    for (const joint of this.joints.values()) joint.rotation.set(0, 0, 0);
    for (const [name, rot] of Object.entries(pose)) {
      const joint = this.joints.get(name);
      if (joint) joint.rotation.set(DEG(rot[0]), DEG(rot[1]), DEG(rot[2]));
    }
  }

  /** Apply muscle activations (keyed by side-agnostic id) to all instances. */
  setActivations(map: MuscleActivation): void {
    for (const muscle of this.muscles) {
      muscle.setActivation(map[muscle.id] ?? 0, this.colorMode);
    }
  }

  /** Apply a full interpolated motion sample (figure placement + pose + muscles). */
  apply(sample: MotionSample): void {
    this.root.position.set(sample.root[0], sample.root[1], sample.root[2]);
    this.root.rotation.set(DEG(sample.rootRot[0]), DEG(sample.rootRot[1]), DEG(sample.rootRot[2]));
    this.setPose(sample.pose);
    this.setActivations(sample.muscles);
  }

  setColorMode(mode: ColorMode): void {
    this.colorMode = mode;
    for (const muscle of this.muscles) muscle.refresh(mode);
  }

  setMusclesVisible(visible: boolean): void {
    for (const muscle of this.muscles) muscle.setVisible(visible);
  }

  /** All muscle overlays, e.g. for building HUD overlays or labels. */
  get muscleList(): readonly Muscle[] {
    return this.muscles;
  }

  /** A joint group, for attaching equipment or reading transforms. */
  getJoint(name: string): Object3D {
    const joint = this.joints.get(name);
    if (!joint) throw new Error(`Unknown joint "${name}"`);
    return joint;
  }

  /** Ensure world matrices are current (needed before reading world positions). */
  updateWorld(): void {
    this.root.updateMatrixWorld(true);
  }

  /** World position of a joint origin. Call updateWorld() first if not rendering. */
  getJointWorldPosition(name: string, target = new Vector3()): Vector3 {
    return this.getJoint(name).getWorldPosition(target);
  }
}
