import * as THREE from "three";

// src/materials/physical.ts
export function createPhysicalMaterial(
  thicknessRG: THREE.Texture | null,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffe6c4),
    roughness: 0.35,
    metalness: 0,
    ior: 1.45, // wax ~1.45
    transmission: 1, // let light pass through the body
    thickness: 1.2, // world units
    attenuationColor: new THREE.Color(0xff7a3c), // the color reddening inside
    attenuationDistance: 0.6,
  });
  // three reads this map's GREEN channel; an R8 map returns zero here.
  material.thicknessMap = thicknessRG;
  return material;
}
