// Öz-tutarlılık sapması: aynı yapılandırmayı iki ayrı taramadan okuyup
// aralarındaki farkı ölçer.
//
// Lob taramasının `power = 4` satırı ile harita çözünürlüğü taramasının 256²
// satırı AYNI şeyi ölçüyor: 256'lık kalınlık haritası, varsayılan lob (power 4),
// aynı poz, aynı kare sayısı. İkisi arasındaki fark tekniğin değil düzeneğin
// gürültüsü — makaledeki "power'ın etkisini ölçemedim" cümlesinin dayanağı bu.
//
// Kullanım:
//   node tools/self-consistency.mjs [measurements-*.jsonl]
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "measurements-2026-08-13.jsonl";
const runs = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line))
  .filter((entry) => typeof entry.id === "string" && entry.id.startsWith("MEASURE"))
  .map((entry) => entry.line);

if (runs.length === 0) throw new Error(`${file} içinde MEASURE koşusu yok`);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

const lobe = runs.map(
  (run) => run.lobe.power.find((row) => row.value === 4).gpuMsMedian,
);
const map = runs.map(
  (run) => run.mapResolution.find((row) => row.size === 256).gpuMsMedian,
);

console.log(`kaynak: ${file} (${runs.length} MEASURE koşusu)`);
console.log("koşu | power=4 | map 256² | |d|/büyük | |d|/küçük | |d|/ort");
const perRun = [];
for (let i = 0; i < runs.length; i++) {
  const a = lobe[i];
  const b = map[i];
  const d = Math.abs(a - b);
  const rel = d / ((a + b) / 2);
  perRun.push(rel);
  console.log(
    `  ${i + 1}  | ${a.toFixed(4)}  | ${b.toFixed(4)}   | ` +
      `${((d / Math.max(a, b)) * 100).toFixed(1)}%     | ` +
      `${((d / Math.min(a, b)) * 100).toFixed(1)}%     | ${(rel * 100).toFixed(1)}%`,
  );
}

// Makaledeki tablolarda yayımlanan sayılar hücre bazlı medyan; sapmayı da
// oradan hesaplıyoruz ki okuyucu iki tabloya bakıp doğrulayabilsin.
const a = median(lobe);
const b = median(map);
const d = Math.abs(a - b);
console.log("");
console.log(`yayımlanan medyanlar: power=4 ${a.toFixed(4)} · map 256² ${b.toFixed(4)}`);
console.log(`sapma |d|/büyük  : ${((d / Math.max(a, b)) * 100).toFixed(1)}%`);
console.log(`sapma |d|/küçük  : ${((d / Math.min(a, b)) * 100).toFixed(1)}%`);
console.log(`sapma |d|/ort    : ${((d / ((a + b) / 2)) * 100).toFixed(1)}%`);
console.log(
  `koşu bazlı |d|/ort: min ${(Math.min(...perRun) * 100).toFixed(1)}% · ` +
    `medyan ${(median(perRun) * 100).toFixed(1)}% · ` +
    `maks ${(Math.max(...perRun) * 100).toFixed(1)}%`,
);
