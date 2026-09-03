import type { BufferGeometry } from "three";
import { rasterizeTriangle } from "./raster";
import type { Vec2 } from "../vec";

export interface BakedAttributes {
  /** World position per texel (3 floats). */
  positions: Float32Array;
  /** Unit normal per texel (3 floats). */
  normals: Float32Array;
  /** 1 = filled during rasterization. */
  filled: Uint8Array;
  /** How many texels filled (a texel from multiple triangles counts once). */
  rasterized: number;
}

/** 9 floats per triangle: BVH and brute force intersect expect this layout. */
export function trianglesFromGeometry(geometry: BufferGeometry): Float32Array {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const tris = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = index ? index.getX(i) : i;
    tris[i * 3] = position.getX(v);
    tris[i * 3 + 1] = position.getY(v);
    tris[i * 3 + 2] = position.getZ(v);
  }
  return tris;
}

/**
 * Rasterizes the mesh in UV space and interpolates, with barycentric weights,
 * the surface point and normal under each texel. NO flip on the Y axis:
 * because `THREE.DataTexture` defaults to `flipY = false`, the first row of the
 * array is `v = 0` on the GL side; the baker assumes the same.
 */
export function bakeAttributes(
  geometry: BufferGeometry,
  size: number,
): BakedAttributes {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;

  const texels = size * size;
  const positions = new Float32Array(texels * 3);
  const normals = new Float32Array(texels * 3);
  const filled = new Uint8Array(texels);

  const a: Vec2 = [0, 0];
  const b: Vec2 = [0, 0];
  const c: Vec2 = [0, 0];

  for (let t = 0; t < count; t += 3) {
    const i0 = index ? index.getX(t) : t;
    const i1 = index ? index.getX(t + 1) : t + 1;
    const i2 = index ? index.getX(t + 2) : t + 2;

    a[0] = uv.getX(i0);
    a[1] = uv.getY(i0);
    b[0] = uv.getX(i1);
    b[1] = uv.getY(i1);
    c[0] = uv.getX(i2);
    c[1] = uv.getY(i2);

    rasterizeTriangle(size, a, b, c, (texel, wa, wb, wc) => {
      positions[texel * 3] =
        position.getX(i0) * wa +
        position.getX(i1) * wb +
        position.getX(i2) * wc;
      positions[texel * 3 + 1] =
        position.getY(i0) * wa +
        position.getY(i1) * wb +
        position.getY(i2) * wc;
      positions[texel * 3 + 2] =
        position.getZ(i0) * wa +
        position.getZ(i1) * wb +
        position.getZ(i2) * wc;

      normals[texel * 3] =
        normal.getX(i0) * wa + normal.getX(i1) * wb + normal.getX(i2) * wc;
      normals[texel * 3 + 1] =
        normal.getY(i0) * wa + normal.getY(i1) * wb + normal.getY(i2) * wc;
      normals[texel * 3 + 2] =
        normal.getZ(i0) * wa + normal.getZ(i1) * wb + normal.getZ(i2) * wc;

      filled[texel] = 1;
    });
  }

  let rasterized = 0;
  for (let i = 0; i < texels; i++) {
    if (filled[i] !== 1) continue;
    rasterized++;
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-12) {
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    } else {
      // On pole triangles the interpolated normal can converge to zero.
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
    }
  }

  return { positions, normals, filled, rasterized };
}
