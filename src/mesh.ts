import * as THREE from "three";

/** GLSL'in `smoothstep`'i: uçlarda 0/1, arada Hermite yumuşatması. */
export function smoothstep(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

// src/mesh.ts (parça)
// LatheGeometry profili: x = eksene uzaklık, y = yükseklik.
// İlk ve son nokta x = 0 olmak ZORUNDA — yoksa gövde açık kalır.
export function candleProfile(steps = 48): THREE.Vector2[] {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -1)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -1 + 2 * t;
    const body = 0.52 + 0.22 * Math.sin(Math.PI * Math.min(t * 1.15, 1));
    const neck = 0.56 * smoothstep(0.68, 0.97, t); // tepede incelen rim
    points.push(new THREE.Vector2(Math.max(body - neck, 0.06), y));
  }
  points.push(new THREE.Vector2(0, 1));
  return points;
}

/**
 * İkinci mesh: dibi geniş, tepesi sivrilen bir damla. Mumdan farkı kalınlık
 * dağılımı — kenarı her yükseklikte ince, ortası kalın.
 */
export function blobProfile(steps = 48): THREE.Vector2[] {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -1)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -1 + 2 * t;
    const r = 0.8 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.25 * t);
    points.push(new THREE.Vector2(Math.max(r, 0.05), y));
  }
  points.push(new THREE.Vector2(0, 1));
  return points;
}

export type MeshName = "candle" | "blob";

export function profileFor(name: MeshName, steps = 48): THREE.Vector2[] {
  return name === "blob" ? blobProfile(steps) : candleProfile(steps);
}

/**
 * `LatheGeometry` UV'si birim kareyi baştan sona kaplar: u gövdenin etrafında,
 * v profil boyunca. Atlas paketleyiciye gerek bırakmayan tek sebep bu.
 */
export function buildLathe(
  profile: THREE.Vector2[],
  segments = 96,
): THREE.LatheGeometry {
  return new THREE.LatheGeometry(profile, segments);
}
