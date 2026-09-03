import * as THREE from "three";
import greenProbeSource from "../shaders/greenprobe.frag.glsl?raw";
import fragSource from "../shaders/lambert.frag.glsl?raw";
import silhouetteSource from "../shaders/silhouette.frag.glsl?raw";
import vertSource from "../shaders/sss.vert.glsl?raw";
import { SSS_DEFAULTS } from "./sss";

/** Aynı albedo, aynı specular, kalınlık yok, doku bağı yok. */
export function createLambertMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertSource,
    fragmentShader: fragSource,
    uniforms: {
      uAlbedo: { value: new THREE.Color(SSS_DEFAULTS.albedo) },
      uLightColor: { value: new THREE.Color(SSS_DEFAULTS.lightColor) },
      uLightDirection: { value: new THREE.Vector3(0, 0, 1) },
      uShininess: { value: SSS_DEFAULTS.shininess },
      uSpecular: { value: SSS_DEFAULTS.specular },
    },
  });
}

/** Maske geçişi materyali: mesh piksellerini beyaz boyar. */
export function createSilhouetteMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertSource,
    fragmentShader: silhouetteSource,
    uniforms: {},
  });
}

/** Yeşil kanal sondası: aynı UV'den `.g` ve `.r` yan yana okunur. */
export function createGreenProbeMaterial(
  texture: THREE.Texture | null,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertSource,
    fragmentShader: greenProbeSource,
    uniforms: { uThickness: { value: texture } },
  });
}
