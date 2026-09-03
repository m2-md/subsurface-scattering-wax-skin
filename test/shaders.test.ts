import { describe, expect, it } from "vitest";
import {
  MODE_FULL,
  MODE_THICKNESS,
  MODE_TRANSMISSION,
  MODE_WRAP,
} from "../src/modes";
import fullscreenVert from "../src/shaders/fullscreen.vert.glsl?raw";
import greenProbeFrag from "../src/shaders/greenprobe.frag.glsl?raw";
import lambertFrag from "../src/shaders/lambert.frag.glsl?raw";
import translucencyChunk from "../src/shaders/lib/translucency.glsl?raw";
import presentFrag from "../src/shaders/present.frag.glsl?raw";
import silhouetteFrag from "../src/shaders/silhouette.frag.glsl?raw";
import sssFrag from "../src/shaders/sss.frag.glsl?raw";
import sssVert from "../src/shaders/sss.vert.glsl?raw";

const SOURCES: ReadonlyArray<[string, string]> = [
  ["fullscreen.vert", fullscreenVert],
  ["greenprobe.frag", greenProbeFrag],
  ["lambert.frag", lambertFrag],
  ["lib/translucency", translucencyChunk],
  ["present.frag", presentFrag],
  ["silhouette.frag", silhouetteFrag],
  ["sss.frag", sssFrag],
  ["sss.vert", sssVert],
];

function outLocations(source: string): number[] {
  return [...source.matchAll(/layout\(location\s*=\s*(\d+)\)\s*out\s/g)].map(
    (m) => Number(m[1]),
  );
}

function constInt(source: string, name: string): number {
  const match = source.match(new RegExp(`const int ${name}\\s*=\\s*(\\d+)`));
  if (!match) throw new Error(`${name} bulunamadı`);
  return Number(match[1]);
}

describe("GLSL kaynakları", () => {
  it("hiçbir dosyada #version yok — three GLSL3 modunda kendisi ekliyor", () => {
    for (const [name, source] of SOURCES) {
      expect(source, name).not.toMatch(/#version/);
    }
  });

  it("hiçbir dosya precision bildirimi içermiyor (three ekliyor)", () => {
    for (const [name, source] of SOURCES) {
      expect(source, name).not.toMatch(/^\s*precision\s+/m);
    }
  });

  it("bütün fragment shader'ları tek eke yazar", () => {
    for (const source of [
      sssFrag,
      lambertFrag,
      silhouetteFrag,
      greenProbeFrag,
      presentFrag,
    ]) {
      expect(outLocations(source)).toEqual([0]);
    }
  });

  it("sss.frag MODE_* sabitleri src/modes.ts ile aynı sayılar", () => {
    expect(constInt(sssFrag, "MODE_FULL")).toBe(MODE_FULL);
    expect(constInt(sssFrag, "MODE_THICKNESS")).toBe(MODE_THICKNESS);
    expect(constInt(sssFrag, "MODE_TRANSMISSION")).toBe(MODE_TRANSMISSION);
    expect(constInt(sssFrag, "MODE_WRAP")).toBe(MODE_WRAP);
  });

  it("translucency chunk'ı wrapDiffuse formülünü aynen taşıyor", () => {
    expect(translucencyChunk).toMatch(
      /float wrapDiffuse\(float ndl, float wrap\)/,
    );
    expect(translucencyChunk).toMatch(/\(ndl \+ w\)/);
    expect(translucencyChunk).toMatch(/\(1\.0 \+ w\) \* \(1\.0 \+ w\)/);
  });

  it("backTranslucency lobun EKSİSİNİ ve Beer-Lambert'i içeriyor", () => {
    expect(translucencyChunk).toMatch(
      /normalize\(lightDir \+ normal \* distortion\)/,
    );
    expect(translucencyChunk).toMatch(/dot\(viewDir, -h\)/);
    expect(translucencyChunk).toMatch(/exp\(-absorption \* thickness\)/);
  });

  it("lambert.frag uThickness İÇERMEZ — doku baytı = 0 iddiası buna bağlı", () => {
    expect(lambertFrag).not.toMatch(/uThickness/);
    expect(lambertFrag).not.toMatch(/sampler2D/);
    expect(lambertFrag).toMatch(/max\(dot\(n, l\), 0\.0\)/);
  });

  it("sss.frag kırmızı kanaldan okur, yeşilden okumaz", () => {
    expect(sssFrag).toMatch(/texture\(uThickness, vUv\)\.r/);
    expect(sssFrag).not.toMatch(/texture\(uThickness, vUv\)\.g/);
  });

  it("sss.frag specular'ı ışık arkadayken kapatıyor", () => {
    expect(sssFrag).toMatch(/step\(0\.0, dot\(n, l\)\)/);
  });

  it("sss.frag sözleşmedeki bütün uniform'ları bildiriyor", () => {
    for (const name of [
      "uThickness",
      "uAlbedo",
      "uInteriorColor",
      "uLightColor",
      "uLightDirection",
      "uWrap",
      "uDistortion",
      "uPower",
      "uScale",
      "uAmbient",
      "uAbsorption",
      "uShininess",
      "uSpecular",
      "uConstantThickness",
      "uUseMap",
      "uMode",
    ]) {
      expect(sssFrag).toMatch(new RegExp(`uniform\\s+\\w+\\s+${name};`));
    }
  });

  it("sss.vert dünya uzayı normali üretir, normalMatrix kullanmaz", () => {
    expect(sssVert).toMatch(/mat3\(modelMatrix\) \* normal/);
    expect(sssVert).not.toMatch(/normalMatrix\s*\*/);
  });

  it("greenprobe hem .g hem .r okur", () => {
    expect(greenProbeFrag).toMatch(/texture\(uThickness, vUv\)\.g/);
    expect(greenProbeFrag).toMatch(/texture\(uThickness, vUv\)\.r/);
  });

  it("tam ekran vertex shader'ı projeksiyon matrisi kullanmaz", () => {
    expect(fullscreenVert).toMatch(/gl_Position\s*=\s*vec4\(position\.xy/);
    expect(fullscreenVert).not.toMatch(/projectionMatrix/);
  });

  it("present geçişi sRGB kodlamasını TEK yerde yapıyor", () => {
    expect(presentFrag).toMatch(/pow\(c, vec3\(1\.0 \/ 2\.2\)\)/);
    for (const source of [sssFrag, lambertFrag]) {
      expect(source).not.toMatch(/1\.0 \/ 2\.2/);
    }
  });

  it("silhouette geçişi düz beyaz yazar", () => {
    expect(silhouetteFrag).toMatch(/outColor = vec4\(1\.0\);/);
  });
});
