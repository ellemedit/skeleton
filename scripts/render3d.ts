/**
 * Headless 3D render — software rasterizer.
 *
 * This environment has no WebGL2 (headless-gl is WebGL1 only) and no browser,
 * so instead of WebGL we rasterize the *actual* three.js scene geometry on the
 * CPU: every Mesh's triangles are transformed by the real camera, depth-tested
 * (z-buffer), flat-shaded by their world normal, and tinted by the same
 * material color / muscle emissive heat the WebGL renderer uses. The output is
 * a true 3D render of the model (volumetric capsules/boxes/ellipsoids), not a
 * 2D schematic.
 *
 * Run with: npm run render
 */
import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  Scene,
  PerspectiveCamera,
  Mesh,
  Vector3,
  Vector4,
  Matrix3,
  Matrix4,
  Color,
  CircleGeometry,
  MeshStandardMaterial,
  type BufferGeometry,
} from "three";
import { Mannequin } from "../src/anatomy/Mannequin";
import { EXERCISES } from "../src/exercises";
import { BACKGROUND, GROUND } from "../src/core/colors";
import type { Keyframe, MotionSample } from "../src/anatomy/types";

const W = 900;
const H = 1120;
const OUT = new URL("../docs/figures/render/", import.meta.url).pathname;

// Lighting (matches the WebGL stage's intent): warm key + cool fill + ambient.
const KEY = new Vector3(3.5, 6, 4).normalize();
const FILL = new Vector3(-4, 3, -4).normalize();
const AMBIENT = 0.32;
const KEY_I = 0.86;
const FILL_I = 0.22;
const KEY_TINT = new Color(1.0, 0.95, 0.88);
const FILL_TINT = new Color(0.66, 0.78, 1.0);

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

class Framebuffer {
  rgb = new Float32Array(W * H * 3);
  depth = new Float32Array(W * H).fill(Infinity);
  constructor(bg: Color) {
    for (let i = 0; i < W * H; i++) {
      this.rgb[i * 3] = bg.r;
      this.rgb[i * 3 + 1] = bg.g;
      this.rgb[i * 3 + 2] = bg.b;
    }
  }
  toPNG(): Buffer {
    const png = new PNG({ width: W, height: H });
    for (let i = 0; i < W * H; i++) {
      // gentle gamma for a softer look
      png.data[i * 4] = Math.min(255, Math.pow(this.rgb[i * 3], 0.9) * 255);
      png.data[i * 4 + 1] = Math.min(255, Math.pow(this.rgb[i * 3 + 1], 0.9) * 255);
      png.data[i * 4 + 2] = Math.min(255, Math.pow(this.rgb[i * 3 + 2], 0.9) * 255);
      png.data[i * 4 + 3] = 255;
    }
    return PNG.sync.write(png);
  }
}

interface SVert { x: number; y: number; z: number; ok: boolean }

function shade(baseColor: Color, n: Vector3, emissive: Color, emI: number): [number, number, number] {
  const kd = Math.max(0, n.dot(KEY)) * KEY_I;
  const fd = Math.max(0, n.dot(FILL)) * FILL_I;
  const r = baseColor.r * (AMBIENT + kd * KEY_TINT.r + fd * FILL_TINT.r) + emissive.r * emI;
  const g = baseColor.g * (AMBIENT + kd * KEY_TINT.g + fd * FILL_TINT.g) + emissive.g * emI;
  const b = baseColor.b * (AMBIENT + kd * KEY_TINT.b + fd * FILL_TINT.b) + emissive.b * emI;
  return [r, g, b];
}

function rasterizeScene(scene: Scene, camera: PerspectiveCamera): Framebuffer {
  const fb = new Framebuffer(BACKGROUND);
  const camPos = camera.getWorldPosition(new Vector3());
  const vp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

  const project = (p: Vector3, out: SVert) => {
    const v = new Vector4(p.x, p.y, p.z, 1).applyMatrix4(vp);
    if (v.w <= 1e-6) {
      out.ok = false;
      return;
    }
    out.x = (v.x / v.w * 0.5 + 0.5) * W;
    out.y = (1 - (v.y / v.w * 0.5 + 0.5)) * H;
    out.z = v.z / v.w;
    out.ok = true;
  };

  const a: SVert = { x: 0, y: 0, z: 0, ok: false };
  const b: SVert = { x: 0, y: 0, z: 0, ok: false };
  const c: SVert = { x: 0, y: 0, z: 0, ok: false };
  const wp0 = new Vector3();
  const wp1 = new Vector3();
  const wp2 = new Vector3();
  const n0 = new Vector3();
  const n1 = new Vector3();
  const n2 = new Vector3();
  const fn = new Vector3();
  const centroid = new Vector3();
  const viewDir = new Vector3();

  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const geo = obj.geometry as BufferGeometry;
    const pos = geo.getAttribute("position");
    const nor = geo.getAttribute("normal");
    if (!pos || !nor) return;
    const index = geo.getIndex();
    const world = obj.matrixWorld;
    const normalMat = new Matrix3().getNormalMatrix(world);
    const mat = obj.material as MeshStandardMaterial;
    const base = mat.color ?? new Color(0xffffff);
    const emissive = mat.emissive ?? new Color(0x000000);
    const emI = mat.emissiveIntensity ?? 0;

    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

      wp0.fromBufferAttribute(pos, i0).applyMatrix4(world);
      wp1.fromBufferAttribute(pos, i1).applyMatrix4(world);
      wp2.fromBufferAttribute(pos, i2).applyMatrix4(world);
      n0.fromBufferAttribute(nor, i0).applyMatrix3(normalMat);
      n1.fromBufferAttribute(nor, i1).applyMatrix3(normalMat);
      n2.fromBufferAttribute(nor, i2).applyMatrix3(normalMat);
      fn.copy(n0).add(n1).add(n2).normalize();

      centroid.copy(wp0).add(wp1).add(wp2).multiplyScalar(1 / 3);
      viewDir.copy(camPos).sub(centroid).normalize();
      if (fn.dot(viewDir) <= 0) continue; // back-facing

      project(wp0, a);
      project(wp1, b);
      project(wp2, c);
      if (!a.ok || !b.ok || !c.ok) continue;

      const [r, g, bl] = shade(base, fn, emissive, emI);
      fillTriangle(fb, a, b, c, r, g, bl);
    }
  });
  return fb;
}

function fillTriangle(fb: Framebuffer, a: SVert, b: SVert, c: SVert, r: number, g: number, bl: number): void {
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  if (minX > maxX || minY > maxY) return;

  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
      const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const depth = w0 * a.z + w1 * b.z + w2 * c.z;
      const di = y * W + x;
      if (depth >= fb.depth[di]) continue;
      fb.depth[di] = depth;
      const ci = di * 3;
      fb.rgb[ci] = r;
      fb.rgb[ci + 1] = g;
      fb.rgb[ci + 2] = bl;
    }
  }
}

function buildGround(scene: Scene): void {
  const ground = new Mesh(
    new CircleGeometry(8, 64),
    new MeshStandardMaterial({ color: GROUND, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}

mkdirSync(OUT, { recursive: true });
const camera = new PerspectiveCamera(40, W / H, 0.1, 100);
let n = 0;
for (const ex of EXERCISES) {
  const scene = new Scene();
  buildGround(scene);
  const mannequin = new Mannequin();
  scene.add(mannequin.root);
  const instance = ex.setup(scene, mannequin);
  mannequin.setColorMode("heatmap");

  const kf = ex.keyframes[ex.keyframes.length - 1]; // peak-load frame
  mannequin.apply(sampleOf(kf));
  instance.update();
  scene.updateMatrixWorld(true);

  camera.position.set(...(instance.camera.position as [number, number, number]));
  camera.lookAt(new Vector3(...(instance.camera.target as [number, number, number])));
  camera.updateMatrixWorld(true);

  const fb = rasterizeScene(scene, camera);
  writeFileSync(`${OUT}${ex.id}.png`, fb.toPNG());
  console.log(`rendered docs/figures/render/${ex.id}.png  [${kf.label}]`);
  instance.dispose();
  n++;
}
console.log(`\n${n} 3D render(s) complete.`);
