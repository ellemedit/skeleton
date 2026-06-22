/**
 * Retargets the validated procedural-rig poses onto a rigged humanoid skeleton
 * (e.g. a Mixamo character), so the human model can perform the same lifts.
 *
 * Legs, spine, neck and head transfer well via world-space rotation deltas
 * (their bind orientations match). Arms differ between an A-pose source and a
 * T-pose target, so they're posed directly per exercise (`armPose`). The figure
 * is grounded by its feet after posing.
 */
import { Bone, Object3D, Quaternion, Skeleton, Vector3 } from "three";
import { Mannequin } from "../anatomy/Mannequin";
import type { MotionSample } from "../anatomy/types";

/** my-joint → target bone name. Arms are intentionally excluded (see above). */
const MAP: Record<string, string> = {
  pelvis: "mixamorigHips",
  spine: "mixamorigSpine1",
  chest: "mixamorigSpine2",
  neck: "mixamorigNeck",
  head: "mixamorigHead",
  hipL: "mixamorigLeftUpLeg", kneeL: "mixamorigLeftLeg", ankleL: "mixamorigLeftFoot",
  hipR: "mixamorigRightUpLeg", kneeR: "mixamorigRightLeg", ankleR: "mixamorigRightFoot",
};

export type ArmPose = Record<string, readonly [number, number, number]>;

export class Retargeter {
  private readonly bones: Bone[];
  private readonly byName = new Map<string, Bone>();
  private readonly bindWorldQ = new Map<Bone, Quaternion>();
  private readonly bindLocalQ = new Map<Bone, Quaternion>();
  private readonly bindLocalPos = new Map<Bone, Vector3>();
  private readonly boneToJoint = new Map<string, string>();
  private readonly mannequin = new Mannequin();
  private readonly bindJ = new Map<string, Quaternion>();
  private readonly bindPelvis = new Vector3();
  private readonly root: Object3D;

  constructor(private readonly skeleton: Skeleton) {
    this.bones = skeleton.bones;
    for (const b of this.bones) {
      this.byName.set(b.name, b);
      this.bindWorldQ.set(b, b.getWorldQuaternion(new Quaternion()));
      this.bindLocalQ.set(b, b.quaternion.clone());
      this.bindLocalPos.set(b, b.position.clone());
    }
    for (const [j, bn] of Object.entries(MAP)) this.boneToJoint.set(bn, j);

    // climb to the skeleton root for world-matrix updates
    let r: Object3D = this.bones[0];
    while (r.parent && (r.parent as Bone).isBone) r = r.parent;
    this.root = r.parent ?? r;

    this.mannequin.setPose({});
    this.mannequin.updateWorld();
    for (const j of Object.keys(MAP)) this.bindJ.set(j, this.mannequin.getJoint(j).getWorldQuaternion(new Quaternion()));
    this.mannequin.getJointWorldPosition("pelvis", this.bindPelvis);
  }

  /** Pose the skeleton for a motion sample plus an exercise-specific arm pose. */
  apply(sample: MotionSample, armPose: ArmPose = {}, ground = true): void {
    this.mannequin.apply(sample);
    this.mannequin.updateWorld();

    const delta = new Map<string, Quaternion>();
    for (const j of Object.keys(MAP)) {
      const qp = this.mannequin.getJoint(j).getWorldQuaternion(new Quaternion());
      delta.set(j, qp.multiply(this.bindJ.get(j)!.clone().invert()));
    }

    const targetWorld = new Map<Bone, Quaternion>();
    for (const b of this.bones) {
      const parent = b.parent && (b.parent as Bone).isBone ? (b.parent as Bone) : null;
      const parentTW = parent && targetWorld.has(parent)
        ? targetWorld.get(parent)!
        : this.bindWorldQ.get(b)!.clone().multiply(this.bindLocalQ.get(b)!.clone().invert());
      const j = this.boneToJoint.get(b.name);
      const tw = j && delta.has(j)
        ? delta.get(j)!.clone().multiply(this.bindWorldQ.get(b)!)
        : parentTW.clone().multiply(this.bindLocalQ.get(b)!);
      targetWorld.set(b, tw);
      b.quaternion.copy(parentTW.clone().invert().multiply(tw));
      b.position.copy(this.bindLocalPos.get(b)!);
    }

    // Position the hips from the pelvis displacement.
    const hips = this.byName.get("mixamorigHips")!;
    const posePelvis = this.mannequin.getJointWorldPosition("pelvis", new Vector3());
    hips.position.add(posePelvis.sub(this.bindPelvis));

    // Arms posed directly for this exercise.
    for (const [name, e] of Object.entries(armPose)) {
      const bone = this.byName.get(name);
      if (bone) bone.rotation.set((e[0] * Math.PI) / 180, (e[1] * Math.PI) / 180, (e[2] * Math.PI) / 180);
    }

    this.root.updateWorldMatrix(true, true);

    // Ground the figure by its lowest foot.
    const fl = ground ? this.byName.get("mixamorigLeftToeBase") ?? this.byName.get("mixamorigLeftFoot") : undefined;
    const fr = ground ? this.byName.get("mixamorigRightToeBase") ?? this.byName.get("mixamorigRightFoot") : undefined;
    if (fl && fr) {
      const yl = fl.getWorldPosition(new Vector3()).y;
      const yr = fr.getWorldPosition(new Vector3()).y;
      hips.position.y -= Math.min(yl, yr);
      this.root.updateWorldMatrix(true, true);
    }
    this.skeleton.update();
  }
}
