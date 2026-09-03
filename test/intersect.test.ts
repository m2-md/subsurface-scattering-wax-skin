import { describe, expect, it } from "vitest";
import { bruteForceIntersect, intersectTriangle } from "../src/bake/intersect";

// test/intersect.test.ts (parça)
// z = 5 düzleminde, orijinin karşısında duran bir üçgen
const wall = new Float32Array([-1, -1, 5, 3, -1, 5, -1, 3, 5]);

describe("intersectTriangle", () => {
  it("ileri yöndeki kesişimi bulur", () => {
    expect(intersectTriangle(0, 0, 0, 0, 0, 1, wall, 0)).toBeCloseTo(5, 12);
  });

  it("arka yüzden de aynı mesafeyi verir (culling YOK)", () => {
    // İçeriden bakan bir ışın karşı duvara arkasından çarpar; onu saymazsak
    // kalınlık haritası her yerde sıfır çıkar.
    expect(intersectTriangle(0, 0, 10, 0, 0, -1, wall, 0)).toBeCloseTo(5, 12);
  });

  it("üçgenin dışından geçen ışını ıskalar", () => {
    expect(intersectTriangle(9, 9, 0, 0, 0, 1, wall, 0)).toBe(Infinity);
  });

  it("düzleme paralel ışın kesişim üretmez", () => {
    expect(intersectTriangle(0, 0, 5, 1, 0, 0, wall, 0)).toBe(Infinity);
  });

  it("ışının arkasında kalan üçgeni saymaz", () => {
    expect(intersectTriangle(0, 0, 8, 0, 0, 1, wall, 0)).toBe(Infinity);
  });

  it("t < 1e-5 eşiği kendine çarpmayı eler", () => {
    // Işın tam üçgenin üstünden başlıyor: epsilon olmadan sıfır mesafede
    // kendisine çarpar ve harita tamamen siyah çıkar.
    expect(intersectTriangle(0, 0, 5, 0, 0, 1, wall, 0)).toBe(Infinity);
    expect(intersectTriangle(0, 0, 4.99999, 0, 0, 1, wall, 0)).toBe(Infinity);
    expect(intersectTriangle(0, 0, 4.9999, 0, 0, 1, wall, 0)).toBeCloseTo(
      1e-4,
      9,
    );
  });

  it("dejenere üçgen kesişim üretmez", () => {
    const degenerate = new Float32Array([0, 0, 5, 0, 0, 5, 0, 0, 5]);
    expect(intersectTriangle(0, 0, 0, 0, 0, 1, degenerate, 0)).toBe(Infinity);
  });

  it("dizideki ikinci üçgeni de okuyabilir", () => {
    const two = new Float32Array(18);
    two.set(wall, 0);
    two.set([-1, -1, 9, 3, -1, 9, -1, 3, 9], 9);
    expect(intersectTriangle(0, 0, 0, 0, 0, 1, two, 9)).toBeCloseTo(9, 12);
  });
});

describe("bruteForceIntersect", () => {
  const two = new Float32Array(18);
  two.set([-1, -1, 9, 3, -1, 9, -1, 3, 9], 0);
  two.set(wall, 9);

  it("en yakın kesişimi seçer", () => {
    expect(bruteForceIntersect(two, [0, 0, 0], [0, 0, 1], 100)).toBeCloseTo(
      5,
      12,
    );
  });

  it("tMax sınırının ötesindeki kesişimi döndürmez", () => {
    expect(bruteForceIntersect(two, [0, 0, 0], [0, 0, 1], 3)).toBe(3);
  });

  it("hiç üçgen yoksa tMax döner", () => {
    expect(
      bruteForceIntersect(new Float32Array(0), [0, 0, 0], [0, 0, 1], 7),
    ).toBe(7);
  });
});
