/** 4 komşu. Çapraz komşu almıyoruz: dilate köşeden değil kenardan yayılsın. */
export const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// src/bake/dilate.ts
// Dolu komşuların ortalamasını boş texel'e taşır. Kaç texel dolduğunu döndürür.
export function dilate(
  values: Float32Array,
  filled: Uint8Array,
  size: number,
  passes: number,
): number {
  let total = 0;
  for (let pass = 0; pass < passes; pass++) {
    const before = filled.slice();
    let touched = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (before[i] === 1) continue;
        let sum = 0;
        let count = 0;
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const j = ny * size + nx;
          if (before[j] !== 1) continue;
          sum += values[j];
          count++;
        }
        if (count === 0) continue;
        values[i] = sum / count;
        filled[i] = 1;
        touched++;
      }
    }
    total += touched;
    if (touched === 0) break;
  }
  return total;
}
