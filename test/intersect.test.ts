import { describe, expect, it } from "vitest";
import { bruteForceIntersect, intersectTriangle } from "../src/bake/intersect";

// test/intersect.test.ts (excerpt)
// A triangle on the z = 5 plane, standing opposite the origin
const wall = new Float32Array([-1, -1, 5, 3, -1, 5, -1, 3, 5]);

describe("intersectTriangle", () => {
  it("finds the intersection in the forward direction", () => {
    expect(intersectTriangle(0, 0, 0, 0, 0, 1, wall, 0)).toBeCloseTo(5, 12);
  });

  it("gives the same distance from the back face too (NO culling)", () => {
    // A ray looking from the inside hits the far wall from behind; if we do not
    // count it, the thickness map comes out zero everywhere.
    expect(intersectTriangle(0, 0, 10, 0, 0, -1, wall, 0)).toBeCloseTo(5, 12);
  });

  it("misses a ray that passes outside the triangle", () => {
    expect(intersectTriangle(9, 9, 0, 0, 0, 1, wall, 0)).toBe(Infinity);
  });

  it("a ray parallel to the plane produces no intersection", () => {
    expect(intersectTriangle(0, 0, 5, 1, 0, 0, wall, 0)).toBe(Infinity);
  });

  it("does not count a triangle that lies behind the ray", () => {
    expect(intersectTriangle(0, 0, 8, 0, 0, 1, wall, 0)).toBe(Infinity);
  });

  it("the t < 1e-5 threshold rejects self-hits", () => {
    // The ray starts right on the triangle: without the epsilon it hits itself
    // at zero distance and the map comes out completely black.
    expect(intersectTriangle(0, 0, 5, 0, 0, 1, wall, 0)).toBe(Infinity);
    expect(intersectTriangle(0, 0, 4.99999, 0, 0, 1, wall, 0)).toBe(Infinity);
    expect(intersectTriangle(0, 0, 4.9999, 0, 0, 1, wall, 0)).toBeCloseTo(
      1e-4,
      9,
    );
  });

  it("a degenerate triangle produces no intersection", () => {
    const degenerate = new Float32Array([0, 0, 5, 0, 0, 5, 0, 0, 5]);
    expect(intersectTriangle(0, 0, 0, 0, 0, 1, degenerate, 0)).toBe(Infinity);
  });

  it("can read the second triangle in the array too", () => {
    const two = new Float32Array(18);
    two.set(wall, 0);
    two.set([-1, -1, 9, 3, -1, 9, -1, 3, 9], 9);
    expect(intersectTriangle(0, 0, 0, 0, 0, 1, two, 9)).toBeCloseTo(9, 12);
  });
});

describe("bruteForceIntersect", () => {
  const two = new Float32Array(18);
  two.set([-1, -1, 9, 3, -1, 9, -1, 3, 9], 0);
  two.set(wall, 9);

  it("picks the nearest intersection", () => {
    expect(bruteForceIntersect(two, [0, 0, 0], [0, 0, 1], 100)).toBeCloseTo(
      5,
      12,
    );
  });

  it("does not return an intersection beyond the tMax limit", () => {
    expect(bruteForceIntersect(two, [0, 0, 0], [0, 0, 1], 3)).toBe(3);
  });

  it("returns tMax when there are no triangles", () => {
    expect(
      bruteForceIntersect(new Float32Array(0), [0, 0, 0], [0, 0, 1], 7),
    ).toBe(7);
  });
});
