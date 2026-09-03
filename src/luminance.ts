export const LUMA_R = 0.2126;
export const LUMA_G = 0.7152;
export const LUMA_B = 0.0722;

/** Rec.709 relative luminance. Input must be LINEAR, not sRGB-encoded. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return LUMA_R * r + LUMA_G * g + LUMA_B * b;
}

/**
 * Masked mean. `values` is a linear frame in RGBA order, `mask` one byte per
 * pixel (0 = outside). Empty mask returns 0 — a contract, not a spreading NaN.
 */
export function maskedMean(values: Float32Array, mask: Uint8Array): number {
  const pixels = mask.length;
  if (values.length < pixels * 4) {
    throw new Error("frame buffer smaller than mask");
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels; i++) {
    if (mask[i] === 0) continue;
    sum += relativeLuminance(
      values[i * 4],
      values[i * 4 + 1],
      values[i * 4 + 2],
    );
    count++;
  }
  return count === 0 ? 0 : sum / count;
}

export interface BucketMeans {
  thin: number | null;
  thick: number | null;
  thinPixels: number;
  thickPixels: number;
}

/**
 * Splits the mesh pixels into two buckets by thickness and looks at the mean
 * luminance in each bucket. The bounds are STRICT inequalities: `thinMax` does
 * not enter the thin bucket, `thickMin` does not enter the thick one.
 */
export function bucketMeans(
  lum: Float32Array,
  thickness: Float32Array,
  thinMax: number,
  thickMin: number,
): BucketMeans {
  if (lum.length !== thickness.length) {
    throw new Error("luminance and thickness arrays have different sizes");
  }
  let thinSum = 0;
  let thinCount = 0;
  let thickSum = 0;
  let thickCount = 0;
  for (let i = 0; i < lum.length; i++) {
    const t = thickness[i];
    if (Number.isNaN(t)) continue; // outside the mask
    if (t < thinMax) {
      thinSum += lum[i];
      thinCount++;
    } else if (t > thickMin) {
      thickSum += lum[i];
      thickCount++;
    }
  }
  return {
    thin: thinCount === 0 ? null : thinSum / thinCount,
    thick: thickCount === 0 ? null : thickSum / thickCount,
    thinPixels: thinCount,
    thickPixels: thickCount,
  };
}
