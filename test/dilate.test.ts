import { describe, expect, it } from "vitest";
import { NEIGHBOURS, dilate } from "../src/bake/dilate";

const SIZE = 9;

function grid(seed: Array<[number, number, number]>) {
  const values = new Float32Array(SIZE * SIZE);
  const filled = new Uint8Array(SIZE * SIZE);
  for (const [x, y, value] of seed) {
    values[y * SIZE + x] = value;
    filled[y * SIZE + x] = 1;
  }
  return { values, filled };
}

describe("dilate", () => {
  it("fills only 4 neighbours in ONE pass from a single filled texel", () => {
    // Without the copy, 12 texels would fill in the same scan — regression test.
    const { values, filled } = grid([[4, 4, 1]]);
    expect(dilate(values, filled, SIZE, 1)).toBe(4);
    let count = 0;
    for (const f of filled) count += f;
    expect(count).toBe(5);
  });

  it("the ring widens over two passes", () => {
    const { values, filled } = grid([[4, 4, 1]]);
    dilate(values, filled, SIZE, 2);
    let count = 0;
    for (const f of filled) count += f;
    expect(count).toBe(13); // 1 + 4 + 8
  });

  it("the value is the mean of the filled neighbours", () => {
    const { values, filled } = grid([
      [3, 4, 1],
      [5, 4, 3],
    ]);
    dilate(values, filled, SIZE, 1);
    expect(values[4 * SIZE + 4]).toBeCloseTo(2, 12);
  });

  it("the value of a filled texel does not change", () => {
    const { values, filled } = grid([
      [4, 4, 7],
      [4, 5, 1],
    ]);
    dilate(values, filled, SIZE, 3);
    expect(values[4 * SIZE + 4]).toBe(7);
    expect(values[5 * SIZE + 4]).toBe(1);
  });

  it("does not run past the array at edge and corner texels", () => {
    const { values, filled } = grid([[0, 0, 5]]);
    expect(dilate(values, filled, SIZE, 1)).toBe(2); // right and bottom neighbour
    expect(values[1]).toBe(5);
    expect(values[SIZE]).toBe(5);
  });

  it("returns 0 and the loop exits early when no texel is filled", () => {
    const values = new Float32Array(SIZE * SIZE);
    const filled = new Uint8Array(SIZE * SIZE);
    expect(dilate(values, filled, SIZE, 8)).toBe(0);
  });

  it("gaps remain once the passes run out", () => {
    const { values, filled } = grid([[0, 0, 1]]);
    dilate(values, filled, SIZE, 2);
    expect(filled[SIZE * SIZE - 1]).toBe(0);
  });

  it("nothing changes when everything is already filled", () => {
    const seed: Array<[number, number, number]> = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) seed.push([x, y, x + y]);
    }
    const { values, filled } = grid(seed);
    expect(dilate(values, filled, SIZE, 4)).toBe(0);
    expect(values[4 * SIZE + 4]).toBe(8);
  });

  it("NEIGHBOURS is four neighbours, no diagonals", () => {
    expect(NEIGHBOURS).toHaveLength(4);
    for (const [dx, dy] of NEIGHBOURS) {
      expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
    }
  });
});
