import { describe, expect, it } from "vitest";
import { Bvh } from "../src/bake/bvh";
import { bruteForceIntersect } from "../src/bake/intersect";
import { cosineDirection, radicalInverse2 } from "../src/bake/sampling";
import { traceThickness } from "../src/bake/trace";
import { icosphereTriangles } from "./geometry";

// Diagonal of the unit sphere's bounding box: the bake's `maxChord`.
const MAX_CHORD = 2 * Math.sqrt(3);
const RAYS = 8;

/**
 * Use triangle vertices as texels: on the unit sphere the position already is
 * the normal. No rasterization needed; `traceThickness` wants these 3 arrays.
 */
function texelsFromSurface(tris: Float32Array) {
  const texelCount = tris.length / 3;
  const positions = Float32Array.from(tris);
  const normals = Float32Array.from(tris);
  const filled = new Uint8Array(texelCount).fill(1);
  return { positions, normals, filled, texelCount };
}

const sphere = icosphereTriangles(2); // 320 triangles, closed and convex
const half = sphere.subarray(0, Math.floor(sphere.length / 9 / 2) * 9);

describe("traceThickness — escaped ray counter", () => {
  it("no escapes on a closed body, every texel gets a finite thickness", () => {
    const { positions, normals, filled, texelCount } =
      texelsFromSurface(sphere);
    const { raw, escaped } = traceThickness({
      tris: sphere,
      bvh: new Bvh(sphere, 4),
      positions,
      normals,
      filled,
      rays: RAYS,
      maxChord: MAX_CHORD,
    });

    expect(escaped).toBe(0);
    for (let i = 0; i < texelCount; i++) {
      expect(raw[i]).toBeGreaterThan(0);
      expect(raw[i]).toBeLessThan(2.0001); // sphere diameter, under the ceiling
    }
  });

  it("escape count is above zero once half the triangles are deleted", () => {
    // Audit probe: the counter must fire once a huge hole opens in the body.
    const { positions, normals, filled, texelCount } =
      texelsFromSurface(sphere);
    const { raw, escaped } = traceThickness({
      tris: half,
      bvh: new Bvh(half, 4),
      positions,
      normals,
      filled,
      rays: RAYS,
      maxChord: MAX_CHORD,
    });

    expect(escaped).toBeGreaterThan(0);
    // With half of it missing the escape rate should be noticeable, not a trickle.
    expect(escaped / (texelCount * RAYS)).toBeGreaterThan(0.1);
    // An escaped ray's thickness hits the ceiling, but the "at least one texel
    // is EXACTLY at the ceiling" claim is geometrically false on this shell: I
    // counted with a project-independent, double-precision Möller–Trumbore
    // probe — AT MOST 6 of a texel's 8 rays escape (no texel escapes 7/8 or
    // 8/8, histogram 0,0,89,250,312,291,18,0,0). The wide-angle rays cast from
    // the holed shell graze the half still standing. The right criterion: the
    // thickest texel cannot drop below 6 ceiling rays, nor pass the ceiling.
    const maxRaw = Math.max(...raw);
    expect(maxRaw).toBeGreaterThan((6 / RAYS) * MAX_CHORD);
    expect(maxRaw).toBeLessThan(MAX_CHORD);
  });

  it("the brute force path (bvh = null) gives the same escape count", () => {
    const { positions, normals, filled } = texelsFromSurface(sphere);
    const args = {
      tris: half,
      positions,
      normals,
      filled,
      rays: RAYS,
      maxChord: MAX_CHORD,
    };
    const tree = traceThickness({ ...args, bvh: new Bvh(half, 4) });
    const brute = traceThickness({ ...args, bvh: null });

    expect(brute.escaped).toBe(tree.escaped);
    expect(Array.from(brute.raw)).toEqual(Array.from(tree.raw));
  });

  it("a miss returns the ceiling, not Infinity — the `t === Infinity` check is dead", () => {
    // Why the counter has to be written with `>= maxChord`: both intersection
    // paths start at `let best = tMax`, so a miss brings the ceiling back.
    const bvh = new Bvh(half, 4);
    let infinities = 0;
    let ceilings = 0;

    for (let i = 0; i < half.length / 9; i++) {
      const n: [number, number, number] = [
        sphere[i * 9],
        sphere[i * 9 + 1],
        sphere[i * 9 + 2],
      ];
      for (let r = 0; r < RAYS; r++) {
        const [dx, dy, dz] = cosineDirection(
          (r + 0.5) / RAYS,
          radicalInverse2(r),
          [-n[0], -n[1], -n[2]],
        );
        const ox = n[0] * (1 - 1e-4);
        const oy = n[1] * (1 - 1e-4);
        const oz = n[2] * (1 - 1e-4);
        const tree = bvh.intersect(ox, oy, oz, dx, dy, dz, MAX_CHORD);
        const brute = bruteForceIntersect(
          half,
          [ox, oy, oz],
          [dx, dy, dz],
          MAX_CHORD,
        );
        expect(tree).toBeCloseTo(brute, 12);
        if (tree === Infinity) infinities++;
        if (tree === MAX_CHORD) ceilings++;
      }
    }

    expect(infinities).toBe(0);
    expect(ceilings).toBeGreaterThan(0);
  });
});
