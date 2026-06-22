import {
  SkinnedMesh, Object3D, Bone, Color, MeshStandardMaterial, Float32BufferAttribute, Vector3,
} from "three";

/** Minimal shape of the object passed to MeshStandardMaterial.onBeforeCompile. */
interface CompileShader { vertexShader: string; fragmentShader: string }
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Retargeter, type ArmPose } from "./retarget";
import { muscleGroupOf, muscleEmissive } from "./muscleGroups";
import { CLAY } from "../core/colors";
import type { MotionSample, MuscleActivation } from "../anatomy/types";
import type { MuscleId } from "../anatomy/rig";

/** A rigged Mixamo character whose poses are driven by the procedural rig and
 *  whose muscles light up (per-vertex emissive heatmap) by activation. */
export class HumanFigure {
  readonly root: Object3D;
  readonly mesh: SkinnedMesh;
  private readonly retargeter: Retargeter;
  private readonly group: (MuscleId | null)[] = [];
  private readonly heat: Float32BufferAttribute;
  private readonly material: MeshStandardMaterial;

  private constructor(root: Object3D, mesh: SkinnedMesh) {
    this.root = root;
    this.mesh = mesh;
    mesh.updateMatrixWorld(true);
    mesh.skeleton.update();
    this.retargeter = new Retargeter(mesh.skeleton);

    // Per-vertex muscle group + a heat attribute injected into the emissive.
    const pos = mesh.geometry.getAttribute("position");
    const si = mesh.geometry.getAttribute("skinIndex");
    const sw = mesh.geometry.getAttribute("skinWeight");
    for (let i = 0; i < pos.count; i++) {
      let bw = -1, bi = 0;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } }
      this.group.push(muscleGroupOf(mesh.skeleton.bones[bi]?.name ?? "", pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    this.heat = new Float32BufferAttribute(new Float32Array(pos.count * 3), 3);
    this.heat.setUsage(35048 /* DynamicDrawUsage */);
    mesh.geometry.setAttribute("heat", this.heat);

    this.material = new MeshStandardMaterial({ color: new Color().copy(CLAY), roughness: 0.82, metalness: 0 });
    this.material.onBeforeCompile = (shader: CompileShader) => {
      shader.vertexShader = "attribute vec3 heat;\nvarying vec3 vHeat;\n" +
        shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHeat = heat;");
      shader.fragmentShader = "varying vec3 vHeat;\n" +
        shader.fragmentShader.replace("vec3 totalEmissiveRadiance = emissive;", "vec3 totalEmissiveRadiance = emissive + vHeat;");
    };
    mesh.material = this.material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  static async load(url: string): Promise<HumanFigure> {
    const gltf = await new GLTFLoader().loadAsync(url);
    let mesh: SkinnedMesh | null = null;
    gltf.scene.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh; });
    if (!mesh) throw new Error("GLB has no skinned mesh");
    return new HumanFigure(gltf.scene, mesh);
  }

  /** Pose the figure for a motion sample + exercise arm pose. */
  pose(sample: MotionSample, armPose: ArmPose, ground: boolean): void {
    this.retargeter.apply(sample, armPose, ground);
  }

  /** Paint muscle activation onto the skin (heatmap emissive). */
  setActivations(map: MuscleActivation): void {
    const c = new Color();
    const arr = this.heat.array as Float32Array;
    for (let i = 0; i < this.group.length; i++) {
      const g = this.group[i];
      const a = g ? map[g] ?? 0 : 0;
      if (a > 0.04) { muscleEmissive(a, c); arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      else { arr[i * 3] = 0; arr[i * 3 + 1] = 0; arr[i * 3 + 2] = 0; }
    }
    this.heat.needsUpdate = true;
  }

  setMusclesVisible(visible: boolean): void {
    if (!visible) { (this.heat.array as Float32Array).fill(0); this.heat.needsUpdate = true; }
  }

  getBoneWorld(name: string, target = new Vector3()): Vector3 {
    const b = this.mesh.skeleton.getBoneByName(name) as Bone | undefined;
    return b ? b.getWorldPosition(target) : target.set(0, 0, 0);
  }
}
