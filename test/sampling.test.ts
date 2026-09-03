import { describe, expect, it } from "vitest";
import {
  cosineDirection,
  hammersley,
  orthonormalBasis,
  radicalInverse2,
} from "../src/bake/sampling";
import { dot, length } from "../src/vec";
import type { Vec3 } from "../src/vec";

/** Sabit tohumlu, `Math.random` kullanmayan üreteç. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomDirection(random: () => number): Vec3 {
  const z = random() * 2 - 1;
  const phi = random() * 2 * Math.PI;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

describe("radicalInverse2", () => {
  it("bilinen ilk sekiz değeri verir", () => {
    const expected = [0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875];
    expected.forEach((value, index) => {
      expect(radicalInverse2(index)).toBeCloseTo(value, 12);
    });
  });

  it("her zaman [0, 1) aralığında", () => {
    for (let i = 0; i < 4096; i++) {
      const value = radicalInverse2(i);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("hammersley", () => {
  it("ilk bileşen monoton artar ve [0,1) aralığında kalır", () => {
    let previous = -1;
    for (let i = 0; i < 64; i++) {
      const [u1, u2] = hammersley(i, 64);
      expect(u1).toBeGreaterThan(previous);
      expect(u1).toBeLessThan(1);
      expect(u2).toBeGreaterThanOrEqual(0);
      expect(u2).toBeLessThan(1);
      previous = u1;
    }
  });

  it("ikinci bileşen radicalInverse2 ile aynıdır", () => {
    for (let i = 0; i < 16; i++) {
      expect(hammersley(i, 16)[1]).toBe(radicalInverse2(i));
    }
  });
});

describe("orthonormalBasis", () => {
  it("200 sabit tohumlu yönde ortonormal kalır", () => {
    const random = lcg(1337);
    for (let i = 0; i < 200; i++) {
      const n = randomDirection(random);
      const [t, b] = orthonormalBasis(n);
      expect(length(t)).toBeCloseTo(1, 12);
      expect(length(b)).toBeCloseTo(1, 12);
      expect(Math.abs(dot(t, b))).toBeLessThan(1e-12);
      expect(Math.abs(dot(t, n))).toBeLessThan(1e-12);
      expect(Math.abs(dot(b, n))).toBeLessThan(1e-12);
    }
  });

  it("kutuplarda NaN üretmez", () => {
    for (const n of [
      [0, 0, 1],
      [0, 0, -1],
    ] as Vec3[]) {
      const [t, b] = orthonormalBasis(n);
      for (const value of [...t, ...b]) expect(Number.isNaN(value)).toBe(false);
      expect(length(t)).toBeCloseTo(1, 12);
      expect(length(b)).toBeCloseTo(1, 12);
      expect(Math.abs(dot(t, n))).toBeLessThan(1e-12);
      expect(Math.abs(dot(b, n))).toBeLessThan(1e-12);
    }
  });
});

describe("cosineDirection", () => {
  it("1000 örnek birim uzunlukta ve normalle pozitif çarpım verir", () => {
    const n: Vec3 = [0, 1, 0];
    for (let i = 0; i < 1000; i++) {
      const [u1, u2] = hammersley(i, 1000);
      const dir = cosineDirection(u1, u2, n);
      expect(length(dir)).toBeCloseTo(1, 10);
      expect(dot(dir, n)).toBeGreaterThanOrEqual(0);
    }
  });

  it("keyfi normaller etrafında da yarım küreyi terk etmez", () => {
    const random = lcg(7);
    for (let i = 0; i < 200; i++) {
      const n = randomDirection(random);
      const [u1, u2] = hammersley(i, 200);
      const dir = cosineDirection(u1, u2, n);
      expect(length(dir)).toBeCloseTo(1, 10);
      expect(dot(dir, n)).toBeGreaterThan(-1e-12);
    }
  });

  it("ortalama yön normale yakınsar: kosinüs ağırlığının kanıtı", () => {
    const n: Vec3 = [0, 0, 1];
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const count = 4096;
    for (let i = 0; i < count; i++) {
      const [u1, u2] = hammersley(i, count);
      const dir = cosineDirection(u1, u2, n);
      sx += dir[0];
      sy += dir[1];
      sz += dir[2];
    }
    // Kosinüs ağırlıklı yarım kürede E[cos] = 2/3.
    expect(sz / count).toBeCloseTo(2 / 3, 2);
    expect(Math.abs(sx / count)).toBeLessThan(1e-2);
    expect(Math.abs(sy / count)).toBeLessThan(1e-2);
  });
});
