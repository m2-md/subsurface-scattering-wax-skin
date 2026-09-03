import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { performance } from "node:perf_hooks";
import { bakeAttributes, trianglesFromGeometry } from "../src/bake/attributes";
import { Bvh } from "../src/bake/bvh";
import { dilate } from "../src/bake/dilate";
import { traceThickness } from "../src/bake/trace";
import { buildLathe, profileFor } from "../src/mesh";
import type { MeshName } from "../src/mesh";

const LEAF_SIZE = 4;
const LATHE_SEGMENTS = 96;
const PROFILE_STEPS = 48;

interface Flags {
  mesh: MeshName;
  res: number;
  rays: number;
  bvh: boolean;
  dilate: number;
  out: string;
}

function parseFlags(argv: readonly string[]): Flags {
  const flags: Flags = {
    mesh: "candle",
    res: 256,
    rays: 32,
    bvh: true,
    dilate: 4,
    out: "public/thickness",
  };
  for (const arg of argv) {
    const match = /^--([a-zA-Z]+)=(.+)$/.exec(arg);
    if (!match) continue;
    const [, key, value] = match;
    if (key === "mesh") {
      if (value !== "candle" && value !== "blob") {
        throw new Error(`bilinmeyen mesh: ${value}`);
      }
      flags.mesh = value;
    } else if (key === "res") {
      flags.res = Number.parseInt(value, 10);
    } else if (key === "rays") {
      flags.rays = Number.parseInt(value, 10);
    } else if (key === "bvh") {
      flags.bvh = value !== "off";
    } else if (key === "dilate") {
      flags.dilate = Number.parseInt(value, 10);
    } else if (key === "out") {
      flags.out = value;
    }
  }
  if (!Number.isInteger(flags.res) || flags.res < 8) {
    throw new Error(`geçersiz --res: ${flags.res}`);
  }
  if (!Number.isInteger(flags.rays) || flags.rays < 1) {
    throw new Error(`geçersiz --rays: ${flags.rays}`);
  }
  return flags;
}

function bake(flags: Flags) {
  // 1. Mesh üretimi — ölçüme dahil DEĞİL.
  const geometry = buildLathe(
    profileFor(flags.mesh, PROFILE_STEPS),
    LATHE_SEGMENTS,
  );
  const tris = trianglesFromGeometry(geometry);
  const triangles = tris.length / 9;

  // Işın uzunluğu tavanı: gövdenin köşegeni. Kaçan ışın buna kırpılır.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const maxChord =
    box === null
      ? 4
      : Math.hypot(
          box.max.x - box.min.x,
          box.max.y - box.min.y,
          box.max.z - box.min.z,
        );

  // 2. BVH kurulumu. Toplam süre buradan sayılıyor: mesh üretimi hariç.
  const totalStart = performance.now();
  const bvhStart = performance.now();
  const bvh = flags.bvh ? new Bvh(tris, LEAF_SIZE) : null;
  const bvhBuildMs = performance.now() - bvhStart;

  // 3. UV rasterizasyonu.
  const rasterStart = performance.now();
  const { positions, normals, filled, rasterized } = bakeAttributes(
    geometry,
    flags.res,
  );
  const rasterMs = performance.now() - rasterStart;

  const texelCount = flags.res * flags.res;
  const rays = flags.rays;

  // 4. Işın döngüsü — çekirdeği src/bake/trace.ts'te, testlerin erişebildiği yerde.
  const rayStart = performance.now();
  const { raw, escaped } = traceThickness({
    tris,
    bvh,
    positions,
    normals,
    filled,
    rays,
    maxChord,
  });
  const rayMs = performance.now() - rayStart;

  // 5. Dilate.
  const dilateStart = performance.now();
  const texelsDilated = dilate(raw, filled, flags.res, flags.dilate);
  const dilateMs = performance.now() - dilateStart;

  // 6. Normalizasyon + yazım.
  const writeStart = performance.now();
  let maxRaw = 0;
  for (let i = 0; i < texelCount; i++) {
    if (filled[i] === 1 && raw[i] > maxRaw) maxRaw = raw[i];
  }
  const scale = maxRaw > 0 ? 1 / maxRaw : 0;
  const bytes = new Uint8Array(texelCount);
  let normalizedSum = 0;
  let normalizedCount = 0;
  for (let i = 0; i < texelCount; i++) {
    if (filled[i] !== 1) continue;
    const value = Math.min(1, raw[i] * scale);
    bytes[i] = Math.round(value * 255);
    normalizedSum += value;
    normalizedCount++;
  }

  const outDir = flags.out;
  const outFile = join(outDir, `${flags.mesh}-${flags.res}.bin`);
  const metaFile = join(outDir, `${flags.mesh}-${flags.res}.json`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, bytes);

  const meta = {
    mesh: flags.mesh,
    resolution: flags.res,
    rays,
    maxChordWorld: Number(maxRaw.toFixed(6)),
    meanThicknessNormalized: Number(
      (normalizedCount === 0 ? 0 : normalizedSum / normalizedCount).toFixed(6),
    ),
    triangles,
  };
  writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`);
  const writeMs = performance.now() - writeStart;

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const stageSum = bvhBuildMs + rasterMs + rayMs + dilateMs + writeMs;
  const totalMs = performance.now() - totalStart;

  const rayCount = rasterized * rays;

  const report = {
    mesh: flags.mesh,
    triangles,
    resolution: flags.res,
    rays,
    bvh: flags.bvh,
    leafSize: LEAF_SIZE,
    dilatePasses: flags.dilate,
    bvhBuildMs: round(bvhBuildMs, 3),
    rasterMs: round(rasterMs, 3),
    rayMs: round(rayMs, 3),
    dilateMs: round(dilateMs, 3),
    writeMs: round(writeMs, 3),
    totalMs: round(stageSum, 3),
    rayCount,
    texelsRasterized: rasterized,
    texelsDilated,
    coveragePct: round((rasterized / texelCount) * 100, 3),
    escapedRays: escaped,
    escapedRayPct: round(rayCount === 0 ? 0 : (escaped / rayCount) * 100, 4),
    maxChordWorld: round(maxRaw, 6),
    meanThicknessNormalized: meta.meanThicknessNormalized,
    outputBytes: bytes.length,
    sha256,
    outFile: relative(process.cwd(), outFile),
  };

  const drift = Math.abs(totalMs - stageSum) / Math.max(totalMs, 1e-9);
  return { report, drift };
}

function round(x: number, digits: number): number {
  if (!Number.isFinite(x)) return 0;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

const flags = parseFlags(process.argv.slice(2));
const { report, drift } = bake(flags);
if (drift > 0.02) {
  // Aşama toplamı ile duvar saati %2'den fazla ayrışıyorsa ölçüm kirli.
  console.error(
    `UYARI: aşama toplamı ile toplam süre %${(drift * 100).toFixed(1)} ayrışıyor`,
  );
}
console.log(`BAKE ${JSON.stringify(report)}`);
