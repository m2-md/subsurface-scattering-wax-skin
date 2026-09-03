import type { Vec3 } from "../src/vec";

/** Deterministic geometry generators for the tests. `three` is NOT used. */

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/** Icosahedron projected onto the unit sphere. No seed, same every run. */
export function icosphereTriangles(subdivisions = 1): Float32Array {
  const t = (1 + Math.sqrt(5)) / 2;
  const base: Vec3[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map((v) => normalize(v as Vec3));

  const faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  let tris: [Vec3, Vec3, Vec3][] = faces.map(([a, b, c]) => [
    base[a],
    base[b],
    base[c],
  ]);

  for (let step = 0; step < subdivisions; step++) {
    const next: [Vec3, Vec3, Vec3][] = [];
    for (const [a, b, c] of tris) {
      const ab = normalize(midpoint(a, b));
      const bc = normalize(midpoint(b, c));
      const ca = normalize(midpoint(c, a));
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }

  const out = new Float32Array(tris.length * 9);
  tris.forEach(([a, b, c], i) => {
    out.set([...a, ...b, ...c], i * 9);
  });
  return out;
}

/** Cube centred at the origin; `half` is the half edge length. 12 triangles. */
export function boxTriangles(half = 1): Float32Array {
  const v: Vec3[] = [
    [-half, -half, -half],
    [half, -half, -half],
    [half, half, -half],
    [-half, half, -half],
    [-half, -half, half],
    [half, -half, half],
    [half, half, half],
    [-half, half, half],
  ];
  const quads: [number, number, number, number][] = [
    [0, 1, 2, 3],
    [5, 4, 7, 6],
    [4, 0, 3, 7],
    [1, 5, 6, 2],
    [4, 5, 1, 0],
    [3, 2, 6, 7],
  ];
  const out = new Float32Array(quads.length * 2 * 9);
  quads.forEach(([a, b, c, d], i) => {
    out.set([...v[a], ...v[b], ...v[c]], i * 18);
    out.set([...v[a], ...v[c], ...v[d]], i * 18 + 9);
  });
  return out;
}
