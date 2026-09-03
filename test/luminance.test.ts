import { describe, expect, it } from "vitest";
import {
  LUMA_B,
  LUMA_G,
  LUMA_R,
  bucketMeans,
  maskedMean,
  relativeLuminance,
} from "../src/luminance";

describe("relativeLuminance", () => {
  it("white is 1, black is 0", () => {
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1, 12);
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });

  it("the coefficients sum to 1", () => {
    expect(LUMA_R + LUMA_G + LUMA_B).toBeCloseTo(1, 12);
  });

  it("single-channel values equal the coefficients", () => {
    expect(relativeLuminance(1, 0, 0)).toBeCloseTo(LUMA_R, 12);
    expect(relativeLuminance(0, 1, 0)).toBeCloseTo(LUMA_G, 12);
    expect(relativeLuminance(0, 0, 1)).toBeCloseTo(LUMA_B, 12);
  });
});

describe("maskedMean", () => {
  const frame = new Float32Array([
    1,
    1,
    1,
    1, // white
    0,
    0,
    0,
    1, // black
    1,
    1,
    1,
    1, // white
    0.5,
    0.5,
    0.5,
    1,
  ]);

  it("does not count unmasked pixels", () => {
    expect(maskedMean(frame, new Uint8Array([1, 0, 1, 0]))).toBeCloseTo(1, 12);
    expect(maskedMean(frame, new Uint8Array([0, 1, 0, 0]))).toBe(0);
  });

  it("returns 0, not NaN, for an empty mask", () => {
    expect(maskedMean(frame, new Uint8Array([0, 0, 0, 0]))).toBe(0);
  });

  it("the mean when the whole mask is on", () => {
    expect(maskedMean(frame, new Uint8Array([1, 1, 1, 1]))).toBeCloseTo(
      (1 + 0 + 1 + 0.5) / 4,
      6,
    );
  });

  it("throws when the frame buffer is smaller than the mask", () => {
    expect(() => maskedMean(frame, new Uint8Array(8))).toThrow();
  });
});

describe("bucketMeans", () => {
  const lum = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

  it("boundary values stay out via STRICT inequality", () => {
    // The bounds are numbers EXACTLY representable in float32 (0.25 · 0.5); at a
    // bound like 0.6 the test would measure rounding, not the contract.
    const thickness = new Float32Array([0.1, 0.25, 0.5, 0.75, 0.875]);
    const result = bucketMeans(lum, thickness, 0.25, 0.5);
    // 0.25 does not enter the thin bucket, 0.5 does not enter the thick one.
    expect(result.thinPixels).toBe(1);
    expect(result.thin).toBeCloseTo(0.1, 6);
    expect(result.thickPixels).toBe(2);
    expect(result.thick).toBeCloseTo((0.4 + 0.5) / 2, 6);
  });

  it("null when a bucket is empty", () => {
    const thickness = new Float32Array([0.4, 0.45, 0.5, 0.55, 0.58]);
    const result = bucketMeans(lum, thickness, 0.25, 0.6);
    expect(result.thin).toBeNull();
    expect(result.thick).toBeNull();
    expect(result.thinPixels).toBe(0);
    expect(result.thickPixels).toBe(0);
  });

  it("NaN thickness (outside the mask) is not counted", () => {
    const thickness = new Float32Array([Number.NaN, 0.1, Number.NaN, 0.9, 0.9]);
    const result = bucketMeans(lum, thickness, 0.25, 0.6);
    expect(result.thinPixels).toBe(1);
    expect(result.thin).toBeCloseTo(0.2, 6);
    expect(result.thickPixels).toBe(2);
  });

  it("throws on a size mismatch", () => {
    expect(() => bucketMeans(lum, new Float32Array(3), 0.25, 0.6)).toThrow();
  });
});
