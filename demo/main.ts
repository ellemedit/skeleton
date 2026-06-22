import { Object3D, Vector3 } from "three";
import { Stage } from "../src/core/Stage";
import { Animator } from "../src/motion/Animator";
import { EXERCISES } from "../src/exercises";
import type { Exercise } from "../src/exercises";
import { HumanFigure } from "../src/human/HumanFigure";
import { armPoseFor, groundFor, cameraFor } from "../src/human/lifts";
import { Barbell } from "../src/equipment/Barbell";
import { Dumbbell } from "../src/equipment/Dumbbell";
import { Bench } from "../src/equipment/Bench";
import { MUSCLE_IDS, MUSCLE_INFO } from "../src/anatomy/rig";
import { heatColor } from "../src/core/colors";
import type { MotionSample } from "../src/anatomy/types";

// Rigged human model (Mixamo "Xbot" from the three.js examples; loaded at runtime).
const MODEL_URL = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb";

const $ = <T extends HTMLElement>(s: string): T => document.querySelector(s) as T;
const stageEl = $("#stage"), exercisesEl = $("#exercises"), aboutEl = $("#about"), phaseEl = $("#phase");
const playBtn = $<HTMLButtonElement>("#play"), scrub = $<HTMLInputElement>("#scrub");
const speed = $<HTMLInputElement>("#speed"), speedVal = $("#speedVal");
const showMuscles = $<HTMLInputElement>("#showMuscles"), barsEl = $("#bars");

const stage = new Stage(stageEl);
let playbackSpeed = 1, scrubbing = false;

// Equipment that follows the figure's hands each frame.
interface Equipment { objects: Object3D[]; update(): void }
function buildEquipment(figure: HumanFigure, ex: Exercise): Equipment {
  const objects: Object3D[] = [];
  const lh = new Vector3(), rh = new Vector3();
  if (ex.id === "curl") {
    const dbs = [new Dumbbell(), new Dumbbell()];
    dbs.forEach((d) => objects.push(d.group));
    return {
      objects,
      update() {
        dbs[0].group.position.copy(figure.getBoneWorld("mixamorigLeftHand", lh));
        dbs[1].group.position.copy(figure.getBoneWorld("mixamorigRightHand", rh));
      },
    };
  }
  const bar = new Barbell({ plateRadius: ex.id === "deadlift" ? 0.225 : 0.22 });
  objects.push(bar.group);
  if (ex.id === "bench") {
    const bench = new Bench(0.5);
    objects.push(bench.group);
  }
  return {
    objects,
    update() {
      bar.spanBetween(figure.getBoneWorld("mixamorigLeftHand", lh), figure.getBoneWorld("mixamorigRightHand", rh));
    },
  };
}

interface Active { exercise: Exercise; animator: Animator; equipment: Equipment }
let figure: HumanFigure | null = null;
let active: Active | null = null;

const chips = EXERCISES.map((ex) => {
  const btn = document.createElement("button");
  btn.textContent = ex.nameKo;
  btn.title = ex.name;
  btn.addEventListener("click", () => loadExercise(ex));
  exercisesEl.appendChild(btn);
  return { ex, btn };
});

function loadExercise(ex: Exercise): void {
  if (!figure) return;
  if (active) for (const o of active.equipment.objects) stage.scene.remove(o);
  const equipment = buildEquipment(figure, ex);
  for (const o of equipment.objects) stage.scene.add(o);
  const animator = new Animator(ex.keyframes, { duration: ex.duration, loop: ex.loop, speed: playbackSpeed });
  stage.applyCameraHint(cameraFor(ex.id));
  active = { exercise: ex, animator, equipment };
  aboutEl.textContent = ex.description;
  for (const c of chips) c.btn.classList.toggle("active", c.ex === ex);
  setPlayLabel(true);
}

// Muscle activation legend.
const fills = new Map<string, HTMLElement>(), rows = new Map<string, HTMLElement>();
for (const id of MUSCLE_IDS) {
  const row = document.createElement("div"); row.className = "bar-row";
  const name = document.createElement("span"); name.className = "bar-name";
  name.textContent = MUSCLE_INFO[id].label.split(" · ")[1] ?? MUSCLE_INFO[id].label;
  const track = document.createElement("div"); track.className = "bar-track";
  const fill = document.createElement("div"); fill.className = "bar-fill";
  track.appendChild(fill); row.append(name, track); barsEl.appendChild(row);
  fills.set(id, fill); rows.set(id, row);
}
function updateReadout(s: MotionSample): void {
  phaseEl.textContent = `${s.label} · ${Math.round(s.progress * 100)}%`;
  for (const id of MUSCLE_IDS) {
    const a = s.muscles[id] ?? 0;
    fills.get(id)!.style.width = `${(a * 100).toFixed(0)}%`;
    fills.get(id)!.style.backgroundColor = heatColor(Math.max(a, 0.15)).getStyle();
    rows.get(id)!.style.opacity = `${(0.32 + 0.68 * a).toFixed(2)}`;
  }
}

function setPlayLabel(p: boolean): void { playBtn.textContent = p ? "⏸ Pause" : "▶ Play"; }
playBtn.addEventListener("click", () => { if (active) setPlayLabel(active.animator.toggle()); });
scrub.addEventListener("input", () => { if (!active) return; scrubbing = true; active.animator.pause(); active.animator.seek(Number(scrub.value) / 1000); setPlayLabel(false); });
scrub.addEventListener("change", () => { scrubbing = false; });
speed.addEventListener("input", () => { playbackSpeed = Number(speed.value) / 100; speedVal.textContent = `${playbackSpeed.toFixed(2)}×`; active?.animator.setSpeed(playbackSpeed); });
showMuscles.addEventListener("change", () => figure?.setMusclesVisible(showMuscles.checked));

stage.setFrameCallback((dt) => {
  if (!active || !figure) return;
  const s = active.animator.update(dt);
  figure.pose(s, armPoseFor(active.exercise.id), groundFor(active.exercise.id));
  if (showMuscles.checked) figure.setActivations(s.muscles);
  active.equipment.update();
  updateReadout(s);
  if (!scrubbing) scrub.value = `${Math.round(s.progress * 1000)}`;
});

aboutEl.textContent = "모델 로딩 중… · loading model…";
HumanFigure.load(MODEL_URL).then((f) => {
  figure = f;
  stage.scene.add(f.root);
  stage.start();
  loadExercise(EXERCISES[0]);
}).catch((e) => { aboutEl.textContent = "모델 로드 실패: " + (e as Error).message; });
