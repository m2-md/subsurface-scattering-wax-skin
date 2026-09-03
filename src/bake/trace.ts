import type { Bvh } from "./bvh";
import { bruteForceIntersect } from "./intersect";
import { cosineDirection, radicalInverse2 } from "./sampling";
import type { Vec3 } from "../vec";

/** Işını yüzeyin bir tık altından başlatma payı. */
export const ORIGIN_EPS = 1e-4;

export interface TraceInput {
  /** Üçgen başına 9 float. `bvh` null ise kaba kuvvet bu diziyi tarar. */
  tris: Float32Array;
  /** Ağaç yoksa (`--bvh=off`) null. */
  bvh: Bvh | null;
  positions: Float32Array;
  normals: Float32Array;
  filled: Uint8Array;
  rays: number;
  /** Işın uzunluğu tavanı: gövdenin köşegeni. */
  maxChord: number;
}

export interface TraceResult {
  /** Texel başına ortalama iç yol uzunluğu, dünya birimi. */
  raw: Float32Array;
  /** Hiçbir duvara çarpmadan tavana dayanan ışın sayısı. */
  escaped: number;
}

/**
 * Fırının çekirdeği: her dolu texel'den kosinüs ağırlıklı ışınlar atıp ortalama
 * iç yol uzunluğunu ölçer. Ayrı dosyada duruyor ki kaçan ışın sayacı test
 * edilebilsin — sayaç bir kalite göstergesi ve sınanmayan gösterge ölür.
 */
export function traceThickness(input: TraceInput): TraceResult {
  const { tris, bvh, positions, normals, filled, rays, maxChord } = input;
  const texelCount = filled.length;
  const raw = new Float32Array(texelCount);

  // src/bake/trace.ts (parça)
  const origin: Vec3 = [0, 0, 0];
  let escaped = 0;

  for (let i = 0; i < texelCount; i++) {
    if (filled[i] !== 1) continue;
    const p = positions.subarray(i * 3, i * 3 + 3);
    const n = normals.subarray(i * 3, i * 3 + 3);
    // Işını yüzeyin bir tık altından başlat; aksi hâlde ilk kesişim kendisidir.
    origin[0] = p[0] - n[0] * ORIGIN_EPS;
    origin[1] = p[1] - n[1] * ORIGIN_EPS;
    origin[2] = p[2] - n[2] * ORIGIN_EPS;

    let sum = 0;
    for (let r = 0; r < rays; r++) {
      const u1 = (r + 0.5) / rays;
      const u2 = radicalInverse2(r);
      const [dx, dy, dz] = cosineDirection(u1, u2, [-n[0], -n[1], -n[2]]);
      const t = bvh
        ? bvh.intersect(origin[0], origin[1], origin[2], dx, dy, dz, maxChord)
        : bruteForceIntersect(tris, origin, [dx, dy, dz], maxChord);
      // Iska `Infinity` DEĞİL: iki kesişim yolu da `let best = tMax` ile
      // başlayıp ıskaladığında tavanı döndürüyor. Ölçüt bu yüzden `>= maxChord`.
      if (t >= maxChord) escaped++; // kapalı gövdede olmaması gereken durum
      sum += Math.min(t, maxChord);
    }
    raw[i] = sum / rays;
  }

  return { raw, escaped };
}
