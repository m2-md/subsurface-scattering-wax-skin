export const LUMA_R = 0.2126;
export const LUMA_G = 0.7152;
export const LUMA_B = 0.0722;

/** Rec.709 bağıl parlaklık. Girdi DOĞRUSAL olmalı; sRGB kodlu değil. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return LUMA_R * r + LUMA_G * g + LUMA_B * b;
}

/**
 * Maskeli ortalama. `values` RGBA sıralı doğrusal kare, `mask` piksel başına
 * bir bayt (0 = dışarıda). Maske boşsa 0 döner — NaN yaymak yerine sözleşme.
 */
export function maskedMean(values: Float32Array, mask: Uint8Array): number {
  const pixels = mask.length;
  if (values.length < pixels * 4) {
    throw new Error("kare tamponu maskeden küçük");
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
 * Mesh piksellerini kalınlığa göre iki kovaya ayırıp her kovada ortalama
 * parlaklığa bakar. Sınırlar KESİN eşitsizlik: `thinMax` ince kovaya,
 * `thickMin` kalın kovaya girmez.
 */
export function bucketMeans(
  lum: Float32Array,
  thickness: Float32Array,
  thinMax: number,
  thickMin: number,
): BucketMeans {
  if (lum.length !== thickness.length) {
    throw new Error("parlaklık ve kalınlık dizileri farklı boyutta");
  }
  let thinSum = 0;
  let thinCount = 0;
  let thickSum = 0;
  let thickCount = 0;
  for (let i = 0; i < lum.length; i++) {
    const t = thickness[i];
    if (Number.isNaN(t)) continue; // maske dışı
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
