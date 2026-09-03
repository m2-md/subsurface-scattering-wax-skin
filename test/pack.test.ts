import { describe, expect, it } from "vitest";
import { mipChainBytes, textureBytes } from "../src/pack";

describe("textureBytes", () => {
  it("known sizes", () => {
    expect(textureBytes(256, 1)).toBe(65536);
    expect(textureBytes(256, 2)).toBe(131072);
    expect(textureBytes(512, 1)).toBe(262144);
    expect(textureBytes(128, 1)).toBe(16384);
  });

  it("throws when the channel count is 0 or negative", () => {
    expect(() => textureBytes(256, 0)).toThrow();
    expect(() => textureBytes(256, -1)).toThrow();
    expect(() => textureBytes(256, 1.5)).toThrow();
  });

  it("throws on an invalid size", () => {
    expect(() => textureBytes(0, 1)).toThrow();
    expect(() => textureBytes(-4, 1)).toThrow();
  });
});

describe("mipChainBytes", () => {
  it("approaches 4/3x for a square texture", () => {
    const base = 256 * 256 * 4;
    const total = mipChainBytes(256, 256, 4);
    expect(total).toBeGreaterThan(base);
    expect(total / base).toBeGreaterThan(1.33);
    expect(total / base).toBeLessThan(1.34);
  });

  it("a 1x1 texture is a single level", () => {
    expect(mipChainBytes(1, 1, 4)).toBe(4);
  });

  it("finite and correct for a non-square texture too", () => {
    // 4x2 -> 2x1 -> 1x1
    expect(mipChainBytes(4, 2, 1)).toBe(8 + 2 + 1);
  });
});
