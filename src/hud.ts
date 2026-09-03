import type { MeasureReport } from "./measure";
import { MODE_LABELS } from "./modes";
import type { StageStats } from "./renderer";

export interface Hud {
  update(stats: StageStats): void;
  setTimerSource(source: "gpu" | "raf"): void;
  setNote(text: string): void;
  showMeasureReport(report: MeasureReport): void;
}

/** MEASURED: values read from the hardware/clock every frame. */
const MEASURED = [
  ["fps", "FPS"],
  ["frame", "frame ms"],
  ["gpu", "GPU ms"],
  ["calls", "draw call"],
  ["tris", "triangles"],
] as const;

/** STRUCTURAL: settings the user picks; these are not measured. */
const STRUCTURAL = [
  ["material", "material"],
  ["map", "thickness"],
  ["mode", "mode"],
  ["azimuth", "light azimuth"],
  ["size", "backbuffer"],
] as const;

const MATERIAL_LABEL: Record<string, string> = {
  lambert: "Lambert",
  sss: "SSS (hand)",
  physical: "Physical",
};

function group(title: string, kind: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "hud-group";
  const head = document.createElement("div");
  head.className = "hud-group-title";
  head.textContent = title;
  const tag = document.createElement("span");
  tag.className = "hud-tag";
  tag.textContent = kind;
  head.appendChild(tag);
  box.appendChild(head);
  return box;
}

function row(parent: HTMLElement, label: string): HTMLElement {
  const line = document.createElement("div");
  line.className = "hud-row";
  const name = document.createElement("span");
  name.className = "hud-label";
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "hud-value";
  value.textContent = "—";
  line.append(name, value);
  parent.appendChild(line);
  return value;
}

export function createHud(root: HTMLElement): Hud {
  root.textContent = "";
  const cells = new Map<string, HTMLElement>();

  const measured = group("Measured", "MEASURED");
  for (const [key, label] of MEASURED) cells.set(key, row(measured, label));

  const structural = group("Configuration", "STRUCTURAL");
  for (const [key, label] of STRUCTURAL) cells.set(key, row(structural, label));

  const note = document.createElement("div");
  note.className = "hud-note";
  note.textContent = "GPU clock: probing…";

  root.append(measured, structural, note);

  let timerSource: "gpu" | "raf" = "raf";
  const set = (key: string, text: string) => {
    const cell = cells.get(key);
    if (cell) cell.textContent = text;
  };

  return {
    update(stats) {
      set("fps", stats.fps.toFixed(0));
      set("frame", `${stats.frameMs.toFixed(2)} ms`);
      set(
        "gpu",
        timerSource === "gpu"
          ? stats.gpuMs === null
            ? "…"
            : `${stats.gpuMs.toFixed(3)} ms`
          : `${stats.frameMs.toFixed(2)} ms (rAF)`,
      );
      set("calls", String(stats.drawCalls));
      set("tris", stats.triangles.toLocaleString("en-US"));
      set("material", MATERIAL_LABEL[stats.material] ?? stats.material);
      set("map", stats.mapSize === null ? "constant 0.5" : `${stats.mapSize}²`);
      set("mode", MODE_LABELS[stats.mode] ?? String(stats.mode));
      set("azimuth", `${stats.lightAzimuthDeg.toFixed(0)}°`);
      set("size", `${stats.width}×${stats.height}`);
    },

    setTimerSource(source) {
      timerSource = source;
      note.textContent =
        source === "gpu"
          ? "GPU clock: EXT_disjoint_timer_query_webgl2"
          : "GPU clock: no extension → reporting frame time (rAF)";
    },

    setNote(text) {
      note.textContent = text;
    },

    showMeasureReport(report) {
      const unit = report.timerExt ? "GPU ms" : "frame ms";
      if (report.materials) {
        const sss = report.materials.sss;
        set(
          "gpu",
          `${(report.timerExt ? sss.gpuMsMedian : sss.wallMsMedian).toFixed(3)} ${unit}`,
        );
        set("calls", String(sss.drawCalls));
        set("tris", sss.triangles.toLocaleString("en-US"));
      }
      set("size", `${report.width}×${report.height}`);
      note.textContent = `MEASUREMENT done · ${report.gpu} · ${report.frames} frames · mask ${report.maskPixels} px · see the MEASURE line in the console`;
    },
  };
}
