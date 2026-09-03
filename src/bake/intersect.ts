import type { Vec3 } from "../vec";

// src/bake/intersect.ts
// Üçgenler 9'ar float hâlinde düz bir dizide duruyor; i, üçgenin başlangıç indeksi.
// Dönüş: kesişim mesafesi ya da Infinity. Çift yönlü — det'in işaretine bakmıyoruz.
export function intersectTriangle(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tris: Float32Array,
  i: number,
): number {
  const ax = tris[i],
    ay = tris[i + 1],
    az = tris[i + 2];
  const e1x = tris[i + 3] - ax,
    e1y = tris[i + 4] - ay,
    e1z = tris[i + 5] - az;
  const e2x = tris[i + 6] - ax,
    e2y = tris[i + 7] - ay,
    e2z = tris[i + 8] - az;

  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity; // ışın üçgenin düzlemine paralel

  const inv = 1 / det;
  const tx = ox - ax,
    ty = oy - ay,
    tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;

  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;

  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-5 ? t : Infinity; // arkamızdaki ve ayağımızın dibindeki kesişim sayılmaz
}

/** BVH eşdeğerlik testinin karşı tarafı: her üçgeni tek tek dene. */
export function bruteForceIntersect(
  tris: Float32Array,
  origin: Vec3,
  dir: Vec3,
  tMax: number,
): number {
  let best = tMax;
  for (let i = 0; i < tris.length; i += 9) {
    const t = intersectTriangle(
      origin[0],
      origin[1],
      origin[2],
      dir[0],
      dir[1],
      dir[2],
      tris,
      i,
    );
    if (t < best) best = t;
  }
  return best;
}
