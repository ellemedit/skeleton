/**
 * Headless visual snapshots.
 *
 * WebGL cannot run in this environment, but the scene-graph math does. This
 * script drives the real Mannequin + Exercises and projects the resulting
 * world-space geometry into a 3/4 turntable view, writing one SVG per pose to
 * docs/figures/. The muscle dots are colored by the same activation/heatmap
 * the 3D renderer uses, so the SVGs are a faithful 2D preview of a pose.
 *
 * Run with: npm run snapshot
 */
import { Group, Vector3, Object3D } from "three";
import { writeFileSync, mkdirSync } from "node:fs";
import { Mannequin } from "../src/anatomy/Mannequin";
import { BONES } from "../src/anatomy/rig";
import { EXERCISES } from "../src/exercises";
import { heatColor, CLAY } from "../src/core/colors";
import type { Keyframe, MotionSample } from "../src/anatomy/types";

const BETA = (28 * Math.PI) / 180; // turntable angle about Y
const W = 380;
const H = 460;
const OUT = new URL("../docs/figures/", import.meta.url).pathname;

const cosB = Math.cos(BETA);
const sinB = Math.sin(BETA);
/** Project a world point into the turntable view (screen units, Y up). */
function project(p: Vector3): [number, number] {
  return [p.x * cosB + p.z * sinB, p.y];
}

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

function findByName(root: Object3D, name: string): Object3D[] {
  const out: Object3D[] = [];
  root.traverse((o) => {
    if (o.name === name) out.push(o);
  });
  return out;
}

interface Dot { x: number; y: number; r: number; color: string; opacity: number }
interface Line { x1: number; y1: number; x2: number; y2: number; w: number; color: string; cap: string }

function renderPose(id: string, kf: Keyframe): string {
  const mannequin = new Mannequin();
  const container = new Group();
  container.add(mannequin.root);
  const ex = EXERCISES.find((e) => e.id === id)!;
  const instance = ex.setup(container, mannequin);

  mannequin.apply(sampleOf(kf));
  container.updateMatrixWorld(true);
  instance.update();
  container.updateMatrixWorld(true);

  const lines: Line[] = [];
  const muscleDots: Dot[] = [];
  const overDots: Dot[] = [];
  const pts: [number, number][] = [];
  const add = (p: [number, number]) => (pts.push(p), p);
  const clay = `#${CLAY.getHexString()}`;

  // Muscle overlays (drawn first, under the skeleton), colored by activation.
  for (const m of mannequin.muscleList) {
    const a = m.getActivation();
    const p = project(m.getWorldPosition());
    add(p);
    muscleDots.push({
      x: p[0],
      y: p[1],
      r: m.meanRadius * (0.85 + a * 0.5),
      color: a > 0.04 ? `#${heatColor(a).getHexString()}` : clay,
      opacity: 0.16 + 0.62 * a,
    });
  }

  // Skeleton bones (parent -> child), drawn over the muscle glow.
  const wpos = (n: string) => mannequin.getJointWorldPosition(n).clone();
  for (const b of BONES) {
    if (!b.parent) continue;
    const a = project(wpos(b.parent));
    const c = project(wpos(b.name));
    add(a);
    add(c);
    const r = (b.radius ?? 0.055) * 1.5;
    lines.push({ x1: a[0], y1: a[1], x2: c[0], y2: c[1], w: r, color: "#d7d1c6", cap: "round" });
  }
  // Head node.
  const headP = project(wpos("head").add(new Vector3(0, 0.08, 0)));
  overDots.push({ x: headP[0], y: headP[1], r: 0.115, color: "#d7d1c6", opacity: 1 });
  add(headP);

  // Equipment.
  const under: Line[] = [];
  for (const bench of findByName(container, "bench")) {
    const e1 = project(bench.localToWorld(new Vector3(0, 0.45, -0.625)));
    const e2 = project(bench.localToWorld(new Vector3(0, 0.45, 0.625)));
    add(e1);
    add(e2);
    under.push({ x1: e1[0], y1: e1[1], x2: e2[0], y2: e2[1], w: 0.16, color: "#2b2f38", cap: "round" });
  }
  const bars: Line[] = [];
  for (const bar of findByName(container, "barbell")) {
    const e1 = project(bar.localToWorld(new Vector3(-1.1, 0, 0)));
    const e2 = project(bar.localToWorld(new Vector3(1.1, 0, 0)));
    add(e1);
    add(e2);
    bars.push({ x1: e1[0], y1: e1[1], x2: e2[0], y2: e2[1], w: 0.05, color: "#5b606b", cap: "butt" });
    for (const s of [-1, 1]) {
      const pl = project(bar.localToWorld(new Vector3(s * 0.75, 0, 0)));
      overDots.push({ x: pl[0], y: pl[1], r: 0.2, color: "#26282e", opacity: 1 });
    }
  }
  for (const db of findByName(container, "dumbbell")) {
    const e1 = project(db.localToWorld(new Vector3(-0.21, 0, 0)));
    const e2 = project(db.localToWorld(new Vector3(0.21, 0, 0)));
    add(e1);
    add(e2);
    bars.push({ x1: e1[0], y1: e1[1], x2: e2[0], y2: e2[1], w: 0.04, color: "#5b606b", cap: "butt" });
    for (const e of [e1, e2]) overDots.push({ x: e[0], y: e[1], r: 0.075, color: "#26282e", opacity: 1 });
  }

  // Fit to canvas.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs, -0.6);
  const maxX = Math.max(...xs, 0.6);
  const minY = Math.min(...ys, -0.05);
  const maxY = Math.max(...ys, 1.8);
  const pad = 28;
  const scale = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
  const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = H - pad + minY * scale;
  const sx = (x: number) => x * scale + ox;
  const sy = (y: number) => oy - y * scale;

  const floorY = sy(0);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
  svg += `<rect width="${W}" height="${H}" fill="#15171c"/>\n`;
  svg += `<line x1="0" y1="${floorY.toFixed(1)}" x2="${W}" y2="${floorY.toFixed(1)}" stroke="#2c3038" stroke-width="1"/>\n`;
  const circle = (d: Dot) =>
    `<circle cx="${sx(d.x).toFixed(1)}" cy="${sy(d.y).toFixed(1)}" r="${(d.r * scale).toFixed(1)}" fill="${d.color}" opacity="${d.opacity.toFixed(2)}"/>\n`;
  const drawLine = (l: Line) =>
    `<line x1="${sx(l.x1).toFixed(1)}" y1="${sy(l.y1).toFixed(1)}" x2="${sx(l.x2).toFixed(1)}" y2="${sy(l.y2).toFixed(1)}" stroke="${l.color}" stroke-width="${(l.w * scale).toFixed(1)}" stroke-linecap="${l.cap}"/>\n`;
  for (const l of under) svg += drawLine(l);
  for (const d of muscleDots) svg += circle(d);
  for (const l of lines) svg += drawLine(l);
  for (const d of overDots) svg += circle(d);
  for (const b of bars) svg += drawLine(b);
  svg += `<text x="16" y="28" fill="#e8e6e1" font-family="sans-serif" font-size="15" font-weight="700">${ex.nameKo} · ${ex.name}</text>\n`;
  svg += `<text x="16" y="46" fill="#8b9099" font-family="sans-serif" font-size="11">${kf.label}</text>\n`;
  svg += `</svg>\n`;

  instance.dispose();
  return svg;
}

/** Optionally rasterize to PNG if @resvg/resvg-js is installed (graceful). */
async function loadRasterizer(): Promise<((svg: string) => Buffer) | null> {
  try {
    // Indirect specifier so the optional native dep isn't a compile-time
    // requirement (fresh clones without it still typecheck and emit SVGs).
    const spec = "@resvg/resvg-js";
    const mod = (await import(spec)) as {
      Resvg: new (svg: string, opts: unknown) => { render: () => { asPng: () => Buffer } };
    };
    return (svg: string) => new mod.Resvg(svg, { fitTo: { mode: "width", value: 380 } }).render().asPng();
  } catch {
    return null;
  }
}

const rasterize = await loadRasterizer();
mkdirSync(OUT, { recursive: true });
let count = 0;
for (const ex of EXERCISES) {
  for (const kf of ex.keyframes) {
    const phase = kf.label.split(" ")[0];
    const base = `${OUT}${ex.id}-${phase}`;
    const svg = renderPose(ex.id, kf);
    writeFileSync(`${base}.svg`, svg);
    if (rasterize) writeFileSync(`${base}.png`, rasterize(svg));
    count++;
    console.log(`wrote docs/figures/${ex.id}-${phase}.svg${rasterize ? " (+png)" : ""}`);
  }
}
console.log(`\n${count} snapshot(s) written.${rasterize ? "" : "\n(install @resvg/resvg-js to also emit PNG previews)"}`);
