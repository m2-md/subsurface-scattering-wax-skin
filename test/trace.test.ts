import { describe, expect, it } from "vitest";
import { Bvh } from "../src/bake/bvh";
import { bruteForceIntersect } from "../src/bake/intersect";
import { cosineDirection, radicalInverse2 } from "../src/bake/sampling";
import { traceThickness } from "../src/bake/trace";
import { icosphereTriangles } from "./geometry";

// Birim kürenin sınırlayıcı kutusunun köşegeni: fırındaki `maxChord`ın karşılığı.
const MAX_CHORD = 2 * Math.sqrt(3);
const RAYS = 8;

/**
 * Üçgen köşelerini texel gibi kullan: birim kürede konum zaten normalin kendisi.
 * Rasterizasyona gerek yok, `traceThickness` sadece bu üç diziyi istiyor.
 */
function texelsFromSurface(tris: Float32Array) {
  const texelCount = tris.length / 3;
  const positions = Float32Array.from(tris);
  const normals = Float32Array.from(tris);
  const filled = new Uint8Array(texelCount).fill(1);
  return { positions, normals, filled, texelCount };
}

const sphere = icosphereTriangles(2); // 320 üçgen, kapalı ve dışbükey
const half = sphere.subarray(0, Math.floor(sphere.length / 9 / 2) * 9);

describe("traceThickness — kaçan ışın sayacı", () => {
  it("kapalı gövdede kaçak yok ve her texel sonlu bir kalınlık alıyor", () => {
    const { positions, normals, filled, texelCount } =
      texelsFromSurface(sphere);
    const { raw, escaped } = traceThickness({
      tris: sphere,
      bvh: new Bvh(sphere, 4),
      positions,
      normals,
      filled,
      rays: RAYS,
      maxChord: MAX_CHORD,
    });

    expect(escaped).toBe(0);
    for (let i = 0; i < texelCount; i++) {
      expect(raw[i]).toBeGreaterThan(0);
      expect(raw[i]).toBeLessThan(2.0001); // kürenin çapı, tavandan küçük
    }
  });

  it("üçgenlerin yarısı silinince kaçak sayısı sıfırdan büyük", () => {
    // Denetim sondası: gövdede kocaman bir delik açılınca sayaç ötmeli.
    const { positions, normals, filled, texelCount } =
      texelsFromSurface(sphere);
    const { raw, escaped } = traceThickness({
      tris: half,
      bvh: new Bvh(half, 4),
      positions,
      normals,
      filled,
      rays: RAYS,
      maxChord: MAX_CHORD,
    });

    expect(escaped).toBeGreaterThan(0);
    // Yarısı yoksa kaçak oranı da fark edilir olmalı, tek tük değil.
    expect(escaped / (texelCount * RAYS)).toBeGreaterThan(0.1);
    // Kaçan ışın kalınlığı tavana dayıyor, ama "en az bir texel TAM tavan"
    // iddiası bu kabukta geometrik olarak yanlış: projeden bağımsız, çift
    // duyarlıklı bir Möller–Trumbore sondasıyla saydım — bir texel'in 8
    // ışınından EN FAZLA 6'sı kaçıyor (7/8 ve 8/8 kaçıran texel yok, histogram
    // 0,0,89,250,312,291,18,0,0). Delikli kabuktan atılan geniş açılı ışınlar
    // duran yarıya sürtüyor. Doğru ölçüt: en kalın texel 6 tavan ışınının
    // altına düşemez ve tavanı da geçemez.
    const maxRaw = Math.max(...raw);
    expect(maxRaw).toBeGreaterThan((6 / RAYS) * MAX_CHORD);
    expect(maxRaw).toBeLessThan(MAX_CHORD);
  });

  it("kaba kuvvet yolu (bvh = null) aynı kaçak sayısını veriyor", () => {
    const { positions, normals, filled } = texelsFromSurface(sphere);
    const args = {
      tris: half,
      positions,
      normals,
      filled,
      rays: RAYS,
      maxChord: MAX_CHORD,
    };
    const tree = traceThickness({ ...args, bvh: new Bvh(half, 4) });
    const brute = traceThickness({ ...args, bvh: null });

    expect(brute.escaped).toBe(tree.escaped);
    expect(Array.from(brute.raw)).toEqual(Array.from(tree.raw));
  });

  it("ıskalayan ışın Infinity değil tavanı döndürüyor — `t === Infinity` ölçütü ölü", () => {
    // Sayaç neden `>= maxChord` ile yazılmak zorunda: iki kesişim yolu da
    // `let best = tMax` ile başlıyor, ıskada tavan geri geliyor.
    const bvh = new Bvh(half, 4);
    let infinities = 0;
    let ceilings = 0;

    for (let i = 0; i < half.length / 9; i++) {
      const n: [number, number, number] = [
        sphere[i * 9],
        sphere[i * 9 + 1],
        sphere[i * 9 + 2],
      ];
      for (let r = 0; r < RAYS; r++) {
        const [dx, dy, dz] = cosineDirection(
          (r + 0.5) / RAYS,
          radicalInverse2(r),
          [-n[0], -n[1], -n[2]],
        );
        const ox = n[0] * (1 - 1e-4);
        const oy = n[1] * (1 - 1e-4);
        const oz = n[2] * (1 - 1e-4);
        const tree = bvh.intersect(ox, oy, oz, dx, dy, dz, MAX_CHORD);
        const brute = bruteForceIntersect(
          half,
          [ox, oy, oz],
          [dx, dy, dz],
          MAX_CHORD,
        );
        expect(tree).toBeCloseTo(brute, 12);
        if (tree === Infinity) infinities++;
        if (tree === MAX_CHORD) ceilings++;
      }
    }

    expect(infinities).toBe(0);
    expect(ceilings).toBeGreaterThan(0);
  });
});
