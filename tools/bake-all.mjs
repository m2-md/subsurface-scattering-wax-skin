#!/usr/bin/env node
// Runs the seven bake-table runs one after another and appends each `BAKE`
// line to the measurements-<date>.jsonl file.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// The demo uses ONLY the rays=32 maps. The sweep runs (16/64 rays, the 64² BVH
// comparison) write their output into a separate folder; otherwise the last run
// would overwrite public/thickness/candle-256.bin.
const SWEEP_OUT = "--out=.bake-sweep";

const RUNS = [
  ["--mesh=candle", "--res=128", "--rays=32"],
  ["--mesh=candle", "--res=256", "--rays=32"],
  ["--mesh=candle", "--res=512", "--rays=32"],
  ["--mesh=candle", "--res=256", "--rays=16", SWEEP_OUT],
  ["--mesh=candle", "--res=256", "--rays=64", SWEEP_OUT],
  ["--mesh=candle", "--res=64", "--rays=8", "--bvh=off", SWEEP_OUT],
  ["--mesh=candle", "--res=64", "--rays=8", SWEEP_OUT],
  // The demo's second mesh; it does not appear in the article's tables.
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
    console.error(`no BAKE line: ${args.join(" ")}`);
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

// Demo precondition: all three of 128/256/512 must be in place.
let missing = 0;
for (const size of [128, 256, 512]) {
  const file = join("public", "thickness", `candle-${size}.bin`);
  if (!existsSync(file) || statSync(file).size !== size * size) {
    console.error(`MISSING or corrupt: ${file}`);
    missing++;
  }
}
if (missing > 0) process.exit(1);
console.log(`bake:all done → ${logFile}`);
