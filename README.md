# Yüzey altı saçılma — mum ve ten (wrap + geçirgenlik + pişmiş kalınlık haritası)

"İçinden Işık Geçen Malzeme: Mum ve Ten için Gerçek Zamanlı Subsurface
Scattering" makalesinin çalışan kodu. `three@0.185.1` + `WebGLRenderer` + ham
GLSL ES 3.00 (`ShaderMaterial` + `glslVersion: THREE.GLSL3`), TypeScript, Vite,
vitest. Fırın `vite-node` ile koşan bir Node CLI'ı.

Saçılma matematiğinin tamamı elle yazılmış; three burada sahne grafiği ve GL
durum makinesi. **Tek istisna kontrol grubudur:** `MeshPhysicalMaterial`
`transmission` yolu bilerek hazır kullanılıyor, çünkü ölçtüğümüz şey o.

Doku dosyası (PNG/JPG) yok: fırın ham `.bin` + meta JSON üretiyor, tarayıcı
`DataTexture` ile yüklüyor. Görsel bağımlılık sıfır.

Aynı sahne üç materyalle çiziliyor ve GPU saatiyle yan yana ölçülüyor:

| Materyal   | Ne yapıyor                                                                   |
| ---------- | ---------------------------------------------------------------------------- |
| `lambert`  | Yalın referans. `max(dot(n, l), 0)` + specular. Kalınlık okuması YOK         |
| `sss`      | Elle yazılmış wrap lighting + görüş-bağımlı geçirgenlik lobu + R8 harita     |
| `physical` | three'nin `MeshPhysicalMaterial` `transmission` yolu + RG8 kalınlık haritası |

## Ne içerir

- **Saf mantık katmanı** — tarayıcı tanımıyor, `vitest` ile test ediliyor:
  `src/translucency.ts` (GLSL'in CPU ikizi), `src/bake/raster.ts`,
  `src/bake/dilate.ts`, `src/bake/sampling.ts`, `src/bake/intersect.ts`,
  `src/bake/bvh.ts`, `src/mesh.ts`, `src/pack.ts`, `src/half.ts`,
  `src/luminance.ts`, `src/stats.ts`, `src/viewport.ts`.
- **Offline fırın** (`tools/bake-thickness.ts`) — UV uzayında rasterizasyon,
  texel başına konum/normal, `-N` yarım küresine kosinüs ağırlıklı Hammersley
  ışınları, BVH'li Möller-Trumbore kesişimi, dilate, normalizasyon, `.bin` +
  meta JSON. `Math.random` YOK: koşudan koşuya bit birebir aynı çıktı.
- **Elle yazılmış SSS materyali** (`src/shaders/sss.frag.glsl` +
  `src/shaders/lib/translucency.glsl`) — `wrapDiffuse` ve `backTranslucency`.
  Dört mod: tam / kalınlık / geçirgenlik / wrap.
- **Kontrol grubu** (`src/materials/physical.ts`) — `transmission: 1`,
  `thicknessMap` RG8 kopyasına bağlı.
- **Doğrusal boru hattı** — bütün çizim `HalfFloatType` bir ara hedefe,
  sRGB kodlaması yalnız `present.frag.glsl` geçişinde. Parlaklık ölçümü ara
  hedeften, present'ten ÖNCE alınıyor.
- **GPU saati** (`src/timer.ts`) — `EXT_disjoint_timer_query_webgl2`, sorgu
  kuyruğu, `GPU_DISJOINT_EXT` kontrolü. Uzantı yoksa çıktı bunu açıkça söyler
  (`timerExt: false`) ve GPU ms yerine kare süresi raporlanır.
- **Deterministik ölçüm modu** (`src/measure.ts`) — `?measure=1`.

## Kurulum

```bash
npm install
```

## Test (tarayıcısız, deterministik)

```bash
npm test
```

**139 test yeşil** (15 dosya):

| Dosya                       | Ne sınıyor                                                                  | Test |
| --------------------------- | --------------------------------------------------------------------------- | ---- |
| `test/translucency.test.ts` | wrap özdeşliği (`w = 0` → Lambert), terminatör konumu, `1/(1+w)` tepe, lob  | 12   |
| `test/sampling.test.ts`     | `radicalInverse2` ilk 8 değer, Hammersley, ortonormal baz (kutuplar dahil)  | 9    |
| `test/intersect.test.ts`    | çift yönlü Möller-Trumbore, `1e-5` eşiği, dejenere üçgen, kaba kuvvet       | 11   |
| `test/bvh.test.ts`          | kaba kuvvetle 12 hane eşdeğerlik, eksene paralel/neredeyse paralel ışın, `leafSize` | 15   |
| `test/trace.test.ts`        | kaçan ışın sayacı: kapalı gövdede 0, delikli meshte > 0, BVH ≡ kaba kuvvet  | 4    |
| `test/raster.test.ts`       | alanla orantılı texel, baryantrik toplam 1, yarım texel kaydırması          | 7    |
| `test/dilate.test.ts`       | kopya alınmadan tek geçişte bulaşma (regresyon), halka genişlemesi          | 9    |
| `test/mesh.test.ts`         | profillerin ilk/son noktası `x = 0`, monotonluk, `smoothstep`               | 11   |
| `test/pack.test.ts`         | `textureBytes` bilinen boyutlar, mipmap zinciri 4/3                         | 6    |
| `test/half.test.ts`         | `halfToFloat` bilinen desenler, subnormal, ±Infinity, NaN                   | 6    |
| `test/luminance.test.ts`    | Rec.709 katsayıları, maskeli ortalama, kova sınırları (KESİN eşitsizlik)    | 11   |
| `test/viewport.test.ts`     | dpr/ölçek kelepçeleri, piksel bütçesi                                       | 8    |
| `test/stats.test.ts`        | medyan/yüzdelik uç durumları, RMS, alfa yok sayma                           | 13   |
| `test/shaders.test.ts`      | gerçek `?raw` kaynaklar: `#version` yok, MODE paritesi, `.r` vs `.g`        | 15   |
| `test/parity.test.ts`       | GLSL ↔ TS ikizinin analitik yeniden türetmeyle örtüşmesi                    | 2    |

Hiçbir test dosyası `document`, `window`, `navigator`, `WebGL2RenderingContext`
ya da `performance` referansı içermez; `three` de import edilmez.

## Fırın

Kalınlık haritaları **repoda pişmiş geliyor** (`public/thickness/`), demo
`npm run bake` koşulmadan da açılır. Kendiniz pişirmek için:

```bash
npm run bake -- --mesh=candle --res=256 --rays=32
# BAKE {"mesh":"candle","triangles":9600,"resolution":256,...}
```

Bayraklar: `--mesh=candle|blob`, `--res=<int>` (256), `--rays=<int>` (32),
`--bvh=on|off` (on), `--dilate=<int>` (4), `--out=<dir>` (`public/thickness`).

Yediyi birden koşmak ve her satırı `measurements-<tarih>.jsonl`'a eklemek için:

```bash
npm run bake:all
```

**Determinizm kontrolü** (`Math.random` yok, Hammersley var):

```bash
npm run bake -- --mesh=candle --res=256 --rays=32 | grep -o '"sha256":"[^"]*"'
shasum -a 256 public/thickness/candle-256.bin
# iki koşuda birebir aynı özet
```

`candle-256.bin` tam **65536 bayt** (256 × 256 × 1). Meta JSON yanında.

### Fırını besleyen komutlar (makale tablolarına birebir)

| Komut                                                                         | Hangi tabloyu besler                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `npm run bake -- --mesh=candle --res=128 --rays=32`                           | Fırın tablosu 128² satırı                         |
| `npm run bake -- --mesh=candle --res=256 --rays=32`                           | 256² satırı + kapsama/dilate/kaçan ışın cümleleri |
| `npm run bake -- --mesh=candle --res=512 --rays=32`                           | 512² satırı + demo referans haritası              |
| `npm run bake -- --mesh=candle --res=256 --rays=16 --out=.bake-sweep`         | Işın sayısı cümlesi (alt uç)                      |
| `npm run bake -- --mesh=candle --res=256 --rays=64 --out=.bake-sweep`         | Işın sayısı cümlesi (üst uç)                      |
| `npm run bake -- --mesh=candle --res=64 --rays=8 --bvh=off --out=.bake-sweep` | BVH tablosu, kaba kuvvet satırı                   |
| `npm run bake -- --mesh=candle --res=64 --rays=8 --out=.bake-sweep`           | BVH tablosu, ağaç satırı                          |

Tarama koşuları `--out=.bake-sweep` alır, çünkü aynı `--res=256` dosya adına
yazıp demonun kullandığı rays=32 haritasının üstüne yazarlardı. `.bake-sweep/`
`.gitignore`'da.

## Demo

```bash
npm run dev
# http://localhost:5173/
```

`file://` ile açmayın: Vite'ın `?raw` import'u ve `public/` yolu çalışmaz, boş
ekran gelir.

Kontroller: materyal, kalınlık kaynağı (128²/256²/512²/sabit), mod, ışık
azimutu/yüksekliği, `wrap`, `power`, `distortion`, `absorption`, mesh, çözünürlük
ölçeği, Dur/Devam. Kamera fareyle yörünge, tekerlekle mesafe.

HUD hücreleri iki gruba ayrılmış: **ÖLÇÜM** (FPS, kare ms, GPU ms, draw call,
üçgen) donanımdan okunuyor; **YAPISAL** (materyal, harita boyutu, mod, ışık
azimutu, arka tampon) sizin seçiminiz.

### İşaret sözleşmesi (tek cümle)

`uLightDirection` yüzeyden **IŞIĞA** doğru bakan birim vektördür. Bu yazının en
kolay hatası burada işaret kaçırmaktır.

### Kalınlık haritası konvansiyonu

Dokuda saklanan değer **yolun uzunluğu**dur. **Beyaz = kalın = ışık zor geçer.
Siyah = ince = ışık kolay geçer.** Mod = Kalınlık ile çıplak görebilirsiniz.

### Korkuluklar

`devicePixelRatio` en fazla 2 sayılır, çözünürlük ölçeği 0,75'ten başlar, toplam
piksel sayısı 1.200.000'i geçemez (`src/viewport.ts`). Sekme gizlenince döngü
kendiliğinden durur (`visibilitychange`) — gizli sekmede toplanan kare süreleri
hiçbir şey ifade etmiyor.

## Deterministik ölçüm — `?measure=1`

Ölçüm modunda demo interaktif modu tamamen bırakır: arka tampon 960×540'a
kilitlenir, kamera ve ışık sabit pozlara oturur, her yapılandırmada 30 ısınma
karesi çöpe gider ve 180 kare tartılır. Sonuç konsola **tek satır** `MEASURE
{json}` olarak düşer.

### Ölçüm URL'leri

| URL                                               | Ne yapar                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| `http://localhost:5173/?measure=1`                | **Ana koşu.** A–G bloklarının hepsi, tek satır JSON |
| `http://localhost:5173/?measure=1&only=materials` | Yalnızca üç materyal bloğu                          |
| `http://localhost:5173/?measure=1&only=luminance` | Yalnızca iki poz + kalınlık kovaları                |
| `http://localhost:5173/?measure=1&only=maps`      | Yalnızca harita çözünürlüğü + sabit kalınlık        |
| `http://localhost:5173/?measure=1&only=lobe`      | Yalnızca power/distortion taraması                  |
| `http://localhost:5173/?measure=1&only=channel`   | Yalnızca yeşil kanal sondası                        |
| `http://localhost:5173/`                          | Normal demo (ölçüm yok)                             |

`only=` alt koşuları aynı şemayı basar, ilgisiz alanlar `null` kalır. Ana koşu
makine üstünde ~90 saniye sürüyor; sekmeyi ön planda tutun.

Ön koşul: `public/thickness/candle-128.bin`, `-256.bin`, `-512.bin` üçü de
mevcut olmalı. Yoksa demo sessiz beyaz ekran vermez, kırmızı bir bant açıp
`npm run bake:all` der.

### Ham koşular

Her `MEASURE` ve her `BAKE` satırı `measurements-<tarih>.jsonl` dosyasına
`{"kind": "measure"|"bake", "run": N, ...}` biçiminde yazılır. `npm run bake:all`
kendi satırlarını otomatik ekler; tarayıcı koşuları elle eklenir. En az üç koşu
alınır; makaleye temsilî koşunun sayıları girer.

BVH'nin neredeyse-eksene-paralel ışın düzeltmesinden sonra on fırın koşusu
tekrarlandı (`measurements-2026-09-02.jsonl`); `public/thickness/` altındaki
haritalar bayt bayt aynı çıktı, yani düzeltme yayımlanan çıktıyı değiştirmiyor.

Soğuk derleme etkisi için `?measure=1` koşuları arka arkaya **aynı sekmede**
tekrarlanır; ilk koşunun sürücü önbelleğini ısıttığı varsayılır.

### Öz-tutarlılık (gürültü bandı)

Lob taramasının `power = 4` satırı ile harita çözünürlüğü taramasının 256²
satırı aynı yapılandırmayı ölçüyor; aralarındaki fark tekniğin değil düzeneğin
gürültüsü. Ham kayıttan hesaplamak için:

```bash
node tools/self-consistency.mjs measurements-2026-08-13.jsonl
# koşu bazlı |d|/ort: min 9.3% · medyan 16.4% · maks 61.6%
# yayımlanan medyanlar (0.4532 vs 0.3618) üzerinden |d|/ort: 22.4%
```

Bu bant, lob parametrelerinde aranan farktan geniş — makaledeki "`power`ın
etkisini ölçemedim" cümlesinin dayanağı bu sayı.

### Ne ölçülüyor, ne hesaplanıyor

- **Ölçülen:** `gpuMsMedian`, `gpuMsP95`, `wallMsMedian`, `drawCalls`,
  `triangles`, `programs`, `luminance.*`, `buckets.*`, `rmsVsRef`,
  `greenChannel.*`, `maskPixels`.
- **Hesaplanan:** `textureBytes`, `vramBytes`, `transmissionTargetBytes`.
  `transmissionTargetBytes` uydurma bir formül değil: transmission hedefinin
  gerçek boyutu three'nin `transmissionSamplerSize` uniform'undan okunuyor
  (`renderer.properties.get(material).uniforms`), mipmap zinciri bunun üstüne
  hesaplanıyor. Okunamazsa alan `null` kalır.

### Yarım kayan noktalı geri okuma

Parlaklık ortalaması sekiz bitlik bir hedeften değil, `HalfFloatType` bir
hedeften alınıyor: arkadan aydınlatmada Lambert'in ortalaması sıfıra o kadar
yakın ki sekiz bitte fark ölçüm biriminin altında kalıyor. Sürücü half float
hedeften geri okumayı reddederse `FloatType`'a düşülüyor ve çıktıya
`"readbackType": "float"` yazılıyor. Sessizce 8 bite düşmek yok.

### Sabit-kalınlık ölçümünün ne ölçtüğü

`uUseMap = 0` iken `uThickness` **yine de bağlıdır** — tek program, tek varyant,
`defines` yok. Yani sabit-kalınlık satırı yalnızca doku okumasının maliyetini
değil, "doku okuması + dallanma" ile "uniform okuma"nın farkını ölçüyor.

## Doğrulama borçları

### 1. `three@0.185.1` ve `@types/three`

`npm view three versions` çıktısında `0.185.1` var; `@types/three@0.185.4` tam
eşleşen en yakın sürüm ve `npm run build` (`tsc`) temiz geçiyor. `declare module
"three"` gibi bir kaçış yolu kullanılmadı.

### 2. `thicknessMap`'in YEŞİL kanalı

İddia gözle doğrulandı:

```
node_modules/three/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js:18
    material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
```

(16–20. satırlar, `#ifdef USE_THICKNESSMAP` bloğu içinde.) Ölçüm de aynı şeyi
söylüyor: `?measure=1&only=channel` koşusunda R8 dokunun yeşil kanalı mesh
piksellerinde `r8MeanOnMesh = 0` ve `r8MaxOnMesh = 0`; aynı verinin RG8
kopyasında `rg8MeanOnMesh ≈ 0,945`. Bu yüzden `src/thickness.ts` yükleme
sırasında RG8 kopyası çıkarıyor (iki kat bayt), fırın hâlâ tek dosya üretiyor.

**Görsel karşılığını denemek için** (kodda kalıcı anahtar yok):
`src/renderer.ts` içindeki `applyMaps()` fonksiyonunda
`physicalMaterial.thicknessMap = rg;` satırını geçici olarak
`= (set ?? fallback)?.r8 ?? null;` yapın. Materyal berrak cama döner —
`thicknessFactor` sıfırla çarpıldığı için hacim yutulması tamamen kapanır.

## Bilinen sınırlar

- **Kaçan ışın oranı sıfır değil.** `measurements-2026-09-02.jsonl`: candle
  6 / 17 / 79 (128² / 256² / 512²), blob 5 / 2.546 / 8.639 — yani %0,0011 /
  %0,0008 / %0,0009 ve %0,0010 / %0,1214 / %0,1030. Oran = `escapedRays /
  (texelsRasterized × rays)`. Sebep mesh'te delik değil, iki sayısal eşik:
  (1) lathe'in dikiş meridyeninde (`u = 0` ve `u = 0,5`) başlayıp aynı düzlemde
  ilerleyen ışın, iki komşu üçgenin ortak kenarına tam isabet edip her ikisinde de
  `u` `-3,1e-15` ile `-1,8e-16` arasında çıktığı için eleniyor (watertightness); (2) blob'un en geniş halkasında
  (`v ≈ 0,0215`) çıkış kesişimi gerçek ama `t` `2,9e-6` ile `1e-5` arasında, yani
  `intersectTriangle`'ın `t > 1e-5` kendine çarpma eşiğinin altında kalıyor —
  blob 256²'deki 2.546 kaçağın 2.530'u bu satırdan. İki mekanizma candle 128² +
  blob 256²'nin 2.552 kaçağının tamamını açıklıyor (2.530 + 22). BVH'nin payı yok: `--bvh=off` kaba kuvvet koşusu
  aynı sayıyı ve aynı `sha256`'yı veriyor. Sayaç önceden `t === Infinity`e bakıyordu
  ve ıska yolu `Infinity` değil tavanı döndürdüğü için her zaman 0 yazıyordu;
  ölçüt `t >= maxChord` olarak düzeltildi. Bu düzeltme yalnızca sayacı değiştirdi:
  iki kayıtta da haritaların `sha256`'sı ve `meanThicknessNormalized`'ı aynı,
  değişen tek alan `escapedRays`.
- **Kapsama %100, dilate 0 texel.** `LatheGeometry`'nin UV'si birim kareyi baştan
  sona kaplıyor ve çakışan ada yok; atlas paketleyici gerekmiyor. Gerçek bir
  taranmış modelde durum böyle olmaz — bu sayı seçimin sonucu, tekniğin marifeti
  değil. `dilate` yine de hattın içinde ve testleri var.
- **Lob taraması gürültü bandının altında kalıyor.** `power` ve `distortion`
  taramasında ölçülen GPU medyanları koşudan koşuya ±0,3 ms oynuyor; aradaki
  gerçek fark (varsa) bu bandın altında. Tabloyu "fark yok" diye okumak yerine
  "bu düzenekte ölçülemedi" diye okumak lazım.
- **Kalınlık haritası pişirme anının fotoğrafı.** Mesh deforme olursa harita
  eski gövdeyi anlatmaya devam eder ve hata mesajı gelmez.

## Dosya düzeni

```
src/
  bake/       attributes.ts · bvh.ts · dilate.ts · intersect.ts · raster.ts · sampling.ts
              trace.ts
  materials/  lambert.ts · physical.ts · sss.ts
  shaders/    fullscreen.vert · greenprobe.frag · lambert.frag · present.frag
              silhouette.frag · sss.frag · sss.vert · lib/translucency.glsl
  half.ts · hud.ts · luminance.ts · main.ts · measure.ts · mesh.ts · modes.ts
  pack.ts · probe.ts · renderer.ts · scene.ts · shaderLib.ts · stats.ts
  thickness.ts · timer.ts · translucency.ts · vec.ts · viewport.ts
tools/        bake-thickness.ts · bake-all.mjs · self-consistency.mjs
public/thickness/  candle-{128,256,512}.bin + .json · blob-{128,256,512}.bin + .json
test/         15 dosya + geometry.ts (test yardımcısı)
```

## Lisans

MIT — `LICENSE`.
