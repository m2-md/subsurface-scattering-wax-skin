/**
 * Doku baytı: ÖLÇÜLMEZ, HESAPLANIR. Mipmap üretmiyoruz, o yüzden zincir payı
 * yok — tek seviye, kanal başına bir bayt.
 */
export function textureBytes(size: number, channels: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`geçersiz doku boyutu: ${size}`);
  }
  if (!Number.isInteger(channels) || channels <= 0) {
    throw new Error(`geçersiz kanal sayısı: ${channels}`);
  }
  return size * size * channels;
}

/**
 * Mipmap zinciriyle birlikte bir RGBA8 hedefin baytı. Zincir toplamı
 * geometrik seri: 1 + 1/4 + 1/16 + … → 4/3.
 */
export function mipChainBytes(
  width: number,
  height: number,
  bytesPerPixel = 4,
): number {
  let total = 0;
  let w = width;
  let h = height;
  while (w >= 1 && h >= 1) {
    total += w * h * bytesPerPixel;
    if (w === 1 && h === 1) break;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  return total;
}
