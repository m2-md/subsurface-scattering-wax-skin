import { describe, expect, it } from "vitest";
import { MAX_PIXELS, backingSize, fitPixelBudget } from "../src/viewport";

describe("backingSize", () => {
  it("dpr counts as at most 2", () => {
    const a = backingSize(400, 300, 3, 1);
    const b = backingSize(400, 300, 2, 1);
    expect(a).toEqual(b);
    expect(a.width).toBe(800);
  });

  it("dpr does not go below 1", () => {
    expect(backingSize(400, 300, 0.5, 1).width).toBe(400);
  });

  it("scale is clamped to the [0.25, 1] range", () => {
    expect(backingSize(400, 300, 1, 0.1)).toEqual(
      backingSize(400, 300, 1, 0.25),
    );
    expect(backingSize(400, 300, 1, 2)).toEqual(backingSize(400, 300, 1, 1));
  });

  it("the result is never 0", () => {
    const size = backingSize(1, 1, 1, 0.25);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("the pixel budget ceiling is applied", () => {
    const size = backingSize(3840, 2160, 2, 1);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_PIXELS);
  });
});

describe("fitPixelBudget", () => {
  it("returns the input unchanged when under budget", () => {
    expect(fitPixelBudget(960, 540)).toEqual({ width: 960, height: 540 });
  });

  it("keeps the aspect ratio within 1% when over budget", () => {
    const source = 3840 / 2160;
    const fitted = fitPixelBudget(3840, 2160);
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(Math.abs(fitted.width / fitted.height - source)).toBeLessThan(
      source * 0.01,
    );
  });

  it("a custom budget works too", () => {
    const fitted = fitPixelBudget(1000, 1000, 10000);
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(10000);
    expect(fitted.width).toBe(100);
  });
});
