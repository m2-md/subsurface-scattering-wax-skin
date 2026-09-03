import * as THREE from "three";
import { bucketMeans, maskedMean, relativeLuminance } from "./luminance";
import { MODE_FULL, MODE_WRAP } from "./modes";
import { textureBytes } from "./pack";
import type { MapSize, MaterialKind, Stage } from "./renderer";
import { median, percentile, rmsDifference } from "./stats";

// src/measure.ts (parça)
export const POSES = [
  // Işık nesnenin arkasında, kameranın tam karşısında.
  { name: "back", lightAzimuthDeg: 178, lightElevationDeg: 10 },
  // Işık kameranın omzunun üstünde: klasik anahtar ışık.
  { name: "front", lightAzimuthDeg: 28, lightElevationDeg: 34 },
] as const;

export const CAMERA = {
  azimuthDeg: 20,
  elevationDeg: 8,
  distance: 4.2,
  fovYDeg: 40,
} as const;

export type PoseName = (typeof POSES)[number]["name"] | "custom";

/**
 * Azimut/eğim derecelerinden yüzeyden IŞIĞA doğru bakan birim vektör.
 * Üç materyal de ışığı bu tek fonksiyondan alıyor.
 */
export function lightDirection(
  azimuthDeg: number,
  elevationDeg: number,
): THREE.Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ).normalize();
}

export const MEASURE_WIDTH = 960;
export const MEASURE_HEIGHT = 540;
export const MEASURE_FRAMES = 180;
export const MEASURE_WARMUP = 30;
export const THREE_VERSION = "0.185.1";
export const REFERENCE_MAP: MapSize = 512;
export const BUCKET_THIN_MAX = 0.25;
export const BUCKET_THICK_MIN = 0.6;
export const CONSTANT_THICKNESS = 0.5;
export const POWERS = [1, 4, 12];
export const DISTORTIONS = [0, 0.5];

export type MeasureBlock =
  "materials" | "luminance" | "maps" | "lobe" | "channel";

export interface MaterialReport {
  gpuMsMedian: number;
  gpuMsP95: number;
  wallMsMedian: number;
  drawCalls: number;
  triangles: number;
  programs: number;
  textureBytes: number;
  transmissionTargetBytes?: number | null;
  transmissionTarget?: {
    width: number;
    height: number;
    bytesPerPixel: number;
    samples: number;
  } | null;
}

export interface MeasureReport {
  gpu: string;
  three: string;
  timerExt: boolean;
  readbackType: string;
  only: MeasureBlock | null;
  width: number;
  height: number;
  frames: number;
  warmup: number;
  camera: typeof CAMERA;
  mesh: string;
  triangles: number;
  reference: { material: string; mapSize: number; pose: string };
  maskPixels: number;
  materials: Record<MaterialKind, MaterialReport> | null;
  luminance: Record<string, { back: number; front: number }> | null;
  buckets: {
    thinMax: number;
    thickMin: number;
    thinPixels: number;
    thickPixels: number;
    lambert: { thin: number | null; thick: number | null };
    sss: { thin: number | null; thick: number | null };
  } | null;
  mapResolution:
    | {
        size: number;
        vramBytes: number;
        gpuMsMedian: number;
        rmsVsRef: number;
      }[]
    | null;
  thicknessSource: {
    map: { size: number; gpuMsMedian: number; rmsVsRef: number };
    constant: { value: number; gpuMsMedian: number; rmsVsRef: number };
  } | null;
  lobe: {
    power: { value: number; gpuMsMedian: number }[];
    distortion: { value: number; gpuMsMedian: number }[];
  } | null;
  greenChannel: {
    r8MeanOnMesh: number;
    r8MaxOnMesh: number;
    rg8MeanOnMesh: number;
  } | null;
  quantized: boolean;
}

function round(x: number, digits: number): number {
  if (!Number.isFinite(x)) return 0;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

function rendererName(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  if (!ext) return "bilinmiyor";
  const name = gl.getParameter(
    (ext as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL,
  );
  return typeof name === "string" && name.length > 0 ? name : "bilinmiyor";
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** GPU zaman damgaları kaba bir ızgaraya oturuyorsa rapora not düşülür. */
function looksQuantized(samples: readonly number[]): boolean {
  const ns = samples.map((s) => Math.round(s * 1e6)).filter((v) => v > 0);
  const unique = [...new Set(ns)];
  if (unique.length < 4) return false;
  let g = 0;
  for (const value of unique) g = gcd(g, value);
  return g >= 1000;
}

function luminanceArray(frame: Float32Array): Float32Array {
  const out = new Float32Array(frame.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] = relativeLuminance(
      frame[i * 4],
      frame[i * 4 + 1],
      frame[i * 4 + 2],
    );
  }
  return out;
}

interface RunResult {
  gpuMsMedian: number;
  gpuMsP95: number;
  wallMsMedian: number;
  samples: number[];
}

async function runConfig(
  stage: Stage,
  frames = MEASURE_FRAMES,
): Promise<RunResult> {
  // Materyal / harita değişimi ısınmadan ÖNCE yapılır.
  for (let i = 0; i < MEASURE_WARMUP; i++) await stage.drawOnce(false);

  const wall: number[] = [];
  stage.timer.reset();
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now();
    await stage.drawOnce(true);
    wall.push(performance.now() - t0);
  }

  return {
    gpuMsMedian: round(median(stage.timer.samplesMs), 4),
    gpuMsP95: round(percentile(stage.timer.samplesMs, 95), 4),
    wallMsMedian: round(median(wall), 4),
    samples: [...stage.timer.samplesMs],
  };
}

/**
 * Deterministik ölçüm modu (`?measure=1`).
 * Arka tampon 960×540'a kilitli, kamera ve ışık sabit pozlarda, animasyon yok.
 * Sonuç TEK satır `MEASURE {json}` olarak konsola düşer.
 */
export async function runMeasurement(
  stage: Stage,
  only: MeasureBlock | null = null,
): Promise<MeasureReport> {
  const run = (block: MeasureBlock) => only === null || only === block;
  const allSamples: number[] = [];

  stage.setFixedSize(MEASURE_WIDTH, MEASURE_HEIGHT);
  stage.setMesh("candle");
  stage.setPose("back");
  stage.setMode(MODE_FULL);
  stage.setLobe({
    power: 4,
    distortion: 0.25,
    wrap: 0.5,
    absorption: 3,
    scale: 1,
  });

  // --- REF: 512² haritayla çizilmiş referans kare. İlk çekilir. -------------
  stage.setMaterial("sss");
  stage.setMapSize(REFERENCE_MAP);
  await stage.drawOnce(false);
  await stage.drawOnce(false);
  const reference = stage.readLinearFrame().slice();
  const mask = stage.readMask().slice();
  let maskPixels = 0;
  for (const m of mask) maskPixels += m;

  // Kalınlık kovaları: 256² harita, maske dışı NaN.
  stage.setMapSize(256);
  await stage.drawOnce(false);
  const thickness = stage.readThickness().slice();
  for (let i = 0; i < thickness.length; i++) {
    if (mask[i] === 0) thickness[i] = Number.NaN;
  }

  const report: MeasureReport = {
    gpu: rendererName(stage.gl),
    three: THREE_VERSION,
    timerExt: stage.timer.available,
    readbackType: stage.readbackType,
    only,
    width: MEASURE_WIDTH,
    height: MEASURE_HEIGHT,
    frames: MEASURE_FRAMES,
    warmup: MEASURE_WARMUP,
    camera: CAMERA,
    mesh: "candle",
    triangles: stage.triangleCount(),
    reference: { material: "sss", mapSize: REFERENCE_MAP, pose: "back" },
    maskPixels,
    materials: null,
    luminance: null,
    buckets: null,
    mapResolution: null,
    thicknessSource: null,
    lobe: null,
    greenChannel: null,
    quantized: false,
  };

  // --- A: üç materyal yan yana ---------------------------------------------
  if (run("materials")) {
    const materials = {} as Record<MaterialKind, MaterialReport>;
    for (const kind of ["lambert", "sss", "physical"] as MaterialKind[]) {
      stage.setMaterial(kind);
      stage.setMapSize(256);
      const result = await runConfig(stage);
      allSamples.push(...result.samples);
      const stats = stage.stats();
      const entry: MaterialReport = {
        gpuMsMedian: result.gpuMsMedian,
        gpuMsP95: result.gpuMsP95,
        wallMsMedian: result.wallMsMedian,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        programs: stats.programs,
        textureBytes: stage.textureBytesFor(kind),
      };
      if (kind === "physical") {
        const info = stage.transmissionTarget();
        entry.transmissionTargetBytes = info ? info.bytes : null;
        entry.transmissionTarget = info
          ? {
              width: info.width,
              height: info.height,
              bytesPerPixel: info.bytesPerPixel,
              samples: info.samples,
            }
          : null;
      }
      materials[kind] = entry;
    }
    report.materials = materials;
  }

  // --- B: iki poz, dört satır (wrap = SSS'in MODE_WRAP modu) ---------------
  if (run("luminance")) {
    const rows: Record<string, { back: number; front: number }> = {};
    const configs: [string, MaterialKind, number][] = [
      ["lambert", "lambert", MODE_FULL],
      ["wrap", "sss", MODE_WRAP],
      ["sss", "sss", MODE_FULL],
      ["physical", "physical", MODE_FULL],
    ];
    for (const [label, kind, mode] of configs) {
      stage.setMaterial(kind);
      stage.setMapSize(256);
      stage.setMode(mode);
      const entry = { back: 0, front: 0 };
      for (const pose of ["back", "front"] as const) {
        stage.setPose(pose);
        for (let i = 0; i < MEASURE_WARMUP; i++) await stage.drawOnce(false);
        const frame = stage.readLinearFrame();
        entry[pose] = round(maskedMean(frame, mask), 6);
      }
      rows[label] = entry;
    }
    stage.setMode(MODE_FULL);
    stage.setPose("back");
    report.luminance = rows;

    // --- C: kalınlık kovaları --------------------------------------------
    const bucketOf = async (kind: MaterialKind) => {
      stage.setMaterial(kind);
      stage.setMapSize(256);
      for (let i = 0; i < MEASURE_WARMUP; i++) await stage.drawOnce(false);
      const lum = luminanceArray(stage.readLinearFrame());
      return bucketMeans(lum, thickness, BUCKET_THIN_MAX, BUCKET_THICK_MIN);
    };
    const lambertBuckets = await bucketOf("lambert");
    const sssBuckets = await bucketOf("sss");
    report.buckets = {
      thinMax: BUCKET_THIN_MAX,
      thickMin: BUCKET_THICK_MIN,
      thinPixels: sssBuckets.thinPixels,
      thickPixels: sssBuckets.thickPixels,
      lambert: {
        thin:
          lambertBuckets.thin === null ? null : round(lambertBuckets.thin, 6),
        thick:
          lambertBuckets.thick === null ? null : round(lambertBuckets.thick, 6),
      },
      sss: {
        thin: sssBuckets.thin === null ? null : round(sssBuckets.thin, 6),
        thick: sssBuckets.thick === null ? null : round(sssBuckets.thick, 6),
      },
    };
  }

  // --- D/E: harita çözünürlüğü ve kalınlık kaynağı -------------------------
  if (run("maps")) {
    stage.setMaterial("sss");
    stage.setMode(MODE_FULL);
    stage.setPose("back");

    const rows: MeasureReport["mapResolution"] = [];
    for (const size of [128, 256, 512] as MapSize[]) {
      stage.setMapSize(size);
      const result = await runConfig(stage);
      allSamples.push(...result.samples);
      rows.push({
        size,
        vramBytes: textureBytes(size, 1),
        gpuMsMedian: result.gpuMsMedian,
        rmsVsRef: round(rmsDifference(stage.readLinearFrame(), reference), 6),
      });
    }
    report.mapResolution = rows;

    const row256 = rows.find((r) => r.size === 256);
    stage.setMapSize(null); // sabit kalınlık
    const constant = await runConfig(stage);
    allSamples.push(...constant.samples);
    const constantRms = round(
      rmsDifference(stage.readLinearFrame(), reference),
      6,
    );
    stage.setMapSize(256);
    report.thicknessSource = {
      map: {
        size: 256,
        gpuMsMedian: row256?.gpuMsMedian ?? 0,
        rmsVsRef: row256?.rmsVsRef ?? 0,
      },
      constant: {
        value: CONSTANT_THICKNESS,
        gpuMsMedian: constant.gpuMsMedian,
        rmsVsRef: constantRms,
      },
    };
  }

  // --- F: lob taraması -----------------------------------------------------
  if (run("lobe")) {
    stage.setMaterial("sss");
    stage.setMapSize(256);
    stage.setMode(MODE_FULL);
    stage.setPose("back");

    const power: { value: number; gpuMsMedian: number }[] = [];
    for (const value of POWERS) {
      stage.setLobe({ power: value, distortion: 0.25 });
      const result = await runConfig(stage);
      allSamples.push(...result.samples);
      power.push({ value, gpuMsMedian: result.gpuMsMedian });
    }
    stage.setLobe({ power: 4 });

    const distortion: { value: number; gpuMsMedian: number }[] = [];
    for (const value of DISTORTIONS) {
      stage.setLobe({ distortion: value });
      const result = await runConfig(stage);
      allSamples.push(...result.samples);
      distortion.push({ value, gpuMsMedian: result.gpuMsMedian });
    }
    stage.setLobe({ distortion: 0.25 });
    report.lobe = { power, distortion };
  }

  // --- G: yeşil kanal sondası ----------------------------------------------
  if (run("channel")) {
    stage.setMapSize(256);
    const sample = (which: "r8" | "rg8") => {
      const pairs = stage.readGreenProbe(which);
      let sum = 0;
      let max = 0;
      let count = 0;
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 0) continue;
        const g = pairs[i * 2];
        sum += g;
        if (g > max) max = g;
        count++;
      }
      return { mean: count === 0 ? 0 : sum / count, max };
    };
    const r8 = sample("r8");
    const rg8 = sample("rg8");
    report.greenChannel = {
      r8MeanOnMesh: round(r8.mean, 6),
      r8MaxOnMesh: round(r8.max, 6),
      rg8MeanOnMesh: round(rg8.mean, 6),
    };
  }

  report.quantized = looksQuantized(allSamples);
  return report;
}
