import * as THREE from "three";

/** GLSL's `smoothstep`: 0/1 at the ends, Hermite smoothing in between. */
export function smoothstep(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

// src/mesh.ts (excerpt)
// LatheGeometry profile: x = distance from the axis, y = height.
// The first and last point MUST have x = 0 — otherwise the body stays open.
export function candleProfile(steps = 48): THREE.Vector2[] {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -1)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -1 + 2 * t;
    const body = 0.52 + 0.22 * Math.sin(Math.PI * Math.min(t * 1.15, 1));
    const neck = 0.56 * smoothstep(0.68, 0.97, t); // rim thinning at the top
    points.push(new THREE.Vector2(Math.max(body - neck, 0.06), y));
  }
  points.push(new THREE.Vector2(0, 1));
  return points;
}

/**
 * Second mesh: a blob, wide at the bottom, tapering at the top. It differs from
 * the candle in thickness distribution — thin edge at every height, thick core.
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
 * The `LatheGeometry` UV covers the unit square end to end: u around the body,
 * v along the profile. That is the only reason we need no atlas packer.
 */
export function buildLathe(
  profile: THREE.Vector2[],
  segments = 96,
): THREE.LatheGeometry {
  return new THREE.LatheGeometry(profile, segments);
}
