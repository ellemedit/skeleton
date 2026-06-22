import { Group, Mesh, BoxGeometry, CylinderGeometry } from "three";
import { STEEL, PAD } from "./materials";

/**
 * A flat weight bench. The pad's top surface sits at `padTop` so a supine
 * figure can be laid on it. The bench runs along the Z axis (head at -Z) and
 * includes two uprights at the head end that read as a bar rack.
 */
export class Bench {
  readonly group = new Group();
  readonly padTop: number;

  constructor(padTop = 0.46) {
    this.padTop = padTop;
    this.group.name = "bench";

    const padHeight = 0.1;
    const padLength = 1.25;
    const padWidth = 0.32;
    const padCenterY = padTop - padHeight / 2;

    const pad = new Mesh(new BoxGeometry(padWidth, padHeight, padLength), PAD);
    pad.position.set(0, padCenterY, 0);
    pad.castShadow = true;
    pad.receiveShadow = true;
    this.group.add(pad);

    // Foot rails / legs.
    for (const z of [-padLength / 2 + 0.1, padLength / 2 - 0.1]) {
      const leg = new Mesh(new BoxGeometry(padWidth * 0.9, padCenterY - padHeight / 2, 0.06), STEEL);
      leg.position.set(0, (padCenterY - padHeight / 2) / 2, z);
      leg.castShadow = true;
      this.group.add(leg);
    }

    // Uprights at the head end (-Z) suggesting a rack.
    for (const x of [-padWidth / 2 - 0.04, padWidth / 2 + 0.04]) {
      const post = new Mesh(new CylinderGeometry(0.025, 0.025, 1.0, 12), STEEL);
      post.position.set(x, 0.5, -padLength / 2 - 0.04);
      post.castShadow = true;
      this.group.add(post);
    }
  }
}
