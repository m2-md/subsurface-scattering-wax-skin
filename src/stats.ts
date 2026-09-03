export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(Math.max(p, 0), 100) / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/**
 * Per-channel RMS difference between two LINEAR RGBA frames. Alpha is IGNORED.
 * The inputs are `Float32Array`s decoded from half float.
 */
export function rmsDifference(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error("buffer sizes are not equal");
  const pixels = Math.floor(a.length / 4);
  let sum = 0;
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      const d = a[i * 4 + c] - b[i * 4 + c];
      sum += d * d;
    }
  }
  return pixels === 0 ? 0 : Math.sqrt(sum / (pixels * 3));
}
