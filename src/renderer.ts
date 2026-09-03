import * as THREE from "three";
import {
  createGreenProbeMaterial,
  createLambertMaterial,
  createSilhouetteMaterial,
} from "./materials/lambert";
import { createPhysicalMaterial } from "./materials/physical";
import { SSS_DEFAULTS, createSssMaterial } from "./materials/sss";
import { CAMERA, POSES, lightDirection } from "./measure";
import type { PoseName } from "./measure";
import type { MeshName } from "./mesh";
import { MODE_FULL, MODE_THICKNESS } from "./modes";
import { mipChainBytes, textureBytes } from "./pack";
import {
  createLinearProbe,
  createMaskProbe,
  detectReadbackType,
} from "./probe";
import type { LinearProbe, MaskProbe, ReadbackType } from "./probe";
import { buildScene } from "./scene";
import type { SceneBundle } from "./scene";
import presentSource from "./shaders/fullscreen.vert.glsl?raw";
import presentFragSource from "./shaders/present.frag.glsl?raw";
import { loadThicknessSet } from "./thickness";
import type { ThicknessSet } from "./thickness";
import { GpuTimer } from "./timer";
import { backingSize } from "./viewport";

export type MaterialKind = "lambert" | "sss" | "physical";
export type MapSize = 128 | 256 | 512;

export const DEFAULT_SCALE = 0.75;
export const DEFAULT_MAP_SIZE: MapSize = 256;
export const MAP_SIZES: MapSize[] = [128, 256, 512];

export interface StageStats {
  fps: number;
  frameMs: number;
  gpuMs: number | null;
  width: number;
  height: number;
  material: MaterialKind;
  mapSize: MapSize | null; // null = constant thickness
  mode: number;
  pose: PoseName;
  lightAzimuthDeg: number;
  drawCalls: number;
  triangles: number;
  programs: number;
}

export interface TransmissionTargetInfo {
  width: number;
  height: number;
  bytesPerPixel: number;
  samples: number;
  bytes: number;
}

export interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly timer: GpuTimer;
  readonly gl: WebGL2RenderingContext;
  readonly readbackType: ReadbackType;
  loadMaps(mesh: MeshName): Promise<void>;
  loadedSizes(): MapSize[];
  resize(): void;
  render(timeSeconds: number): void;
  drawOnce(timed: boolean): Promise<void>;
  setMaterial(kind: MaterialKind): void;
  setMapSize(size: MapSize | null): void;
  setMesh(mesh: MeshName): void;
  setPose(pose: PoseName): void;
  setLight(azimuthDeg: number, elevationDeg: number): void;
  setMode(mode: number): void;
  setLobe(params: {
    power?: number;
    distortion?: number;
    wrap?: number;
    absorption?: number;
    scale?: number;
  }): void;
  setScale(scale: number): void;
  setFixedSize(w: number, h: number): void;
  orbit(dAzimuthDeg: number, dElevationDeg: number): void;
  zoom(delta: number): void;
  readLinearFrame(): Float32Array;
  readMask(): Uint8Array;
  readThickness(): Float32Array;
  readGreenProbe(which: "r8" | "rg8"): Float32Array;
  textureBytesFor(kind: MaterialKind): number;
  transmissionTarget(): TransmissionTargetInfo | null;
  triangleCount(): number;
  stats(): StageStats;
  dispose(): void;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });

  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (typeof WebGL2RenderingContext === "undefined") {
    throw new Error("no WebGL2 context");
  }

  // Color space contract: everything draws into the LINEAR intermediate target,
  // sRGB encoding only in the present pass. Tone mapping crushes the mean.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false; // more than one render() call per frame
  renderer.setPixelRatio(1);

  const timer = new GpuTimer(gl);
  const readbackType = detectReadbackType(renderer);

  const bundle: SceneBundle = buildScene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fovYDeg, 16 / 9, 0.1, 50);

  const lambertMaterial = createLambertMaterial();
  const sssMaterial = createSssMaterial(null);
  const physicalMaterial = createPhysicalMaterial(null);
  const silhouetteMaterial = createSilhouetteMaterial();
  const greenProbeMaterial = createGreenProbeMaterial(null);

  const presentMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: presentSource,
    fragmentShader: presentFragSource,
    uniforms: { uSource: { value: null as THREE.Texture | null } },
    depthTest: false,
    depthWrite: false,
  });
  const presentScene = new THREE.Scene();
  const presentQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    presentMaterial,
  );
  presentQuad.frustumCulled = false;
  presentScene.add(presentQuad);
  const presentCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let scale = DEFAULT_SCALE;
  let fixedSize: { width: number; height: number } | null = null;
  let material: MaterialKind = "sss";
  let mapSize: MapSize | null = DEFAULT_MAP_SIZE;
  let meshName: MeshName = "candle";
  let poseName: PoseName = "back";
  let lightAzimuthDeg: number = POSES[0].lightAzimuthDeg;
  let lightElevationDeg: number = POSES[0].lightElevationDeg;
  let cameraAzimuthDeg: number = CAMERA.azimuthDeg;
  let cameraElevationDeg: number = CAMERA.elevationDeg;
  let cameraDistance: number = CAMERA.distance;

  const maps = new Map<string, ThicknessSet>();

  const initial = resolveSize();
  renderer.setSize(initial.width, initial.height, false);
  const linear: LinearProbe = createLinearProbe(
    initial.width,
    initial.height,
    readbackType,
  );
  const mask: MaskProbe = createMaskProbe(initial.width, initial.height);
  presentMaterial.uniforms.uSource.value = linear.target.texture;

  let frameMs = 16.7;
  let fps = 0;
  let lastFrameTime = 0;
  let fpsFrames = 0;
  let fpsSince = 0;
  let drawCalls = 0;
  let triangles = 0;

  applyCamera();
  applyLight();
  applyMaterial();

  function resolveSize(): { width: number; height: number } {
    if (fixedSize) return fixedSize;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || canvas.clientWidth || 960;
    const cssHeight = rect.height || canvas.clientHeight || 540;
    return backingSize(
      cssWidth,
      cssHeight,
      window.devicePixelRatio || 1,
      scale,
    );
  }

  function applySize(width: number, height: number): void {
    renderer.setSize(width, height, false);
    linear.setSize(width, height);
    mask.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function applyCamera(): void {
    const el = (cameraElevationDeg * Math.PI) / 180;
    const az = (cameraAzimuthDeg * Math.PI) / 180;
    const r = cameraDistance * Math.cos(el);
    camera.position.set(
      r * Math.sin(az),
      cameraDistance * Math.sin(el),
      r * Math.cos(az),
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }

  function applyLight(): void {
    const dir = lightDirection(lightAzimuthDeg, lightElevationDeg);
    sssMaterial.uniforms.uLightDirection.value.copy(dir);
    lambertMaterial.uniforms.uLightDirection.value.copy(dir);
    bundle.light.position.copy(dir).multiplyScalar(6);
    bundle.light.target.position.set(0, 0, 0);
    bundle.light.target.updateMatrixWorld();
    bundle.light.updateMatrixWorld();
  }

  function currentSet(): ThicknessSet | null {
    if (mapSize === null) return null;
    return maps.get(`${meshName}-${mapSize}`) ?? null;
  }

  function applyMaps(): void {
    const set = currentSet();
    sssMaterial.uniforms.uUseMap.value = mapSize === null ? 0 : 1;
    // Even when uUseMap = 0 the texture stays BOUND: one program, one variant.
    const fallback = maps.get(`${meshName}-${DEFAULT_MAP_SIZE}`) ?? null;
    sssMaterial.uniforms.uThickness.value =
      (set ?? fallback)?.r8 ?? sssMaterial.uniforms.uThickness.value;
    const rg = (set ?? fallback)?.rg8 ?? null;
    if (physicalMaterial.thicknessMap !== rg) {
      physicalMaterial.thicknessMap = rg;
      physicalMaterial.needsUpdate = true;
    }
  }

  function applyMaterial(): void {
    bundle.subject.material =
      material === "lambert"
        ? lambertMaterial
        : material === "physical"
          ? physicalMaterial
          : sssMaterial;
  }

  function drawFrame(): void {
    renderer.info.reset();
    renderer.setRenderTarget(linear.target);
    renderer.clear();
    renderer.render(bundle.scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(presentScene, presentCamera);
    drawCalls = renderer.info.render.calls;
    triangles = renderer.info.render.triangles;
  }

  /** Draws the scene into the intermediate target, SKIPS present (for readback). */
  function drawLinearOnly(): void {
    renderer.info.reset();
    renderer.setRenderTarget(linear.target);
    renderer.clear();
    renderer.render(bundle.scene, camera);
    renderer.setRenderTarget(null);
  }

  function withSubjectMaterial<T>(
    override: THREE.Material,
    hideEnvironment: boolean,
    fn: () => T,
  ): T {
    const previous = bundle.subject.material;
    const backdropVisible = bundle.backdrop.visible;
    const floorVisible = bundle.floor.visible;
    bundle.subject.material = override;
    if (hideEnvironment) {
      bundle.backdrop.visible = false;
      bundle.floor.visible = false;
    }
    try {
      return fn();
    } finally {
      bundle.subject.material = previous;
      bundle.backdrop.visible = backdropVisible;
      bundle.floor.visible = floorVisible;
    }
  }

  return {
    renderer,
    timer,
    gl,
    readbackType,

    async loadMaps(mesh) {
      for (const size of MAP_SIZES) {
        const key = `${mesh}-${size}`;
        if (maps.has(key)) continue;
        const set = await loadThicknessSet(mesh, size);
        maps.set(key, set);
      }
      applyMaps();
    },

    loadedSizes() {
      return MAP_SIZES.filter((size) => maps.has(`${meshName}-${size}`));
    },

    resize() {
      const size = resolveSize();
      applySize(size.width, size.height);
    },

    render(_timeSeconds: number) {
      const now = performance.now();
      if (lastFrameTime > 0) frameMs = now - lastFrameTime;
      lastFrameTime = now;
      fpsFrames++;
      if (now - fpsSince >= 500) {
        fps = (fpsFrames * 1000) / (now - fpsSince);
        fpsFrames = 0;
        fpsSince = now;
      }

      timer.poll();
      timer.begin();
      drawFrame();
      timer.end();
      timer.poll();
    },

    async drawOnce(timed: boolean) {
      timer.poll();
      if (timed) timer.begin();
      drawFrame();
      if (timed) timer.end();
      await nextFrame();
      timer.poll();
    },

    setMaterial(kind) {
      material = kind;
      applyMaterial();
    },

    setMapSize(size) {
      mapSize = size;
      applyMaps();
    },

    setMesh(mesh) {
      meshName = mesh;
      bundle.setMesh(mesh);
      applyMaps();
    },

    setPose(pose) {
      poseName = pose;
      const entry = POSES.find((p) => p.name === pose) ?? POSES[0];
      lightAzimuthDeg = entry.lightAzimuthDeg;
      lightElevationDeg = entry.lightElevationDeg;
      applyLight();
    },

    setLight(azimuthDeg, elevationDeg) {
      lightAzimuthDeg = azimuthDeg;
      lightElevationDeg = elevationDeg;
      poseName = "custom";
      applyLight();
    },

    setMode(mode) {
      sssMaterial.uniforms.uMode.value = mode;
    },

    setLobe(params) {
      if (params.power !== undefined) {
        sssMaterial.uniforms.uPower.value = params.power;
      }
      if (params.distortion !== undefined) {
        sssMaterial.uniforms.uDistortion.value = params.distortion;
      }
      if (params.wrap !== undefined) {
        sssMaterial.uniforms.uWrap.value = params.wrap;
      }
      if (params.absorption !== undefined) {
        sssMaterial.uniforms.uAbsorption.value = params.absorption;
      }
      if (params.scale !== undefined) {
        sssMaterial.uniforms.uScale.value = params.scale;
      }
    },

    setScale(next) {
      scale = next;
    },

    setFixedSize(w, h) {
      fixedSize = { width: w, height: h };
      applySize(w, h);
    },

    orbit(dAzimuthDeg, dElevationDeg) {
      cameraAzimuthDeg = (cameraAzimuthDeg + dAzimuthDeg) % 360;
      cameraElevationDeg = Math.min(
        70,
        Math.max(-30, cameraElevationDeg + dElevationDeg),
      );
      applyCamera();
    },

    zoom(delta) {
      cameraDistance = Math.min(12, Math.max(2, cameraDistance + delta));
      applyCamera();
    },

    readLinearFrame() {
      drawLinearOnly();
      return linear.read(renderer);
    },

    readMask() {
      return withSubjectMaterial(silhouetteMaterial, true, () => {
        renderer.setRenderTarget(mask.target);
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        renderer.render(bundle.scene, camera);
        renderer.setRenderTarget(null);
        return mask.read(renderer);
      });
    },

    readThickness() {
      const previousMode = sssMaterial.uniforms.uMode.value;
      const previousMaterial = material;
      sssMaterial.uniforms.uMode.value = MODE_THICKNESS;
      material = "sss";
      applyMaterial();
      drawLinearOnly();
      const frame = linear.read(renderer);
      const out = new Float32Array(frame.length / 4);
      for (let i = 0; i < out.length; i++) out[i] = frame[i * 4];
      sssMaterial.uniforms.uMode.value = previousMode;
      material = previousMaterial;
      applyMaterial();
      return out;
    },

    readGreenProbe(which) {
      const set = currentSet() ?? maps.get(`${meshName}-${DEFAULT_MAP_SIZE}`);
      greenProbeMaterial.uniforms.uThickness.value =
        which === "r8" ? (set?.r8 ?? null) : (set?.rg8 ?? null);
      return withSubjectMaterial(greenProbeMaterial, true, () => {
        drawLinearOnly();
        const frame = linear.read(renderer);
        const out = new Float32Array((frame.length / 4) * 2);
        for (let i = 0; i < frame.length / 4; i++) {
          out[i * 2] = frame[i * 4]; // the texture's .g channel
          out[i * 2 + 1] = frame[i * 4 + 1]; // the texture's .r channel
        }
        return out;
      });
    },

    textureBytesFor(kind) {
      if (kind === "lambert") return 0;
      const size = mapSize ?? DEFAULT_MAP_SIZE;
      // SSS uses the single-channel (R8) representation, physical the RG8 one.
      return kind === "sss" ? textureBytes(size, 1) : textureBytes(size, 2);
    },

    transmissionTarget() {
      const props = renderer.properties.get(physicalMaterial) as {
        uniforms?: Record<string, { value: unknown }>;
      };
      const size = props?.uniforms?.transmissionSamplerSize?.value as
        THREE.Vector2 | undefined;
      if (!size || size.x === 0 || size.y === 0) return null;
      const halfFloat =
        renderer.extensions.has("EXT_color_buffer_half_float") ||
        renderer.extensions.has("EXT_color_buffer_float");
      const bytesPerPixel = halfFloat ? 8 : 4;
      return {
        width: size.x,
        height: size.y,
        bytesPerPixel,
        samples: Math.max(4, renderer.capabilities.maxSamples ?? 4),
        bytes: mipChainBytes(size.x, size.y, bytesPerPixel),
      };
    },

    triangleCount() {
      const geometry = bundle.subject.geometry;
      const index = geometry.getIndex();
      return Math.floor(
        (index ? index.count : geometry.getAttribute("position").count) / 3,
      );
    },

    stats() {
      const recent = timer.samplesMs.slice(-30);
      const gpuMs =
        recent.length > 0
          ? recent.reduce((a, b) => a + b, 0) / recent.length
          : null;
      return {
        fps,
        frameMs,
        gpuMs,
        width: renderer.domElement.width,
        height: renderer.domElement.height,
        material,
        mapSize,
        mode: sssMaterial.uniforms.uMode.value as number,
        pose: poseName,
        lightAzimuthDeg,
        drawCalls,
        triangles,
        programs: renderer.info.programs?.length ?? 0,
      };
    },

    dispose() {
      timer.dispose();
      linear.dispose();
      mask.dispose();
      for (const set of maps.values()) {
        set.r8.dispose();
        set.rg8.dispose();
      }
      lambertMaterial.dispose();
      sssMaterial.dispose();
      physicalMaterial.dispose();
      silhouetteMaterial.dispose();
      greenProbeMaterial.dispose();
      presentMaterial.dispose();
      presentQuad.geometry.dispose();
      bundle.dispose();
      renderer.dispose();
    },
  };
}

export { SSS_DEFAULTS, MODE_FULL };
