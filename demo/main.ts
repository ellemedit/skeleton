import { Stage } from "../src/core/Stage";
import { Mannequin } from "../src/anatomy/Mannequin";
import { Animator } from "../src/motion/Animator";
import { EXERCISES } from "../src/exercises";
import type { Exercise, ExerciseInstance } from "../src/exercises";
import { MUSCLE_IDS, MUSCLE_INFO } from "../src/anatomy/rig";
import { heatColor, ACCENT } from "../src/core/colors";
import type { ColorMode, MotionSample } from "../src/anatomy/types";

// --- DOM helpers -----------------------------------------------------------
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const stageEl = $("#stage");
const exercisesEl = $("#exercises");
const aboutEl = $("#about");
const phaseEl = $("#phase");
const playBtn = $<HTMLButtonElement>("#play");
const scrub = $<HTMLInputElement>("#scrub");
const speed = $<HTMLInputElement>("#speed");
const speedVal = $("#speedVal");
const colorModeEl = $("#colorMode");
const showMuscles = $<HTMLInputElement>("#showMuscles");
const barsEl = $("#bars");

// --- Scene -----------------------------------------------------------------
const stage = new Stage(stageEl);
const mannequin = new Mannequin();
stage.scene.add(mannequin.root);

let colorMode: ColorMode = "heatmap";
let playbackSpeed = 1;
let scrubbing = false;

interface Active {
  exercise: Exercise;
  instance: ExerciseInstance;
  animator: Animator;
}
let active: Active | null = null;

// --- Exercise selector -----------------------------------------------------
const chipButtons = EXERCISES.map((ex) => {
  const btn = document.createElement("button");
  btn.textContent = ex.nameKo;
  btn.title = ex.name;
  btn.addEventListener("click", () => loadExercise(ex));
  exercisesEl.appendChild(btn);
  return { ex, btn };
});

function loadExercise(ex: Exercise): void {
  active?.instance.dispose();
  const instance = ex.setup(stage.scene, mannequin);
  const animator = new Animator(ex.keyframes, { duration: ex.duration, loop: ex.loop, speed: playbackSpeed });
  mannequin.setColorMode(colorMode);
  stage.applyCameraHint(instance.camera);
  active = { exercise: ex, instance, animator };

  aboutEl.textContent = ex.description;
  for (const c of chipButtons) c.btn.classList.toggle("active", c.ex === ex);
  setPlayLabel(true);
}

// --- Muscle activation legend ----------------------------------------------
const fills = new Map<string, HTMLElement>();
const rows = new Map<string, HTMLElement>();
for (const id of MUSCLE_IDS) {
  const row = document.createElement("div");
  row.className = "bar-row";
  const name = document.createElement("span");
  name.className = "bar-name";
  name.textContent = MUSCLE_INFO[id].label.split(" · ")[1] ?? MUSCLE_INFO[id].label;
  const track = document.createElement("div");
  track.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  track.appendChild(fill);
  row.append(name, track);
  barsEl.appendChild(row);
  fills.set(id, fill);
  rows.set(id, row);
}

function updateReadout(sample: MotionSample): void {
  phaseEl.textContent = `${sample.label} · ${Math.round(sample.progress * 100)}%`;
  for (const id of MUSCLE_IDS) {
    const a = sample.muscles[id] ?? 0;
    const fill = fills.get(id)!;
    fill.style.width = `${(a * 100).toFixed(0)}%`;
    fill.style.backgroundColor =
      colorMode === "accent" ? ACCENT.getStyle() : heatColor(Math.max(a, 0.15)).getStyle();
    rows.get(id)!.style.opacity = `${(0.32 + 0.68 * a).toFixed(2)}`;
  }
}

// --- Controls --------------------------------------------------------------
function setPlayLabel(playing: boolean): void {
  playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
}

playBtn.addEventListener("click", () => {
  if (!active) return;
  setPlayLabel(active.animator.toggle());
});

scrub.addEventListener("input", () => {
  if (!active) return;
  scrubbing = true;
  active.animator.pause();
  active.animator.seek(Number(scrub.value) / 1000);
  setPlayLabel(false);
});
scrub.addEventListener("change", () => {
  scrubbing = false;
});

speed.addEventListener("input", () => {
  playbackSpeed = Number(speed.value) / 100;
  speedVal.textContent = `${playbackSpeed.toFixed(2)}×`;
  active?.animator.setSpeed(playbackSpeed);
});

colorModeEl.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    colorMode = (btn as HTMLElement).dataset.mode as ColorMode;
    mannequin.setColorMode(colorMode);
    colorModeEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  });
});

showMuscles.addEventListener("change", () => {
  mannequin.setMusclesVisible(showMuscles.checked);
});

// --- Render loop -----------------------------------------------------------
stage.setFrameCallback((dt) => {
  if (!active) return;
  const sample = active.animator.update(dt);
  mannequin.apply(sample);
  active.instance.update();
  updateReadout(sample);
  if (!scrubbing) scrub.value = `${Math.round(sample.progress * 1000)}`;
});

stage.start();
loadExercise(EXERCISES[0]);
