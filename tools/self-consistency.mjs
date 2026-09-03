// Self-consistency deviation: reads the same configuration out of two separate
// sweeps and measures the difference between them.
//
// The `power = 4` row of the lobe sweep and the 256² row of the map-resolution
// sweep measure the SAME thing: 256 thickness map, default lobe (power 4), same
// pose, same frame count. Their difference is the noise of the rig, not of the
// technique — it backs the article's "I couldn't measure power's effect" line.
//
// Usage:
//   node tools/self-consistency.mjs [measurements-*.jsonl]
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "measurements-2026-08-13.jsonl";
const runs = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line))
  .filter((entry) => typeof entry.id === "string" && entry.id.startsWith("MEASURE"))
  .map((entry) => entry.line);

if (runs.length === 0) throw new Error(`no MEASURE run in ${file}`);

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

console.log(`source: ${file} (${runs.length} MEASURE runs)`);
console.log("run | power=4 | map 256² | |d|/max | |d|/min | |d|/avg");
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

// The numbers published in the article's tables are per-cell medians, so we
// compute the deviation from there too, letting a reader check both tables.
const a = median(lobe);
const b = median(map);
const d = Math.abs(a - b);
console.log("");
console.log(`published medians: power=4 ${a.toFixed(4)} · map 256² ${b.toFixed(4)}`);
console.log(`deviation |d|/max: ${((d / Math.max(a, b)) * 100).toFixed(1)}%`);
console.log(`deviation |d|/min: ${((d / Math.min(a, b)) * 100).toFixed(1)}%`);
console.log(`deviation |d|/avg: ${((d / ((a + b) / 2)) * 100).toFixed(1)}%`);
console.log(
  `per-run |d|/avg: min ${(Math.min(...perRun) * 100).toFixed(1)}% · ` +
    `median ${(median(perRun) * 100).toFixed(1)}% · ` +
    `max ${(Math.max(...perRun) * 100).toFixed(1)}%`,
);
