import { describe, expect, it } from "vitest";
import { EDGE, rasterizeTriangle } from "../src/bake/raster";
import type { Vec2 } from "../src/vec";

const SIZE = 64;

function collect(a: Vec2, b: Vec2, c: Vec2, size = SIZE) {
  const texels: number[] = [];
  const weights: [number, number, number][] = [];
  const written = rasterizeTriangle(size, a, b, c, (texel, wa, wb, wc) => {
    texels.push(texel);
    weights.push([wa, wb, wc]);
  });
  return { texels, weights, written };
}

describe("rasterizeTriangle", () => {
  it("doldurulan texel sayısı üçgen alanıyla orantılı", () => {
    const half = collect([0, 0], [1, 0], [0, 1]);
    const quarter = collect([0, 0], [0.5, 0], [0, 0.5]);
    const total = SIZE * SIZE;
    expect(half.written / total).toBeGreaterThan(0.5 * 0.9);
    expect(half.written / total).toBeLessThan(0.5 * 1.1);
    expect(quarter.written / total).toBeGreaterThan(0.125 * 0.9);
    expect(quarter.written / total).toBeLessThan(0.125 * 1.1);
  });

  it("baryantrik ağırlıkların toplamı 1", () => {
    const { weights } = collect([0, 0], [1, 0], [0, 1]);
    for (const [wa, wb, wc] of weights) {
      expect(wa + wb + wc).toBeCloseTo(1, 12);
    }
  });

  it("ağırlıkların hepsi -EDGE'in üstünde", () => {
    const { weights } = collect([0.1, 0.2], [0.8, 0.15], [0.4, 0.9]);
    for (const [wa, wb, wc] of weights) {
      expect(wa).toBeGreaterThanOrEqual(-EDGE);
      expect(wb).toBeGreaterThanOrEqual(-EDGE);
      expect(wc).toBeGreaterThanOrEqual(-EDGE);
    }
  });

  it("dejenere üçgen 0 döndürür", () => {
    expect(collect([0.2, 0.2], [0.6, 0.6], [0.4, 0.4]).written).toBe(0);
    expect(collect([0.2, 0.2], [0.2, 0.2], [0.2, 0.2]).written).toBe(0);
  });

  it("ızgara dışına taşan üçgen kırpılır, indeks aralıkta kalır", () => {
    const { texels, written } = collect([-2, -2], [4, -2], [-2, 4]);
    expect(written).toBeGreaterThan(0);
    for (const texel of texels) {
      expect(texel).toBeGreaterThanOrEqual(0);
      expect(texel).toBeLessThan(SIZE * SIZE);
    }
  });

  it("birim kareyi kaplayan iki üçgen BÜTÜN texel'leri doldurur", () => {
    // Texel merkezi kaydırmasının (- 0.5) doğruluğu buna bağlı.
    const seen = new Set<number>();
    const push = (texel: number) => seen.add(texel);
    rasterizeTriangle(SIZE, [0, 0], [1, 0], [1, 1], push);
    rasterizeTriangle(SIZE, [0, 0], [1, 1], [0, 1], push);
    expect(seen.size).toBe(SIZE * SIZE);
  });

  it("texel indeksi satır-öncelikli: y * size + x", () => {
    // Yalnızca (0,0) texel'ini kaplayan küçük bir üçgen.
    const { texels } = collect([0, 0], [1 / SIZE, 0], [0, 1 / SIZE]);
    expect(texels).toContain(0);
    for (const texel of texels) {
      expect(texel % SIZE).toBeLessThan(2);
      expect(Math.floor(texel / SIZE)).toBeLessThan(2);
    }
  });
});
