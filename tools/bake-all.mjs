#!/usr/bin/env node
// Fırın tablolarını besleyen yedi koşuyu sırayla çalıştırır ve her `BAKE`
// satırını measurements-<tarih>.jsonl dosyasına ekler.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// Demo YALNIZCA rays=32 haritalarını kullanır. Tarama koşuları (16/64 ışın,
// 64² BVH kıyası) çıktılarını ayrı bir klasöre yazar; aksi hâlde son koşu
// public/thickness/candle-256.bin dosyasının üstüne yazardı.
const SWEEP_OUT = "--out=.bake-sweep";

const RUNS = [
  ["--mesh=candle", "--res=128", "--rays=32"],
  ["--mesh=candle", "--res=256", "--rays=32"],
  ["--mesh=candle", "--res=512", "--rays=32"],
  ["--mesh=candle", "--res=256", "--rays=16", SWEEP_OUT],
  ["--mesh=candle", "--res=256", "--rays=64", SWEEP_OUT],
  ["--mesh=candle", "--res=64", "--rays=8", "--bvh=off", SWEEP_OUT],
  ["--mesh=candle", "--res=64", "--rays=8", SWEEP_OUT],
  // Demo'nun ikinci mesh'i; makale tablolarına girmiyor.
  ["--mesh=blob", "--res=256", "--rays=32"],
  ["--mesh=blob", "--res=128", "--rays=32"],
  ["--mesh=blob", "--res=512", "--rays=32"],
];

const date = new Date().toISOString().slice(0, 10);
const logFile = `measurements-${date}.jsonl`;

let run = 0;
for (const args of RUNS) {
  run++;
  const result = spawnSync(
    "npx",
    ["vite-node", "tools/bake-thickness.ts", "--", ...args],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  const line = result.stdout.split("\n").find((l) => l.startsWith("BAKE "));
  if (!line) {
    console.error(`BAKE satırı yok: ${args.join(" ")}`);
    process.exit(1);
  }
  const payload = JSON.parse(line.slice(5));
  appendFileSync(
    logFile,
    `${JSON.stringify({
      kind: "bake",
      run,
      id: `BAKE.${run}`,
      cmd: `npm run bake -- ${args.join(" ")}`,
      line: payload,
    })}\n`,
  );
  console.log(line);
}

// Demo ön koşulu: 128/256/512 üçü de yerinde olmalı.
let missing = 0;
for (const size of [128, 256, 512]) {
  const file = join("public", "thickness", `candle-${size}.bin`);
  if (!existsSync(file) || statSync(file).size !== size * size) {
    console.error(`EKSİK ya da bozuk: ${file}`);
    missing++;
  }
}
if (missing > 0) process.exit(1);
console.log(`bake:all tamam → ${logFile}`);
