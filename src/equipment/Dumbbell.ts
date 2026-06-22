import { Group, Mesh, CylinderGeometry, Object3D, Euler } from "three";
import { STEEL, IRON } from "./materials";

/**
 * A short dumbbell with a head at each end of the handle. Built with the
 * handle along local +X. Use `attachTo` to parent it into a hand so it
 * follows the limb through the motion.
 */
export class Dumbbell {
  readonly group = new Group();

  constructor(handleLength = 0.34, headRadius = 0.075) {
    this.group.name = "dumbbell";

    const handle = new Mesh(new CylinderGeometry(0.018, 0.018, handleLength, 14), STEEL);
    handle.rotation.z = Math.PI / 2;
    handle.castShadow = true;
    this.group.add(handle);

    for (const sign of [-1, 1]) {
      const x = sign * (handleLength / 2 + 0.04);
      const head = new Mesh(new CylinderGeometry(headRadius, headRadius, 0.11, 22), IRON);
      head.rotation.z = Math.PI / 2;
      head.position.x = x;
      head.castShadow = true;
      this.group.add(head);
    }
  }

  /** Parent the dumbbell into a joint with a local offset/orientation. */
  attachTo(joint: Object3D, offset: [number, number, number], rotation: Euler): void {
    joint.add(this.group);
    this.group.position.set(offset[0], offset[1], offset[2]);
    this.group.rotation.copy(rotation);
  }
}
