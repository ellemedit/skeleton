import { Group, Mesh, CylinderGeometry, Vector3, Quaternion } from "three";
import { STEEL, IRON } from "./materials";

const X_AXIS = new Vector3(1, 0, 0);

export interface BarbellOptions {
  /** Overall bar length (m). */
  barLength?: number;
  barRadius?: number;
  /** Distance of the plate stack center from the bar center (m). */
  plateInset?: number;
  plateRadius?: number;
}

/**
 * An Olympic-style barbell: a long bar with a stack of plates near each end.
 * The whole thing lives in a local frame with the bar along local +X, so
 * `spanBetween(a, b)` can point it through two grip points (e.g. both wrists).
 */
export class Barbell {
  readonly group = new Group();

  constructor(opts: BarbellOptions = {}) {
    const barLength = opts.barLength ?? 2.2;
    const barRadius = opts.barRadius ?? 0.014;
    const plateInset = opts.plateInset ?? 0.74;
    const plateRadius = opts.plateRadius ?? 0.225;
    this.group.name = "barbell";

    const bar = new Mesh(new CylinderGeometry(barRadius, barRadius, barLength, 18), STEEL);
    bar.rotation.z = Math.PI / 2; // align cylinder (default +Y) to +X
    bar.castShadow = true;
    this.group.add(bar);

    // Two plates + a collar at each end, mirrored across the bar center.
    for (const sign of [-1, 1]) {
      this.addPlate(sign * (plateInset - 0.03), plateRadius, 0.05, barRadius);
      this.addPlate(sign * (plateInset + 0.03), plateRadius * 0.86, 0.045, barRadius);
      this.addCollar(sign * (plateInset + 0.075), barRadius);
    }
  }

  private addPlate(x: number, radius: number, thickness: number, barRadius: number): void {
    const plate = new Mesh(new CylinderGeometry(radius, radius, thickness, 28), IRON);
    plate.rotation.z = Math.PI / 2;
    plate.position.x = x;
    plate.castShadow = true;
    this.group.add(plate);
    // little hub so the plate reads as seated on the sleeve
    const hub = new Mesh(new CylinderGeometry(barRadius * 2.2, barRadius * 2.2, thickness + 0.01, 16), STEEL);
    hub.rotation.z = Math.PI / 2;
    hub.position.x = x;
    this.group.add(hub);
  }

  private addCollar(x: number, barRadius: number): void {
    const collar = new Mesh(new CylinderGeometry(barRadius * 2.4, barRadius * 2.4, 0.05, 16), STEEL);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = x;
    this.group.add(collar);
  }

  /** Position and orient the bar so its axis runs through `a` and `b` (world). */
  spanBetween(a: Vector3, b: Vector3): void {
    this.group.position.copy(a).add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len > 1e-6) {
      dir.divideScalar(len);
      this.group.quaternion.setFromUnitVectors(X_AXIS, dir);
    }
  }

  /** Place the bar at a fixed point/orientation (e.g. resting in a rack). */
  place(position: Vector3, quaternion?: Quaternion): void {
    this.group.position.copy(position);
    if (quaternion) this.group.quaternion.copy(quaternion);
  }
}
