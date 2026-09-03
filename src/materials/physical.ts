import * as THREE from "three";

// src/materials/physical.ts
export function createPhysicalMaterial(
  thicknessRG: THREE.Texture | null,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffe6c4),
    roughness: 0.35,
    metalness: 0,
    ior: 1.45, // mum ~1,45
    transmission: 1, // ışık gövdeden geçsin
    thickness: 1.2, // dünya birimi
    attenuationColor: new THREE.Color(0xff7a3c), // içeride kızaran renk
    attenuationDistance: 0.6,
  });
  // three bu haritanın YEŞİL kanalını okur; R8 harita burada sıfır döner.
  material.thicknessMap = thicknessRG;
  return material;
}
