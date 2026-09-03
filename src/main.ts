import { createHud } from "./hud";
import { runMeasurement } from "./measure";
import type { MeasureBlock } from "./measure";
import type { MeshName } from "./mesh";
import { MODE_FULL } from "./modes";
import { DEFAULT_SCALE, createStage } from "./renderer";
import type { MapSize, MaterialKind, Stage } from "./renderer";

function need<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`DOM düğümü yok: ${selector}`);
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
    `Bu tarayıcıda WebGL2 bağlamı açılamadı, demo çalışamaz. (${String(error)})`,
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
    fail("WebGL bağlamı kayboldu. Sayfayı yenileyin.");
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
  toggleButton.textContent = running ? "Dur" : "Devam";
  if (running) {
    frameId = requestAnimationFrame(loop);
  } else {
    hud.setNote("Döngü duraklatıldı — sayaçlar donduruldu.");
    cancelAnimationFrame(frameId);
  }
}

toggleButton.addEventListener("click", () => setRunning(!running));

// src/main.ts (parça)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setRunning(false);
});

function tr(value: number, digits: number): string {
  return value.toFixed(digits).replace(".", ",");
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

  wrapOut.textContent = tr(0.5, 2);
  powerOut.textContent = tr(4, 1);
  distortionOut.textContent = tr(0.25, 2);
  absorptionOut.textContent = tr(3, 1);
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
    wrapOut.textContent = tr(value, 2);
  });
  powerInput.addEventListener("input", () => {
    const value = Number(powerInput.value);
    stage.setLobe({ power: value });
    powerOut.textContent = tr(value, 1);
  });
  distortionInput.addEventListener("input", () => {
    const value = Number(distortionInput.value);
    stage.setLobe({ distortion: value });
    distortionOut.textContent = tr(value, 2);
  });
  absorptionInput.addEventListener("input", () => {
    const value = Number(absorptionInput.value);
    stage.setLobe({ absorption: value });
    absorptionOut.textContent = tr(value, 1);
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
        hud.setNote(`${mesh} haritası yok — "npm run bake -- --mesh=${mesh}"`);
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
      hud.setNote("Deterministik ölçüm koşuyor… (sekmeyi ön planda tutun)");
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
    // Vite geliştirme sunucusu bulunmayan bir dosya için index.html döndürüyor;
    // o yüzden 404 kadar bayt sayısı uyuşmazlığı da "harita yok" demek.
    const mapProblem =
      message.includes("kalınlık haritası bulunamadı") ||
      message.includes("beklenen");
    fail(
      mapProblem
        ? `${message} — üç çözünürlüğü de pişirin: npm run bake:all`
        : message,
    );
    console.error(error);
  });
