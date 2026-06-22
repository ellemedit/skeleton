import { Vector3 } from "three";
import { Barbell } from "../equipment/Barbell";
import { Bench } from "../equipment/Bench";
import type { Exercise } from "./types";

/**
 * Flat barbell bench press. The figure lies supine on the bench (achieved by
 * rotating the whole rig onto its back) and presses the bar from the chest to
 * lockout. The bar is glued to the grip, the bench sits under the torso.
 *
 * Muscle emphasis follows EMG findings: pectoralis major leads, anterior
 * deltoid and triceps assist (triceps peaking toward lockout).
 */
const SUPINE: [number, number, number] = [-90, 0, 0];
const ON_BENCH: [number, number, number] = [0, 0.6, 0.92];

export const benchPress: Exercise = {
  id: "bench",
  name: "Bench Press",
  nameKo: "벤치프레스",
  description:
    "Chest-dominant horizontal press. Pectorals lead; anterior deltoid and triceps assist (triceps peak at lockout).",
  duration: 1.8,
  loop: "pingpong",
  keyframes: [
    {
      t: 0,
      label: "lockout · top",
      root: ON_BENCH,
      rootRot: SUPINE,
      pose: {
        shoulderL: [-78, 0, 8],
        shoulderR: [-78, 0, -8],
        elbowL: [-22, 0, 0],
        elbowR: [-22, 0, 0],
        hipL: [21, 0, 0],
        hipR: [21, 0, 0],
        kneeL: [80, 0, 0],
        kneeR: [80, 0, 0],
        ankleL: [-10, 0, 0],
        ankleR: [-10, 0, 0],
      },
      muscles: {
        pectoral: 0.55,
        triceps: 0.85,
        deltoid: 0.55,
        latissimus: 0.2,
        abdominals: 0.2,
        forearm: 0.25,
      },
    },
    {
      t: 1,
      label: "bottom · chest",
      root: ON_BENCH,
      rootRot: SUPINE,
      pose: {
        shoulderL: [-36, 0, 40],
        shoulderR: [-36, 0, -40],
        elbowL: [-150, 0, 0],
        elbowR: [-150, 0, 0],
        hipL: [21, 0, 0],
        hipR: [21, 0, 0],
        kneeL: [80, 0, 0],
        kneeR: [80, 0, 0],
        ankleL: [-10, 0, 0],
        ankleR: [-10, 0, 0],
      },
      muscles: {
        pectoral: 1.0,
        deltoid: 0.72,
        triceps: 0.5,
        latissimus: 0.32,
        abdominals: 0.3,
        forearm: 0.3,
      },
    },
  ],
  setup(scene, mannequin) {
    const bench = new Bench(0.5);
    bench.group.position.set(0, 0, -0.2);
    scene.add(bench.group);

    const barbell = new Barbell();
    scene.add(barbell.group);
    const wristL = mannequin.getJoint("wristL");
    const wristR = mannequin.getJoint("wristR");
    const lp = new Vector3();
    const rp = new Vector3();
    return {
      camera: { target: [0, 0.7, -0.2], position: [2.7, 1.5, 1.9] },
      update() {
        mannequin.updateWorld();
        wristL.getWorldPosition(lp);
        wristR.getWorldPosition(rp);
        barbell.spanBetween(lp, rp);
      },
      dispose() {
        scene.remove(bench.group);
        scene.remove(barbell.group);
      },
    };
  },
};
