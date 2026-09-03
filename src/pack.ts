/**
 * Texture bytes: NOT MEASURED, COMPUTED. We generate no mipmaps, so there is
 * no chain overhead — a single level, one byte per channel.
 */
export function textureBytes(size: number, channels: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`invalid texture size: ${size}`);
  }
  if (!Number.isInteger(channels) || channels <= 0) {
    throw new Error(`invalid channel count: ${channels}`);
  }
  return size * size * channels;
}

/**
 * Bytes of an RGBA8 target including its mipmap chain. The chain sum is a
 * geometric series: 1 + 1/4 + 1/16 + … → 4/3.
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
