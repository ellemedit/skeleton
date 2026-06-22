/**
 * Headless 3D render of the rigged human model performing each lift.
 *
 * No WebGL2/browser here, so we: load the GLB (three GLTFLoader works in Node),
 * retarget the validated rig poses onto its skeleton, CPU-skin the mesh, paint
 * muscle activation onto the skin as a heatmap, and software-rasterize with
 * smooth shading + SSAA + a contact shadow. The browser demo renders the same
 * model/poses with WebGL.
 *
 * Run with: npm run render
 */
(globalThis as Record<string, unknown>).self ??= globalThis;
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import {
  SkinnedMesh, Mesh, Object3D, Vector3, Vector4, Matrix4, Matrix3, PerspectiveCamera, Color,
  type BufferGeometry, type MeshStandardMaterial,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PNG } from "pngjs";
import { Retargeter } from "../src/human/retarget";
import { armPoseFor, groundFor } from "../src/human/lifts";
import { muscleGroupOf, muscleEmissive } from "../src/human/muscleGroups";
import { EXERCISES } from "../src/exercises";
import { Barbell } from "../src/equipment/Barbell";
import { Dumbbell } from "../src/equipment/Dumbbell";
import { Bench } from "../src/equipment/Bench";
import type { Keyframe, MotionSample } from "../src/anatomy/types";
import type { MuscleId } from "../src/anatomy/rig";

const XBOT_URL = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb";
const CACHE = new URL("../.cache/xbot.glb", import.meta.url).pathname;
const OUT = new URL("../docs/figures/render/", import.meta.url).pathname;
const OW = 900, OH = 1150, SS = 3, W = OW * SS, H = OH * SS;

const KEY = new Vector3(3.5, 6, 4).normalize();
const FILL = new Vector3(-4, 2.5, -4).normalize();
const RIMT = new Color(0.55, 0.72, 1.0);
const CLAY = new Color(0.83, 0.79, 0.74);
const BG = new Color(0.082, 0.09, 0.108);
const GROUND = new Color(0.11, 0.12, 0.145);

const ONLY = process.env.ONLY;

// Per-exercise camera: view direction (from target) and distance multiplier.
const CAM: Record<string, { dir: [number, number, number]; dist: number }> = {
  squat: { dir: [0.5, 0.1, 1], dist: 2.2 },
  bench: { dir: [1, 0.6, 0.45], dist: 2.5 },
  deadlift: { dir: [0.45, 0.12, 1], dist: 2.3 },
  curl: { dir: [0.4, 0.05, 1], dist: 2.25 },
};

const sampleOf = (kf: Keyframe): MotionSample => ({
  pose: kf.pose, muscles: kf.muscles, root: kf.root ?? [0, 0, 0], rootRot: kf.rootRot ?? [0, 0, 0], label: kf.label, progress: kf.t,
});

async function loadModel(): Promise<SkinnedMesh> {
  if (!existsSync(CACHE)) {
    mkdirSync(new URL("../.cache/", import.meta.url).pathname, { recursive: true });
    const r = await fetch(XBOT_URL);
    writeFileSync(CACHE, Buffer.from(await r.arrayBuffer()));
  }
  const buf = readFileSync(CACHE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return await new Promise<SkinnedMesh>((res, rej) => {
    new GLTFLoader().parse(ab, "", (g) => {
      let m: SkinnedMesh | null = null;
      g.scene.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) m = o as SkinnedMesh; });
      m ? res(m) : rej(new Error("no skinned mesh"));
    }, rej);
  });
}

interface Drawable {
  pos: Float32Array; nor: Float32Array; idx: Uint32Array;
  base: Color; emissive?: Float32Array; shadow: boolean;
}

/** Bake a posed SkinnedMesh into world-space triangles + per-vertex emissive. */
function bakeHuman(sm: SkinnedMesh, group: (MuscleId | null)[], activation: Record<string, number>): Drawable {
  const geo = sm.geometry;
  const posA = geo.getAttribute("position"), norA = geo.getAttribute("normal");
  const si = geo.getAttribute("skinIndex"), sw = geo.getAttribute("skinWeight");
  const N = posA.count;
  const bones = sm.skeleton.bones, binv = sm.skeleton.boneInverses;
  const skinMats = bones.map((b, i) => new Matrix4().multiplyMatrices(b.matrixWorld, binv[i]));
  const normMats = skinMats.map((m) => new Matrix3().getNormalMatrix(m));
  const bindM = sm.bindMatrix, bindI = sm.bindMatrixInverse, world = sm.matrixWorld;
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), emissive = new Float32Array(N * 3);
  const base = new Vector3(), nbase = new Vector3(), acc = new Vector3(), accN = new Vector3(), tmp = new Vector3(), nv = new Vector3();
  const ec = new Color();
  for (let i = 0; i < N; i++) {
    base.fromBufferAttribute(posA, i).applyMatrix4(bindM); nbase.fromBufferAttribute(norA, i);
    acc.set(0, 0, 0); accN.set(0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (!w) continue; const b = si.getComponent(i, k); acc.addScaledVector(tmp.copy(base).applyMatrix4(skinMats[b]), w); accN.addScaledVector(nv.copy(nbase).applyMatrix3(normMats[b]), w); }
    acc.applyMatrix4(bindI).applyMatrix4(world); pos[i * 3] = acc.x; pos[i * 3 + 1] = acc.y; pos[i * 3 + 2] = acc.z;
    accN.normalize(); nor[i * 3] = accN.x; nor[i * 3 + 1] = accN.y; nor[i * 3 + 2] = accN.z;
    const g = group[i]; const a = g ? activation[g] ?? 0 : 0;
    if (a > 0.04) { muscleEmissive(a, ec); emissive[i * 3] = ec.r; emissive[i * 3 + 1] = ec.g; emissive[i * 3 + 2] = ec.b; }
  }
  return { pos, nor, idx: Uint32Array.from(geo.getIndex()!.array), base: CLAY, emissive, shadow: true };
}

/** Bake a static three Object3D (equipment) into world-space triangles. */
function bakeObject(obj: Object3D): Drawable[] {
  obj.updateWorldMatrix(true, true);
  const out: Drawable[] = [];
  obj.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry as BufferGeometry;
    const p = geo.getAttribute("position"), nAttr = geo.getAttribute("normal");
    const idxAttr = geo.getIndex();
    const nm = new Matrix3().getNormalMatrix(m.matrixWorld);
    const N = p.count; const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3);
    const v = new Vector3(), nv = new Vector3();
    for (let i = 0; i < N; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      nv.fromBufferAttribute(nAttr, i).applyMatrix3(nm).normalize(); nor[i * 3] = nv.x; nor[i * 3 + 1] = nv.y; nor[i * 3 + 2] = nv.z;
    }
    const idx = idxAttr ? Uint32Array.from(idxAttr.array) : Uint32Array.from({ length: N }, (_, i) => i);
    out.push({ pos, nor, idx, base: (m.material as MeshStandardMaterial).color ?? new Color(0.5, 0.5, 0.5), shadow: true });
  });
  return out;
}

// ---- rasterizer ----
const rgb = new Float32Array(W * H * 3), depth = new Float32Array(W * H), fig = new Uint8Array(W * H), shadowA = new Float32Array(W * H);
function reset(): void { for (let i = 0; i < W * H; i++) { const g = i / (W * H); rgb[i * 3] = BG.r * (1 - g * 0.3); rgb[i * 3 + 1] = BG.g * (1 - g * 0.3); rgb[i * 3 + 2] = BG.b * (1 - g * 0.3); depth[i] = Infinity; fig[i] = 0; shadowA[i] = 0; } }

function render(drawables: Drawable[], cam: PerspectiveCamera): void {
  reset();
  // ground
  const gy = 0;
  const camPos = cam.position.clone();
  const vp = new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const clip = new Vector4();
  const proj = (x: number, y: number, z: number) => { clip.set(x, y, z, 1).applyMatrix4(vp); return { x: (clip.x / clip.w * .5 + .5) * W, y: (1 - (clip.y / clip.w * .5 + .5)) * H, z: clip.z / clip.w, w: clip.w }; };

  // ground plane as a big quad
  {
    const R = 6;
    const corners = [[-R, gy, -R], [R, gy, -R], [R, gy, R], [-R, gy, R]].map((c) => proj(c[0], c[1], c[2]));
    rasterFlat(corners[0], corners[1], corners[2], GROUND); rasterFlat(corners[0], corners[2], corners[3], GROUND);
  }

  for (const d of drawables) {
    for (let t = 0; t < d.idx.length; t += 3) {
      const i0 = d.idx[t], i1 = d.idx[t + 1], i2 = d.idx[t + 2];
      const a = proj(d.pos[i0 * 3], d.pos[i0 * 3 + 1], d.pos[i0 * 3 + 2]);
      const b = proj(d.pos[i1 * 3], d.pos[i1 * 3 + 1], d.pos[i1 * 3 + 2]);
      const c = proj(d.pos[i2 * 3], d.pos[i2 * 3 + 1], d.pos[i2 * 3 + 2]);
      if (a.w <= 0 || b.w <= 0 || c.w <= 0) continue;
      scan(a, b, c, (x, y, w0, w1, w2) => {
        const dep = w0 * a.z + w1 * b.z + w2 * c.z; const di = y * W + x; if (dep >= depth[di]) return; depth[di] = dep; fig[di] = 1;
        let nx = w0 * d.nor[i0 * 3] + w1 * d.nor[i1 * 3] + w2 * d.nor[i2 * 3], ny = w0 * d.nor[i0 * 3 + 1] + w1 * d.nor[i1 * 3 + 1] + w2 * d.nor[i2 * 3 + 1], nz = w0 * d.nor[i0 * 3 + 2] + w1 * d.nor[i1 * 3 + 2] + w2 * d.nor[i2 * 3 + 2];
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const wx = w0 * d.pos[i0 * 3] + w1 * d.pos[i1 * 3] + w2 * d.pos[i2 * 3], wy = w0 * d.pos[i0 * 3 + 1] + w1 * d.pos[i1 * 3 + 1] + w2 * d.pos[i2 * 3 + 1], wz = w0 * d.pos[i0 * 3 + 2] + w1 * d.pos[i1 * 3 + 2] + w2 * d.pos[i2 * 3 + 2];
        let vx = camPos.x - wx, vy = camPos.y - wy, vz = camPos.z - wz; const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
        const kd = Math.max(0, nx * KEY.x + ny * KEY.y + nz * KEY.z) * .92, fd = Math.max(0, nx * FILL.x + ny * FILL.y + nz * FILL.z) * .26;
        const fres = Math.pow(1 - Math.max(0, nx * vx + ny * vy + nz * vz), 3) * .32, lum = .33 + kd + fd;
        let er = 0, eg = 0, eb = 0;
        if (d.emissive) { er = w0 * d.emissive[i0 * 3] + w1 * d.emissive[i1 * 3] + w2 * d.emissive[i2 * 3]; eg = w0 * d.emissive[i0 * 3 + 1] + w1 * d.emissive[i1 * 3 + 1] + w2 * d.emissive[i2 * 3 + 1]; eb = w0 * d.emissive[i0 * 3 + 2] + w1 * d.emissive[i1 * 3 + 2] + w2 * d.emissive[i2 * 3 + 2]; }
        rgb[di * 3] = d.base.r * lum + fres * RIMT.r + er; rgb[di * 3 + 1] = d.base.g * lum + fres * RIMT.g + eg; rgb[di * 3 + 2] = d.base.b * lum + fres * RIMT.b + eb;
      });
      // contact shadow (flatten to ground)
      if (d.shadow) {
        const fa = proj(d.pos[i0 * 3], 0.01, d.pos[i0 * 3 + 2]), fb = proj(d.pos[i1 * 3], 0.01, d.pos[i1 * 3 + 2]), fc = proj(d.pos[i2 * 3], 0.01, d.pos[i2 * 3 + 2]);
        if (fa.w > 0 && fb.w > 0 && fc.w > 0) scan(fa, fb, fc, (x, y) => { shadowA[y * W + x] = 1; });
      }
    }
  }
  blurShadow(Math.round(SS * 2.5));
  for (let i = 0; i < W * H; i++) { if (fig[i]) continue; const s = Math.min(1, shadowA[i]) * 0.55; if (s > 0) { rgb[i * 3] *= 1 - s; rgb[i * 3 + 1] *= 1 - s; rgb[i * 3 + 2] *= 1 - s; } }
}

interface SP { x: number; y: number; z: number; w: number }
function rasterFlat(a: SP, b: SP, c: SP, col: Color): void {
  if (a.w <= 0 || b.w <= 0 || c.w <= 0) return;
  scan(a, b, c, (x, y, w0, w1, w2) => { const dep = w0 * a.z + w1 * b.z + w2 * c.z; const di = y * W + x; if (dep >= depth[di]) return; depth[di] = dep; rgb[di * 3] = col.r; rgb[di * 3 + 1] = col.g; rgb[di * 3 + 2] = col.b; });
}
function scan(a: SP, b: SP, c: SP, cb: (x: number, y: number, w0: number, w1: number, w2: number) => void): void {
  const mnx = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), mxx = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const mny = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), mxy = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  if (mnx > mxx || mny > mxy) return;
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); if (Math.abs(area) < 1e-9) return; const inv = 1 / area;
  for (let y = mny; y <= mxy; y++) for (let x = mnx; x <= mxx; x++) {
    const px = x + .5, py = y + .5;
    const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
    const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
    const w2 = 1 - w0 - w1; if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue; cb(x, y, w0, w1, w2);
  }
}
function blurShadow(r: number): void {
  const tmp = new Float32Array(W * H), k = r * 2 + 1;
  for (let y = 0; y < H; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += shadowA[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = acc / k; acc += shadowA[y * W + Math.min(W - 1, x + r + 1)] - shadowA[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { shadowA[y * W + x] = acc / k; acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
}
function writePNG(file: string): void {
  const png = new PNG({ width: OW, height: OH }), n = SS * SS;
  for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) { let r = 0, g = 0, b = 0; for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) { const s = ((oy * SS + sy) * W + ox * SS + sx) * 3; r += rgb[s]; g += rgb[s + 1]; b += rgb[s + 2]; } const o = (oy * OW + ox) * 4; png.data[o] = Math.min(255, (r / n) ** .9 * 255); png.data[o + 1] = Math.min(255, (g / n) ** .9 * 255); png.data[o + 2] = Math.min(255, (b / n) ** .9 * 255); png.data[o + 3] = 255; }
  writeFileSync(file, PNG.sync.write(png));
}

function frameCamera(drawables: Drawable[], exId: string): PerspectiveCamera {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  const h = drawables[0];
  for (let i = 0; i < h.pos.length; i += 3) { minX = Math.min(minX, h.pos[i]); maxX = Math.max(maxX, h.pos[i]); minY = Math.min(minY, h.pos[i + 1]); maxY = Math.max(maxY, h.pos[i + 1]); minZ = Math.min(minZ, h.pos[i + 2]); maxZ = Math.max(maxZ, h.pos[i + 2]); }
  const target = new Vector3((minX + maxX) / 2, (minY + maxY) / 2 + 0.03, (minZ + maxZ) / 2);
  const span = Math.max(maxY - minY, maxX - minX, maxZ - minZ);
  const c = CAM[exId] ?? { dir: [0.5, 0.08, 1], dist: 2.2 };
  const cam = new PerspectiveCamera(34, OW / OH, 0.01, 100);
  cam.position.copy(target).add(new Vector3(...c.dir).normalize().multiplyScalar(span * c.dist));
  cam.lookAt(target); cam.updateMatrixWorld(true);
  return cam;
}

// ---- main ----
const sm = await loadModel();
sm.updateMatrixWorld(true);
sm.skeleton.update();
const geo = sm.geometry;
const posA = geo.getAttribute("position"), si = geo.getAttribute("skinIndex"), sw = geo.getAttribute("skinWeight");
const group: (MuscleId | null)[] = [];
for (let i = 0; i < posA.count; i++) {
  let bw = -1, bi = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } }
  group.push(muscleGroupOf(sm.skeleton.bones[bi]?.name ?? "", posA.getX(i), posA.getY(i), posA.getZ(i)));
}
const retargeter = new Retargeter(sm.skeleton);

const handPos = (side: "Left" | "Right") => sm.skeleton.getBoneByName(`mixamorig${side}Hand`)!.getWorldPosition(new Vector3());

function equipmentFor(exId: string): Drawable[] {
  const out: Drawable[] = [];
  if (exId === "curl") {
    for (const side of ["Left", "Right"] as const) {
      const db = new Dumbbell();
      db.group.position.copy(handPos(side));
      db.group.rotation.set(0, 0, 0);
      out.push(...bakeObject(db.group));
    }
  } else {
    const bar = new Barbell({ plateRadius: exId === "deadlift" ? 0.225 : 0.22 });
    bar.spanBetween(handPos("Left"), handPos("Right"));
    out.push(...bakeObject(bar.group));
    if (exId === "bench") {
      const bench = new Bench(0.5);
      const hips = sm.skeleton.getBoneByName("mixamorigHips")!.getWorldPosition(new Vector3());
      bench.group.position.set(0, 0, hips.z);
      out.push(...bakeObject(bench.group));
    }
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
for (const ex of EXERCISES) {
  if (ONLY && ex.id !== ONLY) continue;
  const kf = ex.keyframes[ex.keyframes.length - 1];
  retargeter.apply(sampleOf(kf), armPoseFor(ex.id), groundFor(ex.id));
  const human = bakeHuman(sm, group, kf.muscles);
  const equip = equipmentFor(ex.id);
  render([human, ...equip], frameCamera([human], ex.id));
  writePNG(`${OUT}${ex.id}.png`);
  console.log(`rendered ${ex.id}.png  [${kf.label}]`);
}
console.log("done");
