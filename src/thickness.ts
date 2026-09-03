import * as THREE from "three";

// src/thickness.ts
export async function loadThickness(
  url: string,
  size: number,
): Promise<THREE.DataTexture> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `kalınlık haritası bulunamadı: ${url} — önce "npm run bake"`,
    );
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length !== size * size) {
    throw new Error(`beklenen ${size * size} bayt, gelen ${data.length}`);
  }

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping; // u ekseni gövdenin etrafında dönüyor
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// src/thickness.ts (parça)
// three'nin thicknessMap'i .g okuyor; tek kanallı harita orada sıfır döner.
export function expandToRG(data: Uint8Array, size: number): THREE.DataTexture {
  const rg = new Uint8Array(size * size * 2);
  for (let i = 0; i < size * size; i++) {
    rg[i * 2] = data[i];
    rg[i * 2 + 1] = data[i];
  }
  const texture = new THREE.DataTexture(
    rg,
    size,
    size,
    THREE.RGFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export interface ThicknessMeta {
  mesh: string;
  resolution: number;
  rays: number;
  maxChordWorld: number;
  meanThicknessNormalized: number;
  triangles: number;
}

export interface ThicknessSet {
  size: number;
  bytes: Uint8Array;
  r8: THREE.DataTexture;
  rg8: THREE.DataTexture;
  meta: ThicknessMeta | null;
}

/** Bir çözünürlüğün iki temsilini birden kurar: R8 (elle yazılan shader) + RG8. */
export async function loadThicknessSet(
  mesh: string,
  size: number,
  base = "thickness",
): Promise<ThicknessSet> {
  const r8 = await loadThickness(`${base}/${mesh}-${size}.bin`, size);
  const bytes = r8.image.data as Uint8Array;
  const rg8 = expandToRG(bytes, size);
  let meta: ThicknessMeta | null = null;
  try {
    const response = await fetch(`${base}/${mesh}-${size}.json`);
    if (response.ok) meta = (await response.json()) as ThicknessMeta;
  } catch {
    meta = null;
  }
  return { size, bytes, r8, rg8, meta };
}
