import { Euler } from "three";
import { Dumbbell } from "../equipment/Dumbbell";
import type { Exercise } from "./types";

/**
 * Standing dumbbell biceps curl. A bonus sample that showcases dumbbell
 * rendering and isolated joint/muscle movement: the elbows flex while the
 * biceps light up and bulge.
 */
export const dumbbellCurl: Exercise = {
  id: "curl",
  name: "Dumbbell Curl",
  nameKo: "덤벨 컬",
  description: "Isolated elbow flexion. Biceps lead; forearms assist as grip/stabilizers.",
  duration: 1.4,
  loop: "pingpong",
  keyframes: [
    {
      t: 0,
      label: "extended · bottom",
      root: [0, 0, 0],
      pose: {
        shoulderL: [4, 0, 4],
        shoulderR: [4, 0, -4],
        elbowL: [-12, 0, 0],
        elbowR: [-12, 0, 0],
      },
      muscles: {
        biceps: 0.18,
        forearm: 0.35,
        deltoid: 0.12,
      },
    },
    {
      t: 1,
      label: "contracted · top",
      root: [0, 0, 0],
      pose: {
        shoulderL: [10, 0, 4],
        shoulderR: [10, 0, -4],
        elbowL: [-142, 0, 0],
        elbowR: [-142, 0, 0],
      },
      muscles: {
        biceps: 1.0,
        forearm: 0.6,
        deltoid: 0.25,
      },
    },
  ],
  setup(_scene, mannequin) {
    const left = new Dumbbell();
    const right = new Dumbbell();
    // Parent each dumbbell into the hand so it follows the forearm.
    left.attachTo(mannequin.getJoint("wristL"), [0, -0.06, 0.02], new Euler(0, 0, 0));
    right.attachTo(mannequin.getJoint("wristR"), [0, -0.06, 0.02], new Euler(0, 0, 0));
    return {
      camera: { target: [0, 1.0, 0], position: [1.9, 1.25, 2.7] },
      update() {
        /* dumbbells are parented to the hands; nothing to do per-frame */
      },
      dispose() {
        mannequin.getJoint("wristL").remove(left.group);
        mannequin.getJoint("wristR").remove(right.group);
      },
    };
  },
};
