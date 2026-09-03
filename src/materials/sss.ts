import * as THREE from "three";
import { MODE_FULL } from "../modes";
import { LIB } from "../shaderLib";
import fragSource from "../shaders/sss.frag.glsl?raw";
import vertSource from "../shaders/sss.vert.glsl?raw";

export const SSS_DEFAULTS = {
  albedo: 0xffe6c4,
  interiorColor: 0xff7a3c,
  lightColor: 0xffffff,
  wrap: 0.5,
  distortion: 0.25,
  power: 4.0,
  scale: 1.0,
  ambient: 0.05,
  absorption: 3.0,
  shininess: 48.0,
  specular: 0.25,
  constantThickness: 0.5,
} as const;

/**
 * `uLightDirection` yüzeyden IŞIĞA doğru bakan BİRİM vektördür.
 * Bu yazının en kolay hatası burada işaret kaçırmak.
 */
export function createSssMaterial(
  thicknessR: THREE.Texture | null,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertSource,
    fragmentShader: [LIB, fragSource].join("\n"),
    uniforms: {
      uThickness: { value: thicknessR },
      uAlbedo: { value: new THREE.Color(SSS_DEFAULTS.albedo) },
      uInteriorColor: { value: new THREE.Color(SSS_DEFAULTS.interiorColor) },
      uLightColor: { value: new THREE.Color(SSS_DEFAULTS.lightColor) },
      uLightDirection: { value: new THREE.Vector3(0, 0, 1) },
      uWrap: { value: SSS_DEFAULTS.wrap },
      uDistortion: { value: SSS_DEFAULTS.distortion },
      uPower: { value: SSS_DEFAULTS.power },
      uScale: { value: SSS_DEFAULTS.scale },
      uAmbient: { value: SSS_DEFAULTS.ambient },
      uAbsorption: { value: SSS_DEFAULTS.absorption },
      uShininess: { value: SSS_DEFAULTS.shininess },
      uSpecular: { value: SSS_DEFAULTS.specular },
      uConstantThickness: { value: SSS_DEFAULTS.constantThickness },
      uUseMap: { value: 1 },
      uMode: { value: MODE_FULL },
    },
  });
}
