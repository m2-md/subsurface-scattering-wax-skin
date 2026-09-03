import { describe, expect, it } from "vitest";
import { backTranslucency, wrapDiffuse } from "../src/translucency";
import type { Vec3 } from "../src/vec";

// test/translucency.test.ts (parça)
describe("wrapDiffuse", () => {
  it("wrap = 0 iken Lambert ile birebir aynıdır", () => {
    for (const ndl of [-1, -0.5, -0.001, 0, 0.001, 0.5, 1]) {
      expect(wrapDiffuse(ndl, 0)).toBeCloseTo(Math.max(ndl, 0), 12);
    }
  });

  it("terminatör tam olarak ndl = -wrap noktasında biter", () => {
    for (const w of [0.1, 0.35, 0.8, 1]) {
      expect(wrapDiffuse(-w, w)).toBe(0);
      expect(wrapDiffuse(-w + 1e-3, w)).toBeGreaterThan(0);
    }
  });

  it("tepe parlaklığı 1/(1+w)'ye iner: kaydırma bedava değil", () => {
    for (const w of [0.25, 0.5, 1]) {
      expect(wrapDiffuse(1, w)).toBeCloseTo(1 / (1 + w), 12);
    }
  });

  it("negatif wrap max(wrap, 0) ile kırpılır", () => {
    for (const ndl of [-0.5, 0, 0.5, 1]) {
      expect(wrapDiffuse(ndl, -2)).toBeCloseTo(wrapDiffuse(ndl, 0), 12);
    }
  });

  it("çıktı her zaman [0, 1] aralığında", () => {
    for (let i = 0; i <= 40; i++) {
      const ndl = -1 + i / 20;
      for (const w of [0, 0.25, 0.5, 1, 4]) {
        const value = wrapDiffuse(ndl, w);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

const P = { distortion: 0, power: 4, scale: 1, ambient: 0, absorption: 0 };

describe("backTranslucency", () => {
  it("ışık tam arkadayken lob tepe değerini verir", () => {
    // Kamera +z'de, ışık -z'de: yüzeyden ışığa doğru vektör -z.
    const value = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 0, P);
    expect(value).toBeCloseTo(P.scale, 12);
  });

  it("ışık tam öndeyken terim ambient'e iner", () => {
    const value = backTranslucency([0, 0, 1], [0, 0, 1], [0, 0, 1], 0, {
      ...P,
      ambient: 0.05,
    });
    expect(value).toBeCloseTo(0.05, 12);
  });

  it("kalınlık arttıkça üstel olarak sönümlenir", () => {
    const thin = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 0.0, {
      ...P,
      absorption: 3,
    });
    const thick = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 1.0, {
      ...P,
      absorption: 3,
    });
    expect(thin).toBeCloseTo(1, 12);
    expect(thick).toBeCloseTo(Math.exp(-3), 12);
  });

  it("thickness = 0 ve absorption = 0 iken tam olarak scale + ambient", () => {
    const value = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 0, {
      ...P,
      scale: 0.7,
      ambient: 0.05,
    });
    expect(value).toBeCloseTo(0.75, 12);
  });

  it("power büyüdükçe aynı açıda lob daralır", () => {
    // Işık tam arkada değil: 30° kaymış bir bakış yönü.
    const view: Vec3 = [Math.sin(Math.PI / 6), 0, Math.cos(Math.PI / 6)];
    let previous = Infinity;
    for (const power of [1, 2, 4, 8, 16]) {
      const value = backTranslucency([0, 0, -1], [0, 0, 1], view, 0, {
        ...P,
        power,
      });
      expect(value).toBeLessThan(previous);
      previous = value;
    }
  });

  it("distortion arttıkça lobun tepe yönü normale doğru kayar", () => {
    // Işık -z'de, yüzey normali +x'te, kamera +z'de. distortion büyüdükçe h
    // normale kayar, -h kameradan uzaklaşır: değer 1/sqrt(1+d²)^power'a iner.
    let previous = Infinity;
    for (const distortion of [0, 0.2, 0.4, 0.8]) {
      const value = backTranslucency([0, 0, -1], [1, 0, 0], [0, 0, 1], 0, {
        ...P,
        distortion,
      });
      expect(value).toBeLessThan(previous);
      expect(value).toBeCloseTo((1 / Math.sqrt(1 + distortion ** 2)) ** 4, 12);
      previous = value;
    }
  });

  it("lob negatif tarafta kırpılır, ambient'in altına inmez", () => {
    for (const angle of [0, 45, 90, 135, 180]) {
      const rad = (angle * Math.PI) / 180;
      const view: Vec3 = [Math.sin(rad), 0, Math.cos(rad)];
      const value = backTranslucency([0, 0, -1], [0, 0, 1], view, 0, {
        ...P,
        ambient: 0.05,
      });
      expect(value).toBeGreaterThanOrEqual(0.05 - 1e-12);
    }
  });
});
