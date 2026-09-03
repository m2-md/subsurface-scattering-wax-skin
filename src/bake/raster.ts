import type { Vec2 } from "../vec";

// src/bake/raster.ts
const EDGE = 1e-6; // texel merkezi kenarın tam üstündeyse elemeyelim

export function rasterizeTriangle(
  size: number,
  a: Vec2,
  b: Vec2,
  c: Vec2,
  emit: (texel: number, wa: number, wb: number, wc: number) => void,
): number {
  // Texel merkezi (x + 0.5, y + 0.5) noktasında; koordinatı yarım kaydırıyoruz.
  const ax = a[0] * size - 0.5;
  const ay = a[1] * size - 0.5;
  const bx = b[0] * size - 0.5;
  const by = b[1] * size - 0.5;
  const cx = c[0] * size - 0.5;
  const cy = c[1] * size - 0.5;

  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-12) return 0; // kutupta dejenere üçgenler var
  const inv = 1 / area;

  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));

  let written = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const wa = ((bx - x) * (cy - y) - (by - y) * (cx - x)) * inv;
      const wb = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) * inv;
      const wc = 1 - wa - wb;
      if (wa < -EDGE || wb < -EDGE || wc < -EDGE) continue;
      emit(y * size + x, wa, wb, wc);
      written++;
    }
  }
  return written;
}

export { EDGE };
