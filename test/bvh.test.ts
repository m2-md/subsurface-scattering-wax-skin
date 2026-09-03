import { describe, expect, it } from "vitest";
import { Bvh, slabDistance } from "../src/bake/bvh";
import { bruteForceIntersect } from "../src/bake/intersect";
import { cosineDirection, hammersley } from "../src/bake/sampling";
import { boxTriangles, icosphereTriangles } from "./geometry";

// test/bvh.test.ts (parça)
describe("Bvh", () => {
  it("BVH sonucu kaba kuvvetle birebir aynı", () => {
    const tris = icosphereTriangles(2); // deterministik, tohum yok
    const bvh = new Bvh(tris, 4);

    for (let i = 0; i < 200; i++) {
      const [u1, u2] = hammersley(i, 200);
      const dir = cosineDirection(u1, u2, [0, 1, 0]);
      const brute = bruteForceIntersect(tris, [0, 0, 0], dir, 100);
      const tree = bvh.intersect(0, 0, 0, dir[0], dir[1], dir[2], 100);
      expect(tree).toBeCloseTo(brute, 12);
    }
  });

  it("eksene paralel ışınlarda NaN üretmez", () => {
    const bvh = new Bvh(boxTriangles(1), 4);
    for (const dir of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [-1, 0, 0],
    ] as const) {
      const t = bvh.intersect(0, 0, 0, dir[0], dir[1], dir[2], 100);
      expect(Number.isNaN(t)).toBe(false);
      expect(t).toBeLessThan(100);
    }
  });

  it("neredeyse eksene paralel ışında da kaba kuvvetle aynı sonucu verir", () => {
    // Fırın kaydından çıkan regresyon. Kuzey kutbundaki texel'in ışını x eksenine
    // TAM paralel değil: dx = 3.4e-17, yani 1/dx sonsuz değil 2.9e16. Işının
    // başlangıcı bir düğüm kutusunun maxX düzlemi üstünde durunca
    // `hi = (maxX - ox) * invX` tam 0 çıkıyor, `tmax` 0'a kelepçeleniyor ve
    // gerçek kesişimi taşıyan yaprak sessizce eleniyordu.
    const tris = icosphereTriangles(2);
    const bvh = new Bvh(tris, 4);
    const maxChord = 2 * Math.sqrt(3);
    const origin: [number, number, number] = [0, -0.9999, 0];
    const dir: [number, number, number] = [
      3.422991864151267e-17, 0.82915619758885, -0.5590169943749475,
    ];

    const brute = bruteForceIntersect(tris, origin, dir, maxChord);
    const tree = bvh.intersect(
      origin[0],
      origin[1],
      origin[2],
      dir[0],
      dir[1],
      dir[2],
      maxChord,
    );
    // Kaba kuvvet gerçekten bir duvar buluyor: ışın kapalı gövdenin içinden geçiyor.
    expect(brute).toBeLessThan(maxChord);
    expect(tree).toBeCloseTo(brute, 12);
  });

  it("leafSize 1/4/16 üçünde de aynı sonucu verir", () => {
    const tris = icosphereTriangles(2);
    const trees = [1, 4, 16].map((leaf) => new Bvh(tris, leaf));
    for (let i = 0; i < 120; i++) {
      const [u1, u2] = hammersley(i, 120);
      const dir = cosineDirection(u1, u2, [0.3, -0.9, 0.2]);
      const values = trees.map((bvh) =>
        bvh.intersect(0.1, 0.05, -0.2, dir[0], dir[1], dir[2], 100),
      );
      expect(values[1]).toBeCloseTo(values[0], 12);
      expect(values[2]).toBeCloseTo(values[0], 12);
    }
  });

  it("boş ağaç çökmüyor, tMax döndürüyor", () => {
    const bvh = new Bvh(new Float32Array(0), 4);
    expect(bvh.triangleCount).toBe(0);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 42)).toBe(42);
  });

  it("tek üçgenli ağaç doğru mesafeyi veriyor", () => {
    const bvh = new Bvh(new Float32Array([-1, -1, 5, 3, -1, 5, -1, 3, 5]), 4);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 100)).toBeCloseTo(5, 12);
    expect(bvh.intersect(9, 9, 0, 0, 0, 1, 100)).toBe(100);
  });

  it("tMax sınırının ötesindeki kesişim döndürülmez", () => {
    const bvh = new Bvh(boxTriangles(3), 4);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 1)).toBe(1);
    expect(bvh.intersect(0, 0, 0, 0, 0, 1, 10)).toBeCloseTo(3, 6);
  });

  it("yığın taşmıyor: derinlik sınırı yığın boyutuna uyuyor", () => {
    const bvh = new Bvh(icosphereTriangles(3), 4);
    expect(bvh.stack.length).toBeGreaterThanOrEqual(2 * bvh.depth + 8);
    // 5120 üçgen, yaprak 4 → derinlik log2(1280) civarı
    expect(bvh.depth).toBeLessThan(32);
    const t = bvh.intersect(0, 0, 0, 0, 0, 1, 100);
    expect(Number.isNaN(t)).toBe(false);
    expect(t).toBeCloseTo(1, 6);
  });
});

describe("slabDistance", () => {
  // Tek düğüm: [-1,-1,-1] .. [1,1,1]
  const bounds = new Float32Array([-1, -1, -1, 1, 1, 1]);

  it("kutunun içinden başlayan ışın için 0 döner", () => {
    expect(slabDistance(bounds, 0, 0, 0, 0, 1, 1, 1, 100)).toBe(0);
  });

  it("dışarıdan gelen ışın için giriş mesafesini verir", () => {
    // Yön (0, 0, 1): x ve y ters değerleri sonsuz.
    expect(
      slabDistance(bounds, 0, 0, 0, -5, Infinity, Infinity, 1, 100),
    ).toBeCloseTo(4, 12);
  });

  it("ıskalayan ışın Infinity döner", () => {
    expect(slabDistance(bounds, 0, 5, 5, -5, 1, 1, 1, 100)).toBe(Infinity);
  });

  it("0 * Infinity = NaN tuzağına düşmez: sınırın tam üstündeki paralel ışın", () => {
    // Işın x = -1 düzleminde ve x eksenine paralel: (bmin.x - ox) * inf = NaN
    const value = slabDistance(bounds, 0, -1, 0, 0, Infinity, 1, 1, 100);
    expect(Number.isNaN(value)).toBe(false);
    expect(value).toBe(0);
  });

  it("neredeyse paralel ışın sınırın tam üstündeyken kutuyu elemiyor", () => {
    // `1 / d` sonsuz değil, sadece devasa (d = 3.4e-17). Başlangıç kutunun maxX
    // düzlemi üstünde: naif slab testinde `hi = (1 - 1) * 2.9e16 = 0` çıkıyor,
    // `tmax` 0'a iniyor ve y ekseni `tmin`i 2'ye çekince kutu yanlışlıkla eleniyor.
    const value = slabDistance(
      bounds,
      0,
      1,
      -3,
      0,
      1 / 3.422991864151267e-17,
      1,
      Infinity,
      100,
    );
    expect(Number.isNaN(value)).toBe(false);
    expect(value).toBeCloseTo(2, 12);
  });

  it("eksene paralel ve kutunun dışındaki ışın Infinity döner", () => {
    const value = slabDistance(bounds, 0, 5, 0, 0, Infinity, 1, 1, 100);
    expect(value).toBe(Infinity);
  });

  it("tMax'tan uzaktaki kutu elenir", () => {
    expect(slabDistance(bounds, 0, 0, 0, -5, Infinity, Infinity, 1, 2)).toBe(
      Infinity,
    );
  });
});
