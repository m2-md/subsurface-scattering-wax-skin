import { add, clamp, dot, normalize, scale } from "./vec";
import type { Vec3 } from "./vec";

/** `backTranslucency` lobunun parametreleri. GLSL tarafında ayrı uniform'lar. */
export interface LobeParams {
  distortion: number;
  power: number;
  scale: number;
  ambient: number;
  absorption: number;
}

/**
 * `src/shaders/lib/translucency.glsl` içindeki `wrapDiffuse`'un CPU ikizi.
 * Pay terminatörü kaydırır, payda toplam enerjiyi yerinde tutar.
 * wrap = 0 verildiğinde fonksiyon birebir Lambert'e döner.
 */
export function wrapDiffuse(ndl: number, wrap: number): number {
  const w = Math.max(wrap, 0);
  return clamp((ndl + w) / ((1 + w) * (1 + w)), 0, 1);
}

/**
 * `src/shaders/lib/translucency.glsl` içindeki `backTranslucency`'nin CPU ikizi.
 * lightDir: yüzeyden IŞIĞA doğru, birim. viewDir: yüzeyden KAMERAYA doğru, birim.
 * thickness: [0,1] aralığında normalize edilmiş yol uzunluğu (1 = en kalın).
 */
export function backTranslucency(
  lightDir: Vec3,
  normal: Vec3,
  viewDir: Vec3,
  thickness: number,
  params: LobeParams,
): number {
  // Işığı normal boyunca biraz bükerek "içeriden çıkıyormuş" hissi veriyoruz.
  const h = normalize(add(lightDir, scale(normal, params.distortion)));
  const lobe =
    Math.pow(clamp(dot(viewDir, [-h[0], -h[1], -h[2]]), 0, 1), params.power) *
    params.scale;
  // Beer-Lambert: yol uzadıkça geçen ışık üstel olarak azalır.
  return (lobe + params.ambient) * Math.exp(-params.absorption * thickness);
}
