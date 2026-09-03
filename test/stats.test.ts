import { describe, expect, it } from "vitest";
import { median, percentile, rmsDifference } from "../src/stats";

describe("median", () => {
  it("tek eleman sayısında ortadaki", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("çift eleman sayısında ortalama", () => {
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5, 12);
  });

  it("girdi dizisi MUTASYONA UĞRAMAZ", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("percentile", () => {
  it("boş dizide NaN", () => {
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });

  it("p0 ve p100 uçları verir", () => {
    expect(percentile([5, 1, 9], 0)).toBe(1);
    expect(percentile([5, 1, 9], 100)).toBe(9);
  });

  it("p95 doğrusal interpolasyonla", () => {
    const values = Array.from({ length: 11 }, (_, i) => i); // 0..10
    // rank = 0.95 * 10 = 9.5 → 9 ile 10 arasında yarı yol
    expect(percentile(values, 95)).toBeCloseTo(9.5, 12);
  });

  it("aralık dışı yüzdelikler kelepçelenir", () => {
    expect(percentile([1, 2, 3], -10)).toBe(1);
    expect(percentile([1, 2, 3], 500)).toBe(3);
  });

  it("tek elemanlı dizide her yüzdelik aynı", () => {
    expect(percentile([7], 0)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe("rmsDifference", () => {
  it("aynı tamponda 0", () => {
    const a = new Float32Array([0.1, 0.2, 0.3, 1, 0.4, 0.5, 0.6, 1]);
    expect(rmsDifference(a, a)).toBe(0);
  });

  it("bilinen farkta elle hesaplanmış değer", () => {
    const a = new Float32Array([1, 0, 0, 1]);
    const b = new Float32Array([0, 0, 0, 1]);
    // tek piksel, tek kanalda 1 fark → sqrt(1 / 3)
    expect(rmsDifference(a, b)).toBeCloseTo(Math.sqrt(1 / 3), 6);
  });

  it("alfa kanalını YOK SAYAR", () => {
    const a = new Float32Array([0.5, 0.5, 0.5, 1]);
    const b = new Float32Array([0.5, 0.5, 0.5, 0]);
    expect(rmsDifference(a, b)).toBe(0);
  });

  it("boyut uyuşmazlığında throw", () => {
    expect(() =>
      rmsDifference(new Float32Array(4), new Float32Array(8)),
    ).toThrow();
  });

  it("boş tamponlarda 0", () => {
    expect(rmsDifference(new Float32Array(0), new Float32Array(0))).toBe(0);
  });
});
