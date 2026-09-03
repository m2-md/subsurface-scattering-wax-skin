import { describe, expect, it } from "vitest";
import { blobProfile, candleProfile, smoothstep } from "../src/mesh";

describe("candleProfile", () => {
  const points = candleProfile(48);

  it("point count is steps + 3", () => {
    expect(points).toHaveLength(51);
    expect(candleProfile(12)).toHaveLength(15);
  });

  it("the first and last point have x exactly 0 — the body is closed", () => {
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBe(0);
    expect(points[0].y).toBe(-1);
    expect(points[points.length - 1].y).toBe(1);
  });

  it("every intermediate point has x > 0", () => {
    for (let i = 1; i < points.length - 1; i++) {
      expect(points[i].x).toBeGreaterThan(0);
    }
  });

  it("y increases monotonically (never decreases)", () => {
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeGreaterThanOrEqual(points[i - 1].y);
    }
    expect(points[points.length - 1].y).toBe(1);
  });

  it("the rim at the top is markedly thinner than the body", () => {
    const widest = Math.max(...points.map((p) => p.x));
    const rim = points[points.length - 2].x;
    expect(rim).toBeLessThan(widest * 0.2);
  });
});

describe("blobProfile", () => {
  const points = blobProfile(48);

  it("satisfies the same closedness contract", () => {
    expect(points).toHaveLength(51);
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBe(0);
    for (let i = 1; i < points.length - 1; i++) {
      expect(points[i].x).toBeGreaterThan(0);
    }
  });

  it("y increases monotonically", () => {
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeGreaterThanOrEqual(points[i - 1].y);
    }
  });

  it("wide at the bottom, thin at the top", () => {
    expect(points[1].x).toBeGreaterThan(points[points.length - 2].x);
  });
});

describe("smoothstep", () => {
  it("0 and 1 at the ends", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it("0.5 in the middle and monotonic in between", () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
    let previous = -1;
    for (let i = 0; i <= 20; i++) {
      const value = smoothstep(0.2, 0.8, i / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("falls back to a step function when e0 === e1", () => {
    expect(smoothstep(0.5, 0.5, 0.4)).toBe(0);
    expect(smoothstep(0.5, 0.5, 0.6)).toBe(1);
  });
});
