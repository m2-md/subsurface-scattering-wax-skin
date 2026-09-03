import { describe, expect, it } from "vitest";
import { blobProfile, candleProfile, smoothstep } from "../src/mesh";

describe("candleProfile", () => {
  const points = candleProfile(48);

  it("nokta sayısı steps + 3", () => {
    expect(points).toHaveLength(51);
    expect(candleProfile(12)).toHaveLength(15);
  });

  it("ilk ve son noktanın x'i tam 0 — gövde kapalı", () => {
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBe(0);
    expect(points[0].y).toBe(-1);
    expect(points[points.length - 1].y).toBe(1);
  });

  it("ara noktaların hepsinde x > 0", () => {
    for (let i = 1; i < points.length - 1; i++) {
      expect(points[i].x).toBeGreaterThan(0);
    }
  });

  it("y monoton artar (azalmaz)", () => {
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeGreaterThanOrEqual(points[i - 1].y);
    }
    expect(points[points.length - 1].y).toBe(1);
  });

  it("tepedeki rim gövdeden belirgin biçimde ince", () => {
    const widest = Math.max(...points.map((p) => p.x));
    const rim = points[points.length - 2].x;
    expect(rim).toBeLessThan(widest * 0.2);
  });
});

describe("blobProfile", () => {
  const points = blobProfile(48);

  it("aynı kapalılık sözleşmesini sağlar", () => {
    expect(points).toHaveLength(51);
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBe(0);
    for (let i = 1; i < points.length - 1; i++) {
      expect(points[i].x).toBeGreaterThan(0);
    }
  });

  it("y monoton artar", () => {
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeGreaterThanOrEqual(points[i - 1].y);
    }
  });

  it("dibi geniş, tepesi ince", () => {
    expect(points[1].x).toBeGreaterThan(points[points.length - 2].x);
  });
});

describe("smoothstep", () => {
  it("uçlarda 0 ve 1", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it("ortada 0.5 ve arada monoton", () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
    let previous = -1;
    for (let i = 0; i <= 20; i++) {
      const value = smoothstep(0.2, 0.8, i / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("e0 === e1 olduğunda basamak fonksiyonuna döner", () => {
    expect(smoothstep(0.5, 0.5, 0.4)).toBe(0);
    expect(smoothstep(0.5, 0.5, 0.6)).toBe(1);
  });
});
