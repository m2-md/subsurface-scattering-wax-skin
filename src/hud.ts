import type { MeasureReport } from "./measure";
import { MODE_LABELS } from "./modes";
import type { StageStats } from "./renderer";

export interface Hud {
  update(stats: StageStats): void;
  setTimerSource(source: "gpu" | "raf"): void;
  setNote(text: string): void;
  showMeasureReport(report: MeasureReport): void;
}

/** ÖLÇÜM: her karede donanımdan/saatten okunan değerler. */
const MEASURED = [
  ["fps", "FPS"],
  ["frame", "kare ms"],
  ["gpu", "GPU ms"],
  ["calls", "draw call"],
  ["tris", "üçgen"],
] as const;

/** YAPISAL: kullanıcının seçtiği, ölçülmeyen ayarlar. */
const STRUCTURAL = [
  ["material", "materyal"],
  ["map", "kalınlık"],
  ["mode", "mod"],
  ["azimuth", "ışık azimutu"],
  ["size", "arka tampon"],
] as const;

const MATERIAL_LABEL: Record<string, string> = {
  lambert: "Lambert",
  sss: "SSS (elle)",
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

  const measured = group("Ölçüm", "ÖLÇÜM");
  for (const [key, label] of MEASURED) cells.set(key, row(measured, label));

  const structural = group("Yapılandırma", "YAPISAL");
  for (const [key, label] of STRUCTURAL) cells.set(key, row(structural, label));

  const note = document.createElement("div");
  note.className = "hud-note";
  note.textContent = "GPU saati: yokluyor…";

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
      set("tris", stats.triangles.toLocaleString("tr-TR"));
      set("material", MATERIAL_LABEL[stats.material] ?? stats.material);
      set("map", stats.mapSize === null ? "sabit 0,5" : `${stats.mapSize}²`);
      set("mode", MODE_LABELS[stats.mode] ?? String(stats.mode));
      set("azimuth", `${stats.lightAzimuthDeg.toFixed(0)}°`);
      set("size", `${stats.width}×${stats.height}`);
    },

    setTimerSource(source) {
      timerSource = source;
      note.textContent =
        source === "gpu"
          ? "GPU saati: EXT_disjoint_timer_query_webgl2"
          : "GPU saati: uzantı yok → kare süresi (rAF) raporlanıyor";
    },

    setNote(text) {
      note.textContent = text;
    },

    showMeasureReport(report) {
      const unit = report.timerExt ? "GPU ms" : "kare ms";
      if (report.materials) {
        const sss = report.materials.sss;
        set(
          "gpu",
          `${(report.timerExt ? sss.gpuMsMedian : sss.wallMsMedian).toFixed(3)} ${unit}`,
        );
        set("calls", String(sss.drawCalls));
        set("tris", sss.triangles.toLocaleString("tr-TR"));
      }
      set("size", `${report.width}×${report.height}`);
      note.textContent = `ÖLÇÜM bitti · ${report.gpu} · ${report.frames} kare · maske ${report.maskPixels} px · konsoldaki MEASURE satırına bakın`;
    },
  };
}
