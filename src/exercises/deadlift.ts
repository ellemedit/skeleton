import { Vector3 } from "three";
import { Barbell } from "../equipment/Barbell";
import type { Exercise } from "./types";

/**
 * Conventional deadlift. From a hip hinge with the bar over mid-foot, the
 * figure stands to lockout and lowers back down. The bar is glued to the grip
 * (both wrists), so the plates sit on the floor at the bottom and rise with
 * the hands.
 *
 * Muscle emphasis follows EMG findings: erector spinae, glutes and hamstrings
 * lead, with traps/lats and the grip (forearms) holding the load.
 */
export const deadlift: Exercise = {
  id: "deadlift",
  name: "Deadlift",
  nameKo: "데드리프트",
  description:
    "Posterior-chain dominant. Erector spinae, glutes and hamstrings drive the pull; traps and grip hold the bar.",
  duration: 2.2,
  loop: "pingpong",
  keyframes: [
    {
      t: 0,
      label: "lockout · stand",
      root: [0, 0, 0],
      pose: {
        spine: [4, 0, 0],
      },
      muscles: {
        erector_spinae: 0.5,
        gluteus: 0.6,
        hamstrings: 0.4,
        trapezius: 0.6,
        latissimus: 0.45,
        forearm: 0.72,
        quadriceps: 0.2,
        abdominals: 0.3,
      },
    },
    {
      t: 1,
      label: "bottom · floor",
      root: [0, -0.5, 0],
      pose: {
        spine: [46, 0, 0],
        chest: [16, 0, 0],
        hipL: [-95, 0, 0],
        hipR: [-95, 0, 0],
        kneeL: [110, 0, 0],
        kneeR: [110, 0, 0],
        ankleL: [-15, 0, 0],
        ankleR: [-15, 0, 0],
        shoulderL: [-62, 0, 0],
        shoulderR: [-62, 0, 0],
      },
      muscles: {
        erector_spinae: 1.0,
        gluteus: 0.9,
        hamstrings: 0.95,
        quadriceps: 0.7,
        trapezius: 0.7,
        latissimus: 0.6,
        forearm: 0.85,
        adductors: 0.4,
        abdominals: 0.55,
        calves: 0.3,
      },
    },
  ],
  setup(scene, mannequin) {
    const barbell = new Barbell({ plateRadius: 0.225 });
    scene.add(barbell.group);
    const wristL = mannequin.getJoint("wristL");
    const wristR = mannequin.getJoint("wristR");
    const lp = new Vector3();
    const rp = new Vector3();
    return {
      camera: { target: [0, 0.55, 0], position: [3.0, 1.0, 2.6] },
      update() {
        mannequin.updateWorld();
        wristL.getWorldPosition(lp);
        wristR.getWorldPosition(rp);
        barbell.spanBetween(lp, rp);
      },
      dispose() {
        scene.remove(barbell.group);
      },
    };
  },
};
