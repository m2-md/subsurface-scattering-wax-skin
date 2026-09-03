import { intersectTriangle } from "./intersect";

/**
 * `1 / d` bunu aşarsa ışın o eksene paralel sayılır (`|d| < 1e-9`). Tam paralel
 * ışın `Infinity` verir, neredeyse-paralel olan sonlu ama devasa bir sayı; ikisi
 * de aynı muameleyi görmek zorunda.
 */
const PARALLEL_INV = 1e9;

/** Paralel eksende "başlangıç dilimin içinde mi" testinin payı, dünya birimi. */
const SLAB_EPS = 1e-6;

/**
 * Bir düğümün kutusuna giriş mesafesi, ıskalarsa `Infinity`.
 *
 * NaN tuzağı: ışın bir eksene tam paralelken `1 / d` sonsuz oluyor ve kutunun o
 * eksendeki sınırı ışının başlangıcıyla çakışırsa `0 * Infinity = NaN` çıkıyor.
 * `Math.min` / `Math.max` NaN'i sessizce yayar.
 *
 * Sinsi olan varyantı `1 / d`nin sonsuz değil sadece devasa olduğu hâl: yön
 * bileşeni `3.4e-17` gibi bir artık, ışının başlangıcı da kutunun `max` düzlemi
 * üstünde. `hi = (max - o) * inv` tam olarak 0 çıkıyor, `tmax` 0'a kelepçeleniyor
 * ve gerçek kesişimi taşıyan düğüm eleniyor. NaN yok, sessiz bir ıska var.
 *
 * Çözüm standart sağlam slab testi: `|d|` eşiğin altındaki eksen kısıt ÜRETMEZ,
 * yalnızca başlangıcın dilimin (bir epsilon payıyla) içinde olmasını ister.
 * Böylece tam paralel ve neredeyse paralel aynı yoldan geçiyor ve çarpım hiç
 * yapılmadığı için `0 * Infinity` de doğmuyor.
 */
export function slabDistance(
  bounds: Float32Array,
  node: number,
  ox: number,
  oy: number,
  oz: number,
  invX: number,
  invY: number,
  invZ: number,
  tMax: number,
): number {
  const b = node * 6;
  let tmin = 0;
  let tmax = tMax;
  let lo: number, hi: number;

  if (invX > PARALLEL_INV || invX < -PARALLEL_INV) {
    if (ox < bounds[b] - SLAB_EPS || ox > bounds[b + 3] + SLAB_EPS) {
      return Infinity;
    }
  } else {
    lo = (bounds[b] - ox) * invX;
    hi = (bounds[b + 3] - ox) * invX;
    if (lo > hi) {
      const s = lo;
      lo = hi;
      hi = s;
    }
    if (lo > tmin) tmin = lo;
    if (hi < tmax) tmax = hi;
  }

  if (invY > PARALLEL_INV || invY < -PARALLEL_INV) {
    if (oy < bounds[b + 1] - SLAB_EPS || oy > bounds[b + 4] + SLAB_EPS) {
      return Infinity;
    }
  } else {
    lo = (bounds[b + 1] - oy) * invY;
    hi = (bounds[b + 4] - oy) * invY;
    if (lo > hi) {
      const s = lo;
      lo = hi;
      hi = s;
    }
    if (lo > tmin) tmin = lo;
    if (hi < tmax) tmax = hi;
  }

  if (invZ > PARALLEL_INV || invZ < -PARALLEL_INV) {
    if (oz < bounds[b + 2] - SLAB_EPS || oz > bounds[b + 5] + SLAB_EPS) {
      return Infinity;
    }
  } else {
    lo = (bounds[b + 2] - oz) * invZ;
    hi = (bounds[b + 5] - oz) * invZ;
    if (lo > hi) {
      const s = lo;
      lo = hi;
      hi = s;
    }
    if (lo > tmin) tmin = lo;
    if (hi < tmax) tmax = hi;
  }

  return tmin <= tmax ? tmin : Infinity;
}

/**
 * En uzun eksende ortanca bölmeyle kurulan sınırlayıcı hacim hiyerarşisi.
 * Yaprakları `leafSize` üçgen tutar. Sağ çocuk HER ZAMAN solun bir sonrasıdır;
 * `intersect` döngüsü buna dayanıyor.
 */
export class Bvh {
  readonly tris: Float32Array;
  readonly order: Int32Array;
  readonly bounds: Float32Array;
  /**
   * Düğüm başına 3 int: `left`, `start`, `count`. `count >= 0` → yaprak,
   * `count === -1` → iç düğüm. Boş ağacın kökü sıfır üçgenli bir yapraktır;
   * bu yüzden eşik `> 0` değil `>= 0`.
   */
  readonly meta: Int32Array;
  readonly stack: Int32Array;
  readonly leafSize: number;
  readonly nodeCount: number;
  readonly depth: number;
  readonly triangleCount: number;

  constructor(tris: Float32Array, leafSize = 4) {
    this.tris = tris;
    this.leafSize = Math.max(1, leafSize);
    const count = Math.floor(tris.length / 9);
    this.triangleCount = count;

    this.order = new Int32Array(count);
    for (let i = 0; i < count; i++) this.order[i] = i;

    const centroids = new Float64Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = i * 9;
      centroids[i * 3] = (tris[t] + tris[t + 3] + tris[t + 6]) / 3;
      centroids[i * 3 + 1] = (tris[t + 1] + tris[t + 4] + tris[t + 7]) / 3;
      centroids[i * 3 + 2] = (tris[t + 2] + tris[t + 5] + tris[t + 8]) / 3;
    }

    // Her yaprak en az bir üçgen tutuyor → en fazla 2n − 1 düğüm.
    const capacity = Math.max(1, 2 * count + 1);
    this.bounds = new Float32Array(capacity * 6);
    this.meta = new Int32Array(capacity * 3);

    let used = 1;
    let maxDepth = 1;

    const build = (
      node: number,
      start: number,
      span: number,
      level: number,
    ) => {
      if (level > maxDepth) maxDepth = level;
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      for (let k = 0; k < span; k++) {
        const t = this.order[start + k] * 9;
        for (let c = 0; c < 3; c++) {
          const x = tris[t + c * 3];
          const y = tris[t + c * 3 + 1];
          const z = tris[t + c * 3 + 2];
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }
      }
      if (span === 0) {
        minX = minY = minZ = 0;
        maxX = maxY = maxZ = 0;
      }
      const b = node * 6;
      this.bounds[b] = minX;
      this.bounds[b + 1] = minY;
      this.bounds[b + 2] = minZ;
      this.bounds[b + 3] = maxX;
      this.bounds[b + 4] = maxY;
      this.bounds[b + 5] = maxZ;

      if (span <= this.leafSize) {
        this.meta[node * 3] = -1;
        this.meta[node * 3 + 1] = start;
        this.meta[node * 3 + 2] = span;
        return;
      }

      const axis =
        maxX - minX >= maxY - minY && maxX - minX >= maxZ - minZ
          ? 0
          : maxY - minY >= maxZ - minZ
            ? 1
            : 2;

      const slice = Array.from(this.order.subarray(start, start + span));
      slice.sort((a, c) => centroids[a * 3 + axis] - centroids[c * 3 + axis]);
      this.order.set(slice, start);

      const mid = span >> 1;
      const left = used;
      used += 2;
      this.meta[node * 3] = left;
      this.meta[node * 3 + 1] = start;
      this.meta[node * 3 + 2] = -1; // iç düğüm
      build(left, start, mid, level + 1);
      build(left + 1, start + mid, span - mid, level + 1);
    };

    build(0, 0, count, 1);
    this.nodeCount = used;
    this.depth = maxDepth;
    this.stack = new Int32Array(2 * maxDepth + 8);
  }

  // src/bake/bvh.ts (parça)
  intersect(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    tMax: number,
  ): number {
    const invX = 1 / dx,
      invY = 1 / dy,
      invZ = 1 / dz;
    const stack = this.stack; // önceden ayrılmış Int32Array — döngüde tahsis yok
    let sp = 0;
    stack[sp++] = 0;
    let best = tMax;

    while (sp > 0) {
      const node = stack[--sp];
      if (
        slabDistance(this.bounds, node, ox, oy, oz, invX, invY, invZ, best) ===
        Infinity
      ) {
        continue;
      }
      const count = this.meta[node * 3 + 2];
      if (count >= 0) {
        // yaprak
        const start = this.meta[node * 3 + 1];
        for (let k = 0; k < count; k++) {
          const t = intersectTriangle(
            ox,
            oy,
            oz,
            dx,
            dy,
            dz,
            this.tris,
            this.order[start + k] * 9,
          );
          if (t < best) best = t;
        }
      } else {
        const left = this.meta[node * 3];
        stack[sp++] = left;
        stack[sp++] = left + 1; // sağ çocuk her zaman solun bir sonrası
      }
    }
    return best;
  }
}
