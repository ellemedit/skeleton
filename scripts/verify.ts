/**
 * Headless pose verification.
 *
 * three.js scene-graph math (Object3D/Vector3/matrices) runs fine in Node
 * without a WebGL context, so we can build the real Mannequin, apply each
 * exercise's keyframes, and check that the figure makes physical sense:
 * feet on the floor, hands on the bar, squat depth, etc. This lets us tune
 * authored angles without a browser.
 *
 * Run with: npm run verify
 */
import { Vector3 } from "three";
import { Mannequin } from "../src/anatomy/Mannequin";
import { EXERCISES } from "../src/exercises";
import type { Keyframe, MotionSample } from "../src/anatomy/types";

const m = new Mannequin();

function sampleOf(kf: Keyframe): MotionSample {
  return {
    pose: kf.pose,
    muscles: kf.muscles,
    root: kf.root ?? [0, 0, 0],
    rootRot: kf.rootRot ?? [0, 0, 0],
    label: kf.label,
    progress: kf.t,
  };
}

const f3 = (n: number) => (n >= 0 ? " " : "") + n.toFixed(3);
function v(p: Vector3): string {
  return `(${f3(p.x)}, ${f3(p.y)}, ${f3(p.z)})`;
}

/** World Y of the sole at the toe and heel of a foot, to test "flat on floor". */
function footSoleY(side: "L" | "R"): { toe: number; heel: number } {
  const ankle = m.getJoint(`ankle${side}`);
  const toe = ankle.localToWorld(new Vector3(0, -0.035, 0.21));
  const heel = ankle.localToWorld(new Vector3(0, -0.035, -0.05));
  return { toe: toe.y, heel: heel.y };
}

let failures = 0;
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++;
  console.log(`   ${ok ? "✓" : "✗"} ${name}: ${detail}`);
}

const tmp = new Vector3();
const wp = (name: string) => m.getJointWorldPosition(name, tmp).clone();

for (const ex of EXERCISES) {
  console.log(`\n=== ${ex.name} (${ex.id}) ===`);
  for (const kf of ex.keyframes) {
    m.apply(sampleOf(kf));
    m.updateWorld();

    const hipL = wp("hipL");
    const kneeL = wp("kneeL");
    const ankleL = wp("ankleL");
    const shoulderL = wp("shoulderL");
    const wristL = wp("wristL");
    const wristR = wp("wristR");
    const head = wp("head");
    const sole = footSoleY("L");

    console.log(`\n  [${kf.label}]  root=${JSON.stringify(kf.root ?? [0, 0, 0])} rootRot=${JSON.stringify(kf.rootRot ?? [0, 0, 0])}`);
    console.log(`    hipL=${v(hipL)} kneeL=${v(kneeL)} ankleL=${v(ankleL)}`);
    console.log(`    shoulderL=${v(shoulderL)} wristL=${v(wristL)} headTop≈${f3(head.y + 0.2)}`);
    console.log(`    foot sole toe=${f3(sole.toe)} heel=${f3(sole.heel)}`);

    // Generic invariant: feet should rest on (not under) the floor.
    check("feet on floor", sole.toe > -0.03 && sole.heel > -0.03 && Math.min(sole.toe, sole.heel) < 0.06,
      `toe=${f3(sole.toe)} heel=${f3(sole.heel)}`);

    if (ex.id === "squat") {
      if (kf.label.startsWith("bottom")) {
        check("squat depth (hip below knee)", hipL.y < kneeL.y, `hipY=${f3(hipL.y)} kneeY=${f3(kneeL.y)}`);
      }
      check("hands racked at/above shoulder", wristL.y > shoulderL.y - 0.02,
        `wristL=${v(wristL)} shoulderY=${f3(shoulderL.y)}`);
    }
    if (ex.id === "deadlift" && kf.label.startsWith("bottom")) {
      check("bar (wrist) at plate radius ~0.225", Math.abs(wristL.y - 0.225) < 0.06, `wristY=${f3(wristL.y)}`);
      check("hands roughly level", Math.abs(wristL.y - wristR.y) < 0.05, `dy=${f3(Math.abs(wristL.y - wristR.y))}`);
    }
    if (ex.id === "bench") {
      check("torso on bench (~0.5)", Math.abs(shoulderL.y - 0.5) < 0.18, `shoulderY=${f3(shoulderL.y)}`);
      if (kf.label.startsWith("lockout")) {
        check("bar pressed above chest", wristL.y > shoulderL.y + 0.4, `wristY=${f3(wristL.y)} shoulderY=${f3(shoulderL.y)}`);
      }
      if (kf.label.startsWith("bottom")) {
        check("bar near chest", wristL.y < shoulderL.y + 0.35, `wristY=${f3(wristL.y)} shoulderY=${f3(shoulderL.y)}`);
      }
    }
  }
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
if (failures > 0) throw new Error(`${failures} pose check(s) failed`);
