import * as THREE from "three";
import { halfToFloat } from "./half";

export type ReadbackType = "half" | "float";

export const PROBE_WIDTH = 480;
export const PROBE_HEIGHT = 270;

/**
 * Sürücünün half float bir hedeften geri okuma yapıp yapamadığını 1×1 bir
 * hedefle bir kez yoklar. Sessizce sekiz bite düşmek YASAK: arkadan
 * aydınlatmada ölçmek istediğimiz fark sekiz bitte ölçüm biriminin altında
 * kalıyor, o yüzden yedek yol `FloatType`.
 */
export function detectReadbackType(
  renderer: THREE.WebGLRenderer,
): ReadbackType {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  try {
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, new Uint16Array(4));
    return "half";
  } catch {
    return "float";
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
  }
}

export interface LinearProbe {
  readonly type: ReadbackType;
  readonly target: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  setSize(width: number, height: number): void;
  /** DOĞRUSAL RGBA, half/float'tan çözülmüş. */
  read(renderer: THREE.WebGLRenderer): Float32Array;
  dispose(): void;
}

export function createLinearProbe(
  width: number,
  height: number,
  type: ReadbackType,
): LinearProbe {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: type === "half" ? THREE.HalfFloatType : THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
    colorSpace: THREE.NoColorSpace,
  });

  let raw: Uint16Array | Float32Array =
    type === "half"
      ? new Uint16Array(width * height * 4)
      : new Float32Array(width * height * 4);
  let out = new Float32Array(width * height * 4);

  return {
    type,
    target,
    width,
    height,
    setSize(w, h) {
      if (this.width === w && this.height === h) return;
      this.width = w;
      this.height = h;
      target.setSize(w, h);
      raw =
        type === "half"
          ? new Uint16Array(w * h * 4)
          : new Float32Array(w * h * 4);
      out = new Float32Array(w * h * 4);
    },
    read(renderer) {
      renderer.readRenderTargetPixels(
        target,
        0,
        0,
        this.width,
        this.height,
        raw,
      );
      if (type === "half") {
        const bits = raw as Uint16Array;
        for (let i = 0; i < out.length; i++) out[i] = halfToFloat(bits[i]);
      } else {
        out.set(raw as Float32Array);
      }
      return out;
    },
    dispose() {
      target.dispose();
    },
  };
}

export interface MaskProbe {
  readonly target: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  setSize(width: number, height: number): void;
  /** Piksel başına bir bayt: 1 = mesh. Eşik `> 0.5` (127). */
  read(renderer: THREE.WebGLRenderer): Uint8Array;
  dispose(): void;
}

export function createMaskProbe(width: number, height: number): MaskProbe {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
    colorSpace: THREE.NoColorSpace,
  });
  let pixels = new Uint8Array(width * height * 4);
  let mask = new Uint8Array(width * height);

  return {
    target,
    width,
    height,
    setSize(w, h) {
      if (this.width === w && this.height === h) return;
      this.width = w;
      this.height = h;
      target.setSize(w, h);
      pixels = new Uint8Array(w * h * 4);
      mask = new Uint8Array(w * h);
    },
    read(renderer) {
      renderer.readRenderTargetPixels(
        target,
        0,
        0,
        this.width,
        this.height,
        pixels,
      );
      for (let i = 0; i < mask.length; i++) {
        mask[i] = pixels[i * 4] > 127 ? 1 : 0;
      }
      return mask;
    },
    dispose() {
      target.dispose();
    },
  };
}
