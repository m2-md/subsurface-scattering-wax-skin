import { createHud } from "./hud";
import { runMeasurement } from "./measure";
import type { MeasureBlock } from "./measure";
import type { MeshName } from "./mesh";
import { MODE_FULL } from "./modes";
import { DEFAULT_SCALE, createStage } from "./renderer";
import type { MapSize, MaterialKind, Stage } from "./renderer";

function need<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`no DOM node: ${selector}`);
  return el;
}

const canvas = need<HTMLCanvasElement>("#stage");
const hudRoot = need<HTMLElement>("#hud");
const banner = need<HTMLElement>("#banner");
const toggleButton = need<HTMLButtonElement>("#toggle");
const materialSelect = need<HTMLSelectElement>("#material");
const mapSelect = need<HTMLSelectElement>("#map");
const modeSelect = need<HTMLSelectElement>("#mode");
const azimuthInput = need<HTMLInputElement>("#azimuth");
const azimuthOut = need<HTMLElement>("#azimuth-out");
const elevationInput = need<HTMLInputElement>("#elevation");
const elevationOut = need<HTMLElement>("#elevation-out");
const wrapInput = need<HTMLInputElement>("#wrap");
const wrapOut = need<HTMLElement>("#wrap-out");
const powerInput = need<HTMLInputElement>("#power");
const powerOut = need<HTMLElement>("#power-out");
const distortionInput = need<HTMLInputElement>("#distortion");
const distortionOut = need<HTMLElement>("#distortion-out");
const absorptionInput = need<HTMLInputElement>("#absorption");
const absorptionOut = need<HTMLElement>("#absorption-out");
const meshSelect = need<HTMLSelectElement>("#mesh");
const scaleSelect = need<HTMLSelectElement>("#scale");

function fail(message: string): void {
  banner.hidden = false;
  banner.textContent = message;
}

let stage: Stage;
try {
  stage = createStage(canvas);
} catch (error) {
  canvas.remove();
  fail(
    `Could not open a WebGL2 context in this browser; the demo cannot run. (${String(error)})`,
  );
  throw error;
}

const hud = createHud(hudRoot);
hud.setTimerSource(stage.timer.available ? "gpu" : "raf");

canvas.addEventListener(
  "webglcontextlost",
  (event) => {
    event.preventDefault();
    setRunning(false);
    fail("The WebGL context was lost. Reload the page.");
    console.warn("webglcontextlost");
  },
  false,
);

let running = true;
let frameId = 0;

function loop(now: number) {
  frameId = requestAnimationFrame(loop);
  stage.render(now * 0.001);
  hud.update(stage.stats());
}

function setRunning(next: boolean): void {
  if (next === running) return;
  running = next;
  toggleButton.textContent = running ? "Pause" : "Resume";
  if (running) {
    frameId = requestAnimationFrame(loop);
  } else {
    hud.setNote("Loop paused — the counters are frozen.");
    cancelAnimationFrame(frameId);
  }
}

toggleButton.addEventListener("click", () => setRunning(!running));

// src/main.ts (excerpt)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setRunning(false);
});

function fmt(value: number, digits: number): string {
  return value.toFixed(digits);
}

function applyLight(): void {
  const azimuth = Number(azimuthInput.value);
  const elevation = Number(elevationInput.value);
  stage.setLight(azimuth, elevation);
  azimuthOut.textContent = `${azimuth}°`;
  elevationOut.textContent = `${elevation}°`;
}

function wireControls(): void {
  materialSelect.value = "sss";
  mapSelect.value = "256";
  modeSelect.value = String(MODE_FULL);
  azimuthInput.value = "178";
  elevationInput.value = "10";
  wrapInput.value = "0.5";
  powerInput.value = "4";
  distortionInput.value = "0.25";
  absorptionInput.value = "3";
  meshSelect.value = "candle";
  scaleSelect.value = String(DEFAULT_SCALE);

  wrapOut.textContent = fmt(0.5, 2);
  powerOut.textContent = fmt(4, 1);
  distortionOut.textContent = fmt(0.25, 2);
  absorptionOut.textContent = fmt(3, 1);
  applyLight();

  materialSelect.addEventListener("change", () => {
    stage.setMaterial(materialSelect.value as MaterialKind);
  });
  mapSelect.addEventListener("change", () => {
    const value = mapSelect.value;
    stage.setMapSize(value === "constant" ? null : (Number(value) as MapSize));
  });
  modeSelect.addEventListener("change", () => {
    stage.setMode(Number(modeSelect.value));
  });
  azimuthInput.addEventListener("input", applyLight);
  elevationInput.addEventListener("input", applyLight);
  wrapInput.addEventListener("input", () => {
    const value = Number(wrapInput.value);
    stage.setLobe({ wrap: value });
    wrapOut.textContent = fmt(value, 2);
  });
  powerInput.addEventListener("input", () => {
    const value = Number(powerInput.value);
    stage.setLobe({ power: value });
    powerOut.textContent = fmt(value, 1);
  });
  distortionInput.addEventListener("input", () => {
    const value = Number(distortionInput.value);
    stage.setLobe({ distortion: value });
    distortionOut.textContent = fmt(value, 2);
  });
  absorptionInput.addEventListener("input", () => {
    const value = Number(absorptionInput.value);
    stage.setLobe({ absorption: value });
    absorptionOut.textContent = fmt(value, 1);
  });
  meshSelect.addEventListener("change", () => {
    const mesh = meshSelect.value as MeshName;
    stage
      .loadMaps(mesh)
      .then(() => {
        stage.setMesh(mesh);
        hud.setNote(`Mesh: ${mesh}`);
      })
      .catch((error: unknown) => {
        meshSelect.value = "candle";
        hud.setNote(`no ${mesh} map — "npm run bake -- --mesh=${mesh}"`);
        console.warn(String(error));
      });
  });
  scaleSelect.addEventListener("change", () => {
    stage.setScale(Number(scaleSelect.value));
    stage.resize();
  });
}

function wireCamera(): void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    stage.orbit((event.clientX - lastX) * 0.35, (event.clientY - lastY) * 0.2);
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const stop = (event: PointerEvent) => {
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      stage.zoom(Math.sign(event.deltaY) * 0.25);
    },
    { passive: false },
  );
}

const params = new URLSearchParams(location.search);
const measureMode = params.get("measure") === "1";
const only = params.get("only") as MeasureBlock | null;

stage
  .loadMaps("candle")
  .then(() => {
    if (measureMode) {
      document.body.classList.add("measuring");
      toggleButton.disabled = true;
      hud.setNote("Deterministic measurement running… (keep the tab in front)");
      running = false;
      return runMeasurement(stage, only).then((report) => {
        console.log(`MEASURE ${JSON.stringify(report)}`);
        hud.showMeasureReport(report);
      });
    }
    wireControls();
    wireCamera();
    window.addEventListener("resize", () => stage.resize());
    stage.resize();
    frameId = requestAnimationFrame(loop);
    return undefined;
  })
  .catch((error: unknown) => {
    const message = String(error);
    // The Vite dev server returns index.html for a file that does not exist,
    // so a byte-count mismatch means "no map" just as much as a 404 does.
    const mapProblem =
      message.includes("thickness map not found") ||
      message.includes("expected");
    fail(
      mapProblem
        ? `${message} — bake all three resolutions: npm run bake:all`
        : message,
    );
    console.error(error);
  });
