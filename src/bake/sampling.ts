import type { Vec3 } from "../vec";

// src/bake/sampling.ts
export function radicalInverse2(index: number): number {
  let bits = index >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10; // 1 / 2^32
}

/** Hammersley: birinci bileşen düzgün ızgara, ikincisi ters ikili taban. */
export function hammersley(i: number, n: number): [number, number] {
  return [(i + 0.5) / n, radicalInverse2(i)];
}

// Duff ve arkadaşlarının dallanmayan ortonormal bazı: n'e dik iki vektör.
export function orthonormalBasis(n: Vec3): [Vec3, Vec3] {
  const sign = n[2] >= 0 ? 1 : -1;
  const a = -1 / (sign + n[2]);
  const b = n[0] * n[1] * a;
  return [
    [1 + sign * n[0] * n[0] * a, sign * b, -sign * n[0]],
    [b, sign + n[1] * n[1] * a, -n[1]],
  ];
}

// Kosinüs ağırlıklı yarım küre örneği: yüzeye yakın yönler daha seyrek.
export function cosineDirection(u1: number, u2: number, n: Vec3): Vec3 {
  const [t, bt] = orthonormalBasis(n);
  const r = Math.sqrt(u1);
  const phi = 2 * Math.PI * u2;
  const x = r * Math.cos(phi);
  const y = r * Math.sin(phi);
  const z = Math.sqrt(Math.max(0, 1 - u1));
  return [
    t[0] * x + bt[0] * y + n[0] * z,
    t[1] * x + bt[1] * y + n[1] * z,
    t[2] * x + bt[2] * y + n[2] * z,
  ];
}
