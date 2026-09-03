import { add, clamp, dot, normalize, scale } from "./vec";
import type { Vec3 } from "./vec";

/** Parameters of the `backTranslucency` lobe. Separate uniforms in GLSL. */
export interface LobeParams {
  distortion: number;
  power: number;
  scale: number;
  ambient: number;
  absorption: number;
}

/**
 * CPU twin of `wrapDiffuse` in `src/shaders/lib/translucency.glsl`.
 * The numerator shifts the terminator, the denominator keeps total energy put.
 * Given wrap = 0 the function collapses exactly to Lambert.
 */
export function wrapDiffuse(ndl: number, wrap: number): number {
  const w = Math.max(wrap, 0);
  return clamp((ndl + w) / ((1 + w) * (1 + w)), 0, 1);
}

/**
 * CPU twin of `backTranslucency` in `src/shaders/lib/translucency.glsl`.
 * lightDir: from surface to LIGHT, unit. viewDir: from surface to CAMERA, unit.
 * thickness: path length normalized to [0,1] (1 = thickest).
 */
export function backTranslucency(
  lightDir: Vec3,
  normal: Vec3,
  viewDir: Vec3,
  thickness: number,
  params: LobeParams,
): number {
  // We bend the light a bit along the normal for an "it comes from inside" feel.
  const h = normalize(add(lightDir, scale(normal, params.distortion)));
  const lobe =
    Math.pow(clamp(dot(viewDir, [-h[0], -h[1], -h[2]]), 0, 1), params.power) *
    params.scale;
  // Beer-Lambert: as the path grows, transmitted light falls off exponentially.
  return (lobe + params.ambient) * Math.exp(-params.absorption * thickness);
}
