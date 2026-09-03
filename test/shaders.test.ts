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
  if (!match) throw new Error(`${name} not found`);
  return Number(match[1]);
}

describe("GLSL sources", () => {
  it("no file has #version — three adds it itself in GLSL3 mode", () => {
    for (const [name, source] of SOURCES) {
      expect(source, name).not.toMatch(/#version/);
    }
  });

  it("no file contains a precision declaration (three adds it)", () => {
    for (const [name, source] of SOURCES) {
      expect(source, name).not.toMatch(/^\s*precision\s+/m);
    }
  });

  it("every fragment shader writes to a single attachment", () => {
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

  it("sss.frag MODE_* constants are the same numbers as src/modes.ts", () => {
    expect(constInt(sssFrag, "MODE_FULL")).toBe(MODE_FULL);
    expect(constInt(sssFrag, "MODE_THICKNESS")).toBe(MODE_THICKNESS);
    expect(constInt(sssFrag, "MODE_TRANSMISSION")).toBe(MODE_TRANSMISSION);
    expect(constInt(sssFrag, "MODE_WRAP")).toBe(MODE_WRAP);
  });

  it("the translucency chunk carries the wrapDiffuse formula verbatim", () => {
    expect(translucencyChunk).toMatch(
      /float wrapDiffuse\(float ndl, float wrap\)/,
    );
    expect(translucencyChunk).toMatch(/\(ndl \+ w\)/);
    expect(translucencyChunk).toMatch(/\(1\.0 \+ w\) \* \(1\.0 \+ w\)/);
  });

  it("backTranslucency contains the NEGATED lobe and Beer-Lambert", () => {
    expect(translucencyChunk).toMatch(
      /normalize\(lightDir \+ normal \* distortion\)/,
    );
    expect(translucencyChunk).toMatch(/dot\(viewDir, -h\)/);
    expect(translucencyChunk).toMatch(/exp\(-absorption \* thickness\)/);
  });

  it("lambert.frag has NO uThickness — the 0 texture bytes claim rests on it", () => {
    expect(lambertFrag).not.toMatch(/uThickness/);
    expect(lambertFrag).not.toMatch(/sampler2D/);
    expect(lambertFrag).toMatch(/max\(dot\(n, l\), 0\.0\)/);
  });

  it("sss.frag reads the red channel, not the green", () => {
    expect(sssFrag).toMatch(/texture\(uThickness, vUv\)\.r/);
    expect(sssFrag).not.toMatch(/texture\(uThickness, vUv\)\.g/);
  });

  it("sss.frag turns specular off when the light is behind", () => {
    expect(sssFrag).toMatch(/step\(0\.0, dot\(n, l\)\)/);
  });

  it("sss.frag declares every uniform in the contract", () => {
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

  it("sss.vert produces a world-space normal, does not use normalMatrix", () => {
    expect(sssVert).toMatch(/mat3\(modelMatrix\) \* normal/);
    expect(sssVert).not.toMatch(/normalMatrix\s*\*/);
  });

  it("greenprobe reads both .g and .r", () => {
    expect(greenProbeFrag).toMatch(/texture\(uThickness, vUv\)\.g/);
    expect(greenProbeFrag).toMatch(/texture\(uThickness, vUv\)\.r/);
  });

  it("the fullscreen vertex shader does not use a projection matrix", () => {
    expect(fullscreenVert).toMatch(/gl_Position\s*=\s*vec4\(position\.xy/);
    expect(fullscreenVert).not.toMatch(/projectionMatrix/);
  });

  it("the present pass does the sRGB encoding in ONE place", () => {
    expect(presentFrag).toMatch(/pow\(c, vec3\(1\.0 \/ 2\.2\)\)/);
    for (const source of [sssFrag, lambertFrag]) {
      expect(source).not.toMatch(/1\.0 \/ 2\.2/);
    }
  });

  it("the silhouette pass writes flat white", () => {
    expect(silhouetteFrag).toMatch(/outColor = vec4\(1\.0\);/);
  });
});
