import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  AmbientLight,
  CircleGeometry,
  MeshStandardMaterial,
  Mesh,
  GridHelper,
  PCFSoftShadowMap,
  Clock,
  Vector3,
  ACESFilmicToneMapping,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BACKGROUND, GROUND } from "./colors";
import type { Vec3 } from "../anatomy/types";

export interface CameraHint {
  target: Vec3;
  position: Vec3;
}

/**
 * Sets up the WebGL renderer, scene, lighting, ground, orbit controls and a
 * requestAnimationFrame loop. Call `onFrame` to drive per-frame logic and
 * `dispose` to tear everything down.
 */
export class Stage {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;

  private readonly clock = new Clock();
  private frameCallback: ((dt: number) => void) | null = null;
  private running = false;
  private readonly onResize = () => this.resize();

  constructor(private readonly container: HTMLElement) {
    this.scene.background = BACKGROUND.clone();

    this.camera = new PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(2.6, 1.4, 3.0);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.9, 0);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 8;

    this.addLights();
    this.addGround();
    this.resize();
    window.addEventListener("resize", this.onResize);
  }

  private addLights(): void {
    this.scene.add(new HemisphereLight(0xbfd4ff, 0x202024, 0.55));
    this.scene.add(new AmbientLight(0xffffff, 0.18));

    const key = new DirectionalLight(0xfff1e0, 2.1);
    key.position.set(3.5, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    const rim = new DirectionalLight(0x6fa8ff, 0.9);
    rim.position.set(-4, 3, -4);
    this.scene.add(rim);
  }

  private addGround(): void {
    const ground = new Mesh(
      new CircleGeometry(8, 64),
      new MeshStandardMaterial({ color: GROUND, roughness: 0.96, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new GridHelper(16, 32, 0x2c3038, 0x23262d);
    (grid.material as { opacity: number; transparent: boolean }).opacity = 0.35;
    (grid.material as { transparent: boolean }).transparent = true;
    this.scene.add(grid);
  }

  /** Smoothly is not required; snaps the camera + target to a hint. */
  applyCameraHint(hint: CameraHint): void {
    this.camera.position.set(...(hint.position as [number, number, number]));
    this.controls.target.set(...(hint.target as [number, number, number]));
    this.controls.update();
  }

  setFrameCallback(cb: (dt: number) => void): void {
    this.frameCallback = cb;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.frameCallback?.(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    this.running = false;
    window.removeEventListener("resize", this.onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Convenience re-export of the camera target as a Vector3. */
  get target(): Vector3 {
    return this.controls.target;
  }
}
