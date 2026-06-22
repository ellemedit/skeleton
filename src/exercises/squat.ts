import { Vector3 } from "three";
import { Barbell } from "../equipment/Barbell";
import type { Exercise } from "./types";

/**
 * Back squat. The figure descends into a deep squat and drives back up. The
 * barbell rests across the upper back (traps) and is glued there relative to
 * the chest, so it tracks the torso lean throughout the rep.
 *
 * Muscle emphasis follows EMG findings: quadriceps and glutes dominate, with
 * the erector spinae bracing the trunk and hamstrings/adductors assisting.
 */
export const squat: Exercise = {
  id: "squat",
  name: "Back Squat",
  nameKo: "백 스쿼트",
  description:
    "Quad- and glute-dominant. Erector spinae braces the trunk against the bar on the upper back.",
  duration: 2.0,
  loop: "pingpong",
  keyframes: [
    {
      t: 0,
      label: "top · stand",
      root: [0, 0, 0],
      pose: {
        shoulderL: [-40, 0, 65],
        shoulderR: [-40, 0, -65],
        elbowL: [-170, 0, 30],
        elbowR: [-170, 0, -30],
      },
      muscles: {
        quadriceps: 0.22,
        gluteus: 0.28,
        erector_spinae: 0.4,
        trapezius: 0.45,
        forearm: 0.3,
        abdominals: 0.2,
      },
    },
    {
      t: 1,
      label: "bottom · depth",
      root: [0, -0.62, 0],
      pose: {
        spine: [24, 0, 0],
        chest: [12, 0, 0],
        hipL: [-112, 0, 0],
        hipR: [-112, 0, 0],
        kneeL: [128, 0, 0],
        kneeR: [128, 0, 0],
        ankleL: [-16, 0, 0],
        ankleR: [-16, 0, 0],
        shoulderL: [-40, 0, 65],
        shoulderR: [-40, 0, -65],
        elbowL: [-170, 0, 30],
        elbowR: [-170, 0, -30],
      },
      muscles: {
        quadriceps: 1.0,
        gluteus: 0.92,
        hamstrings: 0.5,
        adductors: 0.55,
        erector_spinae: 0.72,
        calves: 0.35,
        abdominals: 0.45,
        trapezius: 0.5,
        forearm: 0.32,
      },
    },
  ],
  setup(scene, mannequin) {
    const barbell = new Barbell();
    scene.add(barbell.group);
    const wristL = mannequin.getJoint("wristL");
    const wristR = mannequin.getJoint("wristR");
    const lp = new Vector3();
    const rp = new Vector3();
    return {
      camera: { target: [0, 0.75, 0], position: [2.4, 1.25, 2.9] },
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
