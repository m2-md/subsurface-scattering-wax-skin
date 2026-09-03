import { describe, expect, it } from "vitest";
import { halfArrayToFloat, halfToFloat } from "../src/half";

describe("halfToFloat", () => {
  it("known patterns", () => {
    expect(halfToFloat(0x0000)).toBe(0);
    expect(halfToFloat(0x3c00)).toBe(1);
    expect(halfToFloat(0xbc00)).toBe(-1);
    expect(halfToFloat(0x3555)).toBeCloseTo(0.333, 3);
    expect(halfToFloat(0x7bff)).toBe(65504);
  });

  it("subnormal range", () => {
    expect(halfToFloat(0x0001)).toBeCloseTo(5.96e-8, 10);
    expect(halfToFloat(0x0400)).toBeCloseTo(6.104e-5, 8);
  });

  it("infinity and NaN", () => {
    expect(halfToFloat(0x7c00)).toBe(Infinity);
    expect(halfToFloat(0xfc00)).toBe(-Infinity);
    expect(Number.isNaN(halfToFloat(0x7e00))).toBe(true);
  });

  it("the sign of negative zero is preserved", () => {
    expect(Object.is(halfToFloat(0x8000), -0)).toBe(true);
  });

  it("ignores the bits above bit 16", () => {
    expect(halfToFloat(0x1_3c00)).toBe(1);
  });
});

describe("halfArrayToFloat", () => {
  it("decodes the whole buffer", () => {
    const out = halfArrayToFloat(new Uint16Array([0x0000, 0x3c00, 0xbc00]));
    expect(Array.from(out)).toEqual([0, 1, -1]);
  });
});
