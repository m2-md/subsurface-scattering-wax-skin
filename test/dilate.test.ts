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
  it("tek dolu texel'den BİR geçişte yalnızca 4 komşu dolar", () => {
    // Kopya alınmazsa aynı taramada 12 texel dolardı — regresyon testi.
    const { values, filled } = grid([[4, 4, 1]]);
    expect(dilate(values, filled, SIZE, 1)).toBe(4);
    let count = 0;
    for (const f of filled) count += f;
    expect(count).toBe(5);
  });

  it("iki geçişte halka genişler", () => {
    const { values, filled } = grid([[4, 4, 1]]);
    dilate(values, filled, SIZE, 2);
    let count = 0;
    for (const f of filled) count += f;
    expect(count).toBe(13); // 1 + 4 + 8
  });

  it("değer dolu komşuların ortalaması", () => {
    const { values, filled } = grid([
      [3, 4, 1],
      [5, 4, 3],
    ]);
    dilate(values, filled, SIZE, 1);
    expect(values[4 * SIZE + 4]).toBeCloseTo(2, 12);
  });

  it("dolu texel'in değeri değişmez", () => {
    const { values, filled } = grid([
      [4, 4, 7],
      [4, 5, 1],
    ]);
    dilate(values, filled, SIZE, 3);
    expect(values[4 * SIZE + 4]).toBe(7);
    expect(values[5 * SIZE + 4]).toBe(1);
  });

  it("kenar ve köşe texel'lerinde dizi dışına taşmaz", () => {
    const { values, filled } = grid([[0, 0, 5]]);
    expect(dilate(values, filled, SIZE, 1)).toBe(2); // sağ ve alt komşu
    expect(values[1]).toBe(5);
    expect(values[SIZE]).toBe(5);
  });

  it("hiç dolu texel yoksa 0 döner ve döngü erken biter", () => {
    const values = new Float32Array(SIZE * SIZE);
    const filled = new Uint8Array(SIZE * SIZE);
    expect(dilate(values, filled, SIZE, 8)).toBe(0);
  });

  it("passes bittiğinde kalan boşluklar kalır", () => {
    const { values, filled } = grid([[0, 0, 1]]);
    dilate(values, filled, SIZE, 2);
    expect(filled[SIZE * SIZE - 1]).toBe(0);
  });

  it("her şey doluyken hiçbir şey değişmez", () => {
    const seed: Array<[number, number, number]> = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) seed.push([x, y, x + y]);
    }
    const { values, filled } = grid(seed);
    expect(dilate(values, filled, SIZE, 4)).toBe(0);
    expect(values[4 * SIZE + 4]).toBe(8);
  });

  it("NEIGHBOURS dört komşudur, çapraz yok", () => {
    expect(NEIGHBOURS).toHaveLength(4);
    for (const [dx, dy] of NEIGHBOURS) {
      expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
    }
  });
});
