import { describe, expect, it } from "vitest";
import { backTranslucency, wrapDiffuse } from "../src/translucency";
import type { Vec3 } from "../src/vec";

/**
 * GLSL ↔ TS parity. Instead of recorded expected values we compare against
 * an ANALYTIC re-derivation of the formula: the point is to catch a
 * copy-paste breaking `src/translucency.ts`.
 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function unit(random: () => number): Vec3 {
  const z = random() * 2 - 1;
  const phi = random() * 2 * Math.PI;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

/** Reference: `pow(clamp(dot(v, -normalize(l + n*d)), 0, 1), p) * s + a`
 *  times `exp(-k*t)`. */
function reference(
  l: Vec3,
  n: Vec3,
  v: Vec3,
  t: number,
  d: number,
  p: number,
  s: number,
  a: number,
  k: number,
): number {
  const hx = l[0] + n[0] * d;
  const hy = l[1] + n[1] * d;
  const hz = l[2] + n[2] * d;
  const len = Math.hypot(hx, hy, hz);
  const dotValue = -(v[0] * hx + v[1] * hy + v[2] * hz) / len;
  const clamped = Math.min(Math.max(dotValue, 0), 1);
  return (Math.pow(clamped, p) * s + a) * Math.exp(-k * t);
}

describe("translucency parity", () => {
  it("matches the analytic derivation on 200 fixed-seed quadruples", () => {
    const random = lcg(20260813);
    for (let i = 0; i < 200; i++) {
      const l = unit(random);
      const n = unit(random);
      const v = unit(random);
      const t = random();
      const d = random() * 0.8;
      const p = 1 + random() * 15;
      const s = 0.2 + random();
      const a = random() * 0.1;
      const k = random() * 6;

      const actual = backTranslucency(l, n, v, t, {
        distortion: d,
        power: p,
        scale: s,
        ambient: a,
        absorption: k,
      });
      expect(actual).toBeCloseTo(reference(l, n, v, t, d, p, s, a, k), 12);
    }
  });

  it("wrapDiffuse matches the analytic formula at 200 points", () => {
    const random = lcg(4242);
    for (let i = 0; i < 200; i++) {
      const ndl = random() * 2 - 1;
      const w = random() * 2;
      const expected = Math.min(
        Math.max((ndl + w) / ((1 + w) * (1 + w)), 0),
        1,
      );
      expect(wrapDiffuse(ndl, w)).toBeCloseTo(expected, 12);
    }
  });
});
