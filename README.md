# Subsurface scattering — wax and skin (wrap + transmission + baked thickness map)

Working code for the article "Material That Light Passes Through: Real-Time
Subsurface Scattering for Wax and Skin". `three@0.185.1` + `WebGLRenderer` + raw
GLSL ES 3.00 (`ShaderMaterial` + `glslVersion: THREE.GLSL3`), TypeScript, Vite,
vitest. The bake is a Node CLI that runs under `vite-node`.

All of the scattering math is hand-written; three is the scene graph and the GL
state machine here. **The one exception is the control group:** the
`MeshPhysicalMaterial` `transmission` path is deliberately used off the shelf,
because that is the thing we are measuring.

No texture files (PNG/JPG): the bake produces raw `.bin` + a meta JSON, and the
browser loads it with `DataTexture`. Zero image dependencies.

The same scene is drawn with three materials and measured side by side on the
GPU clock:

| Material   | What it does                                                                 |
| ---------- | ---------------------------------------------------------------------------- |
| `lambert`  | Plain baseline. `max(dot(n, l), 0)` + specular. NO thickness read            |
| `sss`      | Hand-written wrap lighting + view-dependent transmission lobe + R8 map       |
| `physical` | three's `MeshPhysicalMaterial` `transmission` path + RG8 thickness map       |

## What is in here

- **Pure logic layer** — knows nothing about the browser, tested with `vitest`:
  `src/translucency.ts` (the CPU twin of the GLSL), `src/bake/raster.ts`,
  `src/bake/dilate.ts`, `src/bake/sampling.ts`, `src/bake/intersect.ts`,
  `src/bake/bvh.ts`, `src/mesh.ts`, `src/pack.ts`, `src/half.ts`,
  `src/luminance.ts`, `src/stats.ts`, `src/viewport.ts`.
- **Offline bake** (`tools/bake-thickness.ts`) — rasterization in UV space,
  position/normal per texel, cosine-weighted Hammersley rays over the `-N`
  hemisphere, Möller-Trumbore intersection with a BVH, dilate, normalization,
  `.bin` + meta JSON. NO `Math.random`: bit-identical output from run to run.
- **Hand-written SSS material** (`src/shaders/sss.frag.glsl` +
  `src/shaders/lib/translucency.glsl`) — `wrapDiffuse` and `backTranslucency`.
  Four modes: full / thickness / transmission / wrap.
- **Control group** (`src/materials/physical.ts`) — `transmission: 1`, with
  `thicknessMap` bound to the RG8 copy.
- **Linear pipeline** — everything draws into a `HalfFloatType` intermediate
  target, and sRGB encoding happens only in the `present.frag.glsl` pass. The
  luminance measurement is taken from the intermediate target, BEFORE present.
- **GPU clock** (`src/timer.ts`) — `EXT_disjoint_timer_query_webgl2`, a query
  queue, a `GPU_DISJOINT_EXT` check. If the extension is missing the output says
  so explicitly (`timerExt: false`) and frame time is reported instead of GPU ms.
- **Deterministic measurement mode** (`src/measure.ts`) — `?measure=1`.

## Setup

```bash
npm install
```

## Tests (no browser, deterministic)

```bash
npm test
```

**139 tests green** (15 files):

| File                        | What it checks                                                              | Tests |
| --------------------------- | --------------------------------------------------------------------------- | ---- |
| `test/translucency.test.ts` | wrap identity (`w = 0` → Lambert), terminator position, `1/(1+w)` peak, lobe | 12   |
| `test/sampling.test.ts`     | first 8 values of `radicalInverse2`, Hammersley, orthonormal basis (poles too) | 9   |
| `test/intersect.test.ts`    | double-sided Möller-Trumbore, the `1e-5` threshold, degenerate triangle, brute force | 11 |
| `test/bvh.test.ts`          | 12-digit equivalence with brute force, axis-aligned / near-parallel ray, `leafSize` | 15 |
| `test/trace.test.ts`        | escaped-ray counter: 0 on a closed body, > 0 on a mesh with a hole, BVH ≡ brute force | 4 |
| `test/raster.test.ts`       | texel count proportional to area, barycentrics sum to 1, half-texel offset  | 7    |
| `test/dilate.test.ts`       | bleed in a single pass without a copy (regression), ring expansion          | 9    |
| `test/mesh.test.ts`         | first/last point of the profiles at `x = 0`, monotonicity, `smoothstep`     | 11   |
| `test/pack.test.ts`         | `textureBytes` for known sizes, 4/3 mipmap chain                            | 6    |
| `test/half.test.ts`         | `halfToFloat` on known patterns, subnormal, ±Infinity, NaN                  | 6    |
| `test/luminance.test.ts`    | Rec.709 coefficients, masked mean, bucket edges (STRICT inequality)         | 11   |
| `test/viewport.test.ts`     | dpr/scale clamps, pixel budget                                              | 8    |
| `test/stats.test.ts`        | median/percentile edge cases, RMS, alpha ignored                            | 13   |
| `test/shaders.test.ts`      | the real `?raw` sources: no `#version`, MODE parity, `.r` vs `.g`           | 15   |
| `test/parity.test.ts`       | the GLSL ↔ TS twin matching an analytic re-derivation                       | 2    |

No test file references `document`, `window`, `navigator`,
`WebGL2RenderingContext` or `performance`; `three` is not imported either.

## Bake

The thickness maps **ship baked in the repo** (`public/thickness/`), so the demo
opens without running `npm run bake`. To bake them yourself:

```bash
npm run bake -- --mesh=candle --res=256 --rays=32
# BAKE {"mesh":"candle","triangles":9600,"resolution":256,...}
```

Flags: `--mesh=candle|blob`, `--res=<int>` (256), `--rays=<int>` (32),
`--bvh=on|off` (on), `--dilate=<int>` (4), `--out=<dir>` (`public/thickness`).

To run all seven at once and append each line to `measurements-<date>.jsonl`:

```bash
npm run bake:all
```

**Determinism check** (no `Math.random`, Hammersley instead):

```bash
npm run bake -- --mesh=candle --res=256 --rays=32 | grep -o '"sha256":"[^"]*"'
shasum -a 256 public/thickness/candle-256.bin
# the exact same digest across two runs
```

`candle-256.bin` is exactly **65536 bytes** (256 × 256 × 1). The meta JSON sits
next to it.

### The commands that feed the bake (one-to-one with the article's tables)

| Command                                                                       | Which table it feeds                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `npm run bake -- --mesh=candle --res=128 --rays=32`                           | Bake table, 128² row                              |
| `npm run bake -- --mesh=candle --res=256 --rays=32`                           | 256² row + the coverage/dilate/escaped-ray claims |
| `npm run bake -- --mesh=candle --res=512 --rays=32`                           | 512² row + the demo's reference map               |
| `npm run bake -- --mesh=candle --res=256 --rays=16 --out=.bake-sweep`         | Ray-count sentence (low end)                      |
| `npm run bake -- --mesh=candle --res=256 --rays=64 --out=.bake-sweep`         | Ray-count sentence (high end)                     |
| `npm run bake -- --mesh=candle --res=64 --rays=8 --bvh=off --out=.bake-sweep` | BVH table, brute-force row                        |
| `npm run bake -- --mesh=candle --res=64 --rays=8 --out=.bake-sweep`           | BVH table, tree row                               |

The sweep runs take `--out=.bake-sweep`, because they would otherwise write to
the same `--res=256` filename and overwrite the rays=32 map the demo uses.
`.bake-sweep/` is in `.gitignore`.

## Demo

```bash
npm run dev
# http://localhost:5173/
```

Do not open it with `file://`: Vite's `?raw` import and the `public/` path will
not work, and you get a blank screen.

Controls: material, thickness source (128²/256²/512²/constant), mode, light
azimuth/elevation, `wrap`, `power`, `distortion`, `absorption`, mesh, resolution
scale, Pause/Resume. Camera orbits with the mouse, distance with the wheel.

The HUD cells are split into two groups: **MEASURED** (FPS, frame ms, GPU ms,
draw call, triangles) is read from the hardware; **STRUCTURAL** (material, map
size, mode, light azimuth, backbuffer) is your own choice.

### The sign convention (one sentence)

`uLightDirection` is the unit vector pointing from the surface **TOWARD THE
LIGHT**. Getting that sign wrong is the easiest mistake in this whole piece.

### The thickness map convention

The value stored in the texture is **the length of the path**. **White = thick =
light has a hard time getting through. Black = thin = light passes easily.** You
can see it bare with Mode = Thickness.

### Guardrails

`devicePixelRatio` counts as 2 at most, the resolution scale starts at 0.75, and
the total pixel count cannot exceed 1,200,000 (`src/viewport.ts`). When the tab
is hidden the loop stops by itself (`visibilitychange`) — frame times collected
in a hidden tab mean nothing.

## Deterministic measurement — `?measure=1`

In measurement mode the demo drops interactive mode entirely: the backbuffer is
locked to 960×540, the camera and the light sit at fixed poses, and for each
configuration 30 warm-up frames are thrown away and 180 frames are weighed. The
result lands in the console as a **single line**, `MEASURE {json}`.

### Measurement URLs

| URL                                               | What it does                                        |
| ------------------------------------------------- | --------------------------------------------------- |
| `http://localhost:5173/?measure=1`                | **The main run.** All of blocks A–G, one JSON line   |
| `http://localhost:5173/?measure=1&only=materials` | The three material blocks only                      |
| `http://localhost:5173/?measure=1&only=luminance` | Two poses + thickness buckets only                  |
| `http://localhost:5173/?measure=1&only=maps`      | Map resolution + constant thickness only            |
| `http://localhost:5173/?measure=1&only=lobe`      | The power/distortion sweep only                     |
| `http://localhost:5173/?measure=1&only=channel`   | The green-channel probe only                        |
| `http://localhost:5173/`                          | Normal demo (no measurement)                        |

The `only=` sub-runs print the same schema, with unrelated fields left `null`.
The main run takes ~90 seconds on this machine; keep the tab in the foreground.

Precondition: `public/thickness/candle-128.bin`, `-256.bin` and `-512.bin` must
all be present. Without them the demo does not give you a silent white screen —
it opens a red banner telling you to run `npm run bake:all`.

### Raw runs

Every `MEASURE` and every `BAKE` line is written to `measurements-<date>.jsonl`
as `{"kind": "measure"|"bake", "run": N, ...}`. `npm run bake:all` appends its
own lines automatically; browser runs are appended by hand. At least three runs
are taken; the numbers from the representative run go into the article.

After the BVH's near-axis-aligned-ray fix, ten bake runs were repeated
(`measurements-2026-09-02.jsonl`); the maps under `public/thickness/` came out
byte for byte identical, meaning the fix does not change the published output.

To account for cold-compile effects, `?measure=1` runs are repeated back to back
**in the same tab**; the first run is assumed to have warmed the driver cache.

### Self-consistency (the noise band)

The `power = 4` row of the lobe sweep and the 256² row of the map-resolution
sweep measure the same configuration; the difference between them is the noise
of the rig, not of the technique. To compute it from the raw log:

```bash
node tools/self-consistency.mjs measurements-2026-08-13.jsonl
# per-run |d|/avg: min 9.3% · median 16.4% · max 61.6%
# |d|/avg over the published medians (0.4532 vs 0.3618): 22.4%
```

That band is wider than the difference we are looking for in the lobe
parameters — this number is what backs the article's "I could not measure the
effect of `power`" sentence.

### What is measured, what is computed

- **Measured:** `gpuMsMedian`, `gpuMsP95`, `wallMsMedian`, `drawCalls`,
  `triangles`, `programs`, `luminance.*`, `buckets.*`, `rmsVsRef`,
  `greenChannel.*`, `maskPixels`.
- **Computed:** `textureBytes`, `vramBytes`, `transmissionTargetBytes`.
  `transmissionTargetBytes` is not a made-up formula: the real size of the
  transmission target is read from three's `transmissionSamplerSize` uniform
  (`renderer.properties.get(material).uniforms`), and the mipmap chain is
  computed on top of that. If it cannot be read, the field stays `null`.

### Half-float readback

The luminance mean is taken from a `HalfFloatType` target, not an eight-bit one:
under back lighting Lambert's mean is so close to zero that in eight bits the
difference falls below the unit of measurement. If the driver refuses readback
from a half-float target, it falls back to `FloatType` and the output records
`"readbackType": "float"`. There is no silent drop to 8 bits.

### What the constant-thickness measurement actually measures

When `uUseMap = 0`, `uThickness` **is still bound** — one program, one variant,
no `defines`. So the constant-thickness row does not measure only the cost of
the texture read; it measures the difference between "texture read + branch" and
"uniform read".

## Verification debts

### 1. `three@0.185.1` and `@types/three`

`0.185.1` is in the output of `npm view three versions`; `@types/three@0.185.4`
is the closest exactly matching version and `npm run build` (`tsc`) passes
clean. No escape hatch like `declare module "three"` was used.

### 2. The GREEN channel of `thicknessMap`

The claim was verified by eye:

```
node_modules/three/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js:18
    material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
```

(Lines 16–20, inside the `#ifdef USE_THICKNESSMAP` block.) The measurement says
the same thing: in the `?measure=1&only=channel` run, the green channel of the
R8 texture on mesh pixels gives `r8MeanOnMesh = 0` and `r8MaxOnMesh = 0`; on the
RG8 copy of the same data, `rg8MeanOnMesh ≈ 0.945`. That is why
`src/thickness.ts` derives an RG8 copy at load time (twice the bytes) while the
bake still produces a single file.

**To try the visual counterpart** (there is no permanent switch in the code):
in the `applyMaps()` function inside `src/renderer.ts`, temporarily change the
line `physicalMaterial.thicknessMap = rg;` to
`= (set ?? fallback)?.r8 ?? null;`. The material turns into clear glass —
because `thicknessFactor` gets multiplied by zero, volume absorption shuts off
completely.

## Known limits

- **The escaped-ray rate is not zero.** `measurements-2026-09-02.jsonl`: candle
  6 / 17 / 79 (128² / 256² / 512²), blob 5 / 2,546 / 8,639 — that is 0.0011% /
  0.0008% / 0.0009% and 0.0010% / 0.1214% / 0.1030%. Rate = `escapedRays /
  (texelsRasterized × rays)`. The cause is not a hole in the mesh but two
  numerical thresholds: (1) a ray that starts on the lathe's seam meridian
  (`u = 0` and `u = 0.5`) and travels in that same plane hits the shared edge of
  two neighboring triangles exactly, and gets rejected because `u` comes out
  between `-3.1e-15` and `-1.8e-16` on both of them (watertightness); (2) on the
  blob's widest ring (`v ≈ 0.0215`) the exit intersection is real but `t` is
  between `2.9e-6` and `1e-5`, i.e. below `intersectTriangle`'s `t > 1e-5`
  self-hit threshold — 2,530 of the 2,546 escapes in blob 256² come from that
  row. The two mechanisms explain all 2,552 escapes of candle 128² +
  blob 256² (2,530 + 22). The BVH has no part in it: the `--bvh=off` brute-force
  run gives the same count and the same `sha256`. The counter used to look at
  `t === Infinity`, and since the miss path returns the ceiling rather than
  `Infinity`, it always wrote 0; the criterion was fixed to `t >= maxChord`.
  That fix changed the counter only: in both logs the maps' `sha256` and
  `meanThicknessNormalized` are identical, and the only field that moved is
  `escapedRays`.
- **Coverage is 100%, dilate is 0 texels.** `LatheGeometry`'s UV covers the unit
  square end to end with no overlapping islands; no atlas packer is needed. On a
  real scanned model this is not the case — that number is a consequence of the
  choice, not a merit of the technique. `dilate` is in the pipeline anyway, and
  it has tests.
- **The lobe sweep stays under the noise band.** In the `power` and `distortion`
  sweep the measured GPU medians move by ±0.3 ms from run to run; the real
  difference between them (if any) is below that band. Instead of reading the
  table as "there is no difference", read it as "it could not be measured on
  this rig".
- **The thickness map is a photograph of the moment it was baked.** If the mesh
  deforms, the map keeps describing the old body, and no error message shows up.

## File layout

```
src/
  bake/       attributes.ts · bvh.ts · dilate.ts · intersect.ts · raster.ts · sampling.ts
              trace.ts
  materials/  lambert.ts · physical.ts · sss.ts
  shaders/    fullscreen.vert · greenprobe.frag · lambert.frag · present.frag
              silhouette.frag · sss.frag · sss.vert · lib/translucency.glsl
  half.ts · hud.ts · luminance.ts · main.ts · measure.ts · mesh.ts · modes.ts
  pack.ts · probe.ts · renderer.ts · scene.ts · shaderLib.ts · stats.ts
  thickness.ts · timer.ts · translucency.ts · vec.ts · viewport.ts
tools/        bake-thickness.ts · bake-all.mjs · self-consistency.mjs
public/thickness/  candle-{128,256,512}.bin + .json · blob-{128,256,512}.bin + .json
test/         15 files + geometry.ts (test helper)
```

## License

MIT — `LICENSE`.
