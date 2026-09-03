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
  it("beyaz 1, siyah 0", () => {
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1, 12);
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });

  it("katsayı toplamı 1", () => {
    expect(LUMA_R + LUMA_G + LUMA_B).toBeCloseTo(1, 12);
  });

  it("tek kanal değerleri katsayılara eşit", () => {
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
    1, // beyaz
    0,
    0,
    0,
    1, // siyah
    1,
    1,
    1,
    1, // beyaz
    0.5,
    0.5,
    0.5,
    1,
  ]);

  it("maskesiz pikselleri saymaz", () => {
    expect(maskedMean(frame, new Uint8Array([1, 0, 1, 0]))).toBeCloseTo(1, 12);
    expect(maskedMean(frame, new Uint8Array([0, 1, 0, 0]))).toBe(0);
  });

  it("boş maskede NaN değil 0 döndürür", () => {
    expect(maskedMean(frame, new Uint8Array([0, 0, 0, 0]))).toBe(0);
  });

  it("bütün maske açıkken ortalama", () => {
    expect(maskedMean(frame, new Uint8Array([1, 1, 1, 1]))).toBeCloseTo(
      (1 + 0 + 1 + 0.5) / 4,
      6,
    );
  });

  it("kare tamponu maskeden küçükse throw", () => {
    expect(() => maskedMean(frame, new Uint8Array(8))).toThrow();
  });
});

describe("bucketMeans", () => {
  const lum = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

  it("sınır değerleri KESİN eşitsizlikle dışarıda kalır", () => {
    // Sınırlar float32'de TAM temsil edilebilen sayılardan seçildi (0,25 · 0,5);
    // 0,6 gibi bir sınırda testin ölçtüğü şey sözleşme değil yuvarlama olurdu.
    const thickness = new Float32Array([0.1, 0.25, 0.5, 0.75, 0.875]);
    const result = bucketMeans(lum, thickness, 0.25, 0.5);
    // 0,25 ince kovaya girmez, 0,5 kalın kovaya girmez.
    expect(result.thinPixels).toBe(1);
    expect(result.thin).toBeCloseTo(0.1, 6);
    expect(result.thickPixels).toBe(2);
    expect(result.thick).toBeCloseTo((0.4 + 0.5) / 2, 6);
  });

  it("kova boşsa null", () => {
    const thickness = new Float32Array([0.4, 0.45, 0.5, 0.55, 0.58]);
    const result = bucketMeans(lum, thickness, 0.25, 0.6);
    expect(result.thin).toBeNull();
    expect(result.thick).toBeNull();
    expect(result.thinPixels).toBe(0);
    expect(result.thickPixels).toBe(0);
  });

  it("NaN kalınlık (maske dışı) sayılmaz", () => {
    const thickness = new Float32Array([Number.NaN, 0.1, Number.NaN, 0.9, 0.9]);
    const result = bucketMeans(lum, thickness, 0.25, 0.6);
    expect(result.thinPixels).toBe(1);
    expect(result.thin).toBeCloseTo(0.2, 6);
    expect(result.thickPixels).toBe(2);
  });

  it("boyut uyuşmazlığında throw", () => {
    expect(() => bucketMeans(lum, new Float32Array(3), 0.25, 0.6)).toThrow();
  });
});
