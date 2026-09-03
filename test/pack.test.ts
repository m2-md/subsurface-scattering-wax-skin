import { describe, expect, it } from "vitest";
import { mipChainBytes, textureBytes } from "../src/pack";

describe("textureBytes", () => {
  it("bilinen boyutlar", () => {
    expect(textureBytes(256, 1)).toBe(65536);
    expect(textureBytes(256, 2)).toBe(131072);
    expect(textureBytes(512, 1)).toBe(262144);
    expect(textureBytes(128, 1)).toBe(16384);
  });

  it("kanal sayısı 0 ya da negatifse throw", () => {
    expect(() => textureBytes(256, 0)).toThrow();
    expect(() => textureBytes(256, -1)).toThrow();
    expect(() => textureBytes(256, 1.5)).toThrow();
  });

  it("geçersiz boyutta throw", () => {
    expect(() => textureBytes(0, 1)).toThrow();
    expect(() => textureBytes(-4, 1)).toThrow();
  });
});

describe("mipChainBytes", () => {
  it("kare doku için 4/3 katına yaklaşır", () => {
    const base = 256 * 256 * 4;
    const total = mipChainBytes(256, 256, 4);
    expect(total).toBeGreaterThan(base);
    expect(total / base).toBeGreaterThan(1.33);
    expect(total / base).toBeLessThan(1.34);
  });

  it("1x1 doku tek seviyedir", () => {
    expect(mipChainBytes(1, 1, 4)).toBe(4);
  });

  it("kare olmayan dokuda da sonlu ve doğru", () => {
    // 4x2 -> 2x1 -> 1x1
    expect(mipChainBytes(4, 2, 1)).toBe(8 + 2 + 1);
  });
});
