/**
 * IEEE 754 yarım kayan noktalı (16 bit) bir deseni sayıya çevirir.
 * `readRenderTargetPixels` `HalfFloatType` bir hedeften `Uint16Array` döndürür;
 * parlaklık ortalamasını almadan önce çözmek gerekiyor.
 */
export function halfToFloat(bits: number): number {
  const h = bits & 0xffff;
  const sign = (h & 0x8000) !== 0 ? -1 : 1;
  const exponent = (h & 0x7c00) >> 10;
  const mantissa = h & 0x03ff;

  if (exponent === 0) {
    // Subnormal: gizli bit yok, üs sabit 2^-14.
    return sign * mantissa * 2 ** -24;
  }
  if (exponent === 0x1f) {
    return mantissa === 0 ? sign * Infinity : Number.NaN;
  }
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
}

/** Tüm tamponu tek seferde çözer. */
export function halfArrayToFloat(bits: Uint16Array): Float32Array {
  const out = new Float32Array(bits.length);
  for (let i = 0; i < bits.length; i++) out[i] = halfToFloat(bits[i]);
  return out;
}
