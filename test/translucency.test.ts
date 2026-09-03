import { describe, expect, it } from "vitest";
import { backTranslucency, wrapDiffuse } from "../src/translucency";
import type { Vec3 } from "../src/vec";

// test/translucency.test.ts (excerpt)
describe("wrapDiffuse", () => {
  it("is identical to Lambert when wrap = 0", () => {
    for (const ndl of [-1, -0.5, -0.001, 0, 0.001, 0.5, 1]) {
      expect(wrapDiffuse(ndl, 0)).toBeCloseTo(Math.max(ndl, 0), 12);
    }
  });

  it("the terminator ends exactly at ndl = -wrap", () => {
    for (const w of [0.1, 0.35, 0.8, 1]) {
      expect(wrapDiffuse(-w, w)).toBe(0);
      expect(wrapDiffuse(-w + 1e-3, w)).toBeGreaterThan(0);
    }
  });

  it("peak brightness drops to 1/(1+w): the shift is not free", () => {
    for (const w of [0.25, 0.5, 1]) {
      expect(wrapDiffuse(1, w)).toBeCloseTo(1 / (1 + w), 12);
    }
  });

  it("negative wrap is clipped with max(wrap, 0)", () => {
    for (const ndl of [-0.5, 0, 0.5, 1]) {
      expect(wrapDiffuse(ndl, -2)).toBeCloseTo(wrapDiffuse(ndl, 0), 12);
    }
  });

  it("output is always in the [0, 1] range", () => {
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
  it("gives the lobe peak when the light is straight behind", () => {
    // Camera at +z, light at -z: the vector from surface to light is -z.
    const value = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 0, P);
    expect(value).toBeCloseTo(P.scale, 12);
  });

  it("the term drops to ambient when the light is straight ahead", () => {
    const value = backTranslucency([0, 0, 1], [0, 0, 1], [0, 0, 1], 0, {
      ...P,
      ambient: 0.05,
    });
    expect(value).toBeCloseTo(0.05, 12);
  });

  it("attenuates exponentially as thickness grows", () => {
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

  it("exactly scale + ambient when thickness = 0 and absorption = 0", () => {
    const value = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 0, {
      ...P,
      scale: 0.7,
      ambient: 0.05,
    });
    expect(value).toBeCloseTo(0.75, 12);
  });

  it("the lobe narrows at the same angle as power grows", () => {
    // The light is not straight behind: a view direction shifted by 30°.
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

  it("the lobe's peak direction shifts toward the normal as distortion grows", () => {
    // Light at -z, surface normal at +x, camera at +z. As distortion grows, h
    // shifts to the normal and -h leaves the camera: value → 1/sqrt(1+d²)^power.
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

  it("the lobe is clipped on the negative side, never drops below ambient", () => {
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
