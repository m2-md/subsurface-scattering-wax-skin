import { describe, expect, it } from "vitest";
import { Bvh, slabDistance } from "../src/bake/bvh";
import { bruteForceIntersect } from "../src/bake/intersect";
import { cosineDirection, hammersley } from "../src/bake/sampling";
import { boxTriangles, icosphereTriangles } from "./geometry";

// test/bvh.test.ts (excerpt)
describe("Bvh", () => {
  it("BVH result matches brute force exactly", () => {
    const tris = icosphereTriangles(2); // deterministic, no seed
    const bvh = new Bvh(tris, 4);

    for (let i = 0; i < 200; i++) {
      const [u1, u2] = hammersley(i, 200);
      const dir = cosineDirection(u1, u2, [0, 1, 0]);
      const brute = bruteForceIntersect(tris, [0, 0, 0], dir, 100);
      const tree = bvh.intersect(0, 0, 0, dir[0], dir[1], dir[2], 100);
      expect(tree).toBeCloseTo(brute, 12);
    }
  });

  it("produces no NaN for axis-aligned rays", () => {
    const bvh = new Bvh(boxTriangles(1), 4);
    for (const dir of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [-1, 0, 0],
    ] as const) {
      const t = bvh.intersect(0, 0, 0, dir[0], dir[1], dir[2], 100);
      expect(Number.isNaN(t)).toBe(false);
      expect(t).toBeLessThan(100);
    }
  });

  it("matches brute force on a near-axis-aligned ray too", () => {
    // Regression from a bake run. The ray of the texel at the north pole is
    // not EXACTLY parallel to the x axis: dx = 3.4e-17, so 1/dx is not
    // infinite but 2.9e16. When the ray origin sits right on a node box's maxX
    // plane, `hi = (maxX - ox) * invX` comes out exactly 0, `tmax` is clamped
    // to 0 and the leaf carrying the real intersection was silently culled.
    const tris = icosphereTriangles(2);
    const bvh = new Bvh(tris, 4);
    const maxChord = 2 * Math.sqrt(3);
    const origin: [number, number, number] = [0, -0.9999, 0];
    const dir: [number, number, number] = [
      3.422991864151267e-17, 0.82915619758885, -0.5590169943749475,
    ];

    const brute = bruteForceIntersect(tris, origin, dir, maxChord);
    const tree = bvh.intersect(
      origin[0],
      origin[1],
      origin[2],
      dir[0],
      dir[1],
      dir[2],
      maxChord,
    );
    // Brute force really finds a wall: the ray passes through the closed body.
    expect(brute).toBeLessThan(maxChord);
    expect(tree).toBeCloseTo(brute, 12);
  });

  it("gives the same result at leafSize 1, 4 and 16", () => {
    const tris = icosphereTriangles(2);
    const trees = [1, 4, 16].map((leaf) => new Bvh(tris, leaf));
    for (let i = 0; i < 120; i++) {
      const [u1, u2] = hammersley(i, 120);
      const dir = cosineDirection(u1, u2, [0.3, -0.9, 0.2]);
      const values = trees.map((bvh) =>
        bvh.intersect(0.1, 0.05, -0.2, dir[0], dir[1], dir[2], 100),
      );
      expect(values[1]).toBeCloseTo(values[0], 12);
      expect(values[2]).toBeCloseTo(values[0], 12);
    }
  });

  it("empty tree does not crash, returns tMax", () => {
    const bvh = new Bvh(new Float32Array(0), 4);
    expect(bvh.triangleCount).toBe(0);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 42)).toBe(42);
  });

  it("single-triangle tree gives the right distance", () => {
    const bvh = new Bvh(new Float32Array([-1, -1, 5, 3, -1, 5, -1, 3, 5]), 4);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 100)).toBeCloseTo(5, 12);
    expect(bvh.intersect(9, 9, 0, 0, 0, 1, 100)).toBe(100);
  });

  it("an intersection beyond the tMax limit is not returned", () => {
    const bvh = new Bvh(boxTriangles(3), 4);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 1)).toBe(1);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 10)).toBeCloseTo(3, 6);
  });

  it("stack does not overflow: the depth limit fits the stack size", () => {
    const bvh = new Bvh(icosphereTriangles(3), 4);
    expect(bvh.stack.length).toBeGreaterThanOrEqual(2 * bvh.depth + 8);
    // 5120 triangles, leaf 4 → depth around log2(1280)
    expect(bvh.depth).toBeLessThan(32);
    const t = bvh.intersect(0, 0, 0, 0, 0, 1, 100);
    expect(Number.isNaN(t)).toBe(false);
    expect(t).toBeCloseTo(1, 6);
  });
});

describe("slabDistance", () => {
  // Single node: [-1,-1,-1] .. [1,1,1]
  const bounds = new Float32Array([-1, -1, -1, 1, 1, 1]);

  it("returns 0 for a ray that starts inside the box", () => {
    expect(slabDistance(bounds, 0, 0, 0, 0, 1, 1, 1, 100)).toBe(0);
  });

  it("gives the entry distance for a ray coming from outside", () => {
    // Direction (0, 0, 1): the x and y inverses are infinite.
    expect(
      slabDistance(bounds, 0, 0, 0, -5, Infinity, Infinity, 1, 100),
    ).toBeCloseTo(4, 12);
  });

  it("a ray that misses returns Infinity", () => {
    expect(slabDistance(bounds, 0, 5, 5, -5, 1, 1, 1, 100)).toBe(Infinity);
  });

  it("avoids the 0 * Infinity = NaN trap: parallel ray right on the bound", () => {
    // Ray on the x = -1 plane, parallel to the x axis: (bmin.x - ox) * inf = NaN
    const value = slabDistance(bounds, 0, -1, 0, 0, Infinity, 1, 1, 100);
    expect(Number.isNaN(value)).toBe(false);
    expect(value).toBe(0);
  });

  it("does not cull the box when a near-parallel ray sits on the bound", () => {
    // `1 / d` is not infinite, only huge (d = 3.4e-17). The origin sits on the
    // box's maxX plane: a naive slab test gets `hi = (1 - 1) * 2.9e16 = 0` and
    // `tmax` falls to 0, so the y axis `tmin` of 2 culls the box by mistake.
    const value = slabDistance(
      bounds,
      0,
      1,
      -3,
      0,
      1 / 3.422991864151267e-17,
      1,
      Infinity,
      100,
    );
    expect(Number.isNaN(value)).toBe(false);
    expect(value).toBeCloseTo(2, 12);
  });

  it("an axis-aligned ray outside the box returns Infinity", () => {
    const value = slabDistance(bounds, 0, 5, 0, 0, Infinity, 1, 1, 100);
    expect(value).toBe(Infinity);
  });

  it("a box farther away than tMax is culled", () => {
    expect(slabDistance(bounds, 0, 0, 0, -5, Infinity, Infinity, 1, 2)).toBe(
      Infinity,
    );
  });
});
