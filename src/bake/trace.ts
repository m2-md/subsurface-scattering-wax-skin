import type { Bvh } from "./bvh";
import { bruteForceIntersect } from "./intersect";
import { cosineDirection, radicalInverse2 } from "./sampling";
import type { Vec3 } from "../vec";

/** Margin for starting the ray just below the surface. */
export const ORIGIN_EPS = 1e-4;

export interface TraceInput {
  /** 9 floats per triangle. If `bvh` is null, brute force scans this array. */
  tris: Float32Array;
  /** Null when there is no tree (`--bvh=off`). */
  bvh: Bvh | null;
  positions: Float32Array;
  normals: Float32Array;
  filled: Uint8Array;
  rays: number;
  /** Ceiling on ray length: the body's diagonal. */
  maxChord: number;
}

export interface TraceResult {
  /** Mean interior path length per texel, in world units. */
  raw: Float32Array;
  /** Number of rays that hit no wall and ran into the ceiling. */
  escaped: number;
}

/**
 * The baker's core: shoots cosine-weighted rays from each filled texel and
 * measures the mean interior path length. Separate file so the escaped-ray
 * counter can be tested — it is a quality indicator, and untested ones die.
 */
export function traceThickness(input: TraceInput): TraceResult {
  const { tris, bvh, positions, normals, filled, rays, maxChord } = input;
  const texelCount = filled.length;
  const raw = new Float32Array(texelCount);

  // src/bake/trace.ts (excerpt)
  const origin: Vec3 = [0, 0, 0];
  let escaped = 0;

  for (let i = 0; i < texelCount; i++) {
    if (filled[i] !== 1) continue;
    const p = positions.subarray(i * 3, i * 3 + 3);
    const n = normals.subarray(i * 3, i * 3 + 3);
    // Start the ray just below the surface; otherwise the first hit is itself.
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
      // A miss is NOT `Infinity`: both intersection paths start from
      // `let best = tMax` and return the ceiling on a miss. Hence `>= maxChord`.
      if (t >= maxChord) escaped++; // should not happen on a closed body
      sum += Math.min(t, maxChord);
    }
    raw[i] = sum / rays;
  }

  return { raw, escaped };
}
