import { describe, expect, it } from "vitest";
import { median, percentile, rmsDifference } from "../src/stats";

describe("median", () => {
  it("the middle one for an odd element count", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("the mean for an even element count", () => {
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5, 12);
  });

  it("the input array is NOT MUTATED", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("percentile", () => {
  it("NaN on an empty array", () => {
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });

  it("p0 and p100 give the ends", () => {
    expect(percentile([5, 1, 9], 0)).toBe(1);
    expect(percentile([5, 1, 9], 100)).toBe(9);
  });

  it("p95 by linear interpolation", () => {
    const values = Array.from({ length: 11 }, (_, i) => i); // 0..10
    // rank = 0.95 * 10 = 9.5 → halfway between 9 and 10
    expect(percentile(values, 95)).toBeCloseTo(9.5, 12);
  });

  it("out-of-range percentiles are clamped", () => {
    expect(percentile([1, 2, 3], -10)).toBe(1);
    expect(percentile([1, 2, 3], 500)).toBe(3);
  });

  it("every percentile is the same on a single-element array", () => {
    expect(percentile([7], 0)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe("rmsDifference", () => {
  it("0 for the same buffer", () => {
    const a = new Float32Array([0.1, 0.2, 0.3, 1, 0.4, 0.5, 0.6, 1]);
    expect(rmsDifference(a, a)).toBe(0);
  });

  it("a hand-computed value for a known difference", () => {
    const a = new Float32Array([1, 0, 0, 1]);
    const b = new Float32Array([0, 0, 0, 1]);
    // one pixel, a difference of 1 in one channel → sqrt(1 / 3)
    expect(rmsDifference(a, b)).toBeCloseTo(Math.sqrt(1 / 3), 6);
  });

  it("IGNORES the alpha channel", () => {
    const a = new Float32Array([0.5, 0.5, 0.5, 1]);
    const b = new Float32Array([0.5, 0.5, 0.5, 0]);
    expect(rmsDifference(a, b)).toBe(0);
  });

  it("throws on a size mismatch", () => {
    expect(() =>
      rmsDifference(new Float32Array(4), new Float32Array(8)),
    ).toThrow();
  });

  it("0 for empty buffers", () => {
    expect(rmsDifference(new Float32Array(0), new Float32Array(0))).toBe(0);
  });
});
