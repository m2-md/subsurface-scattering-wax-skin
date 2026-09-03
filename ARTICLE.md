# İçinden Işık Geçen Malzeme: Mum ve Ten için Gerçek Zamanlı Subsurface Scattering

*Elle yazılmış bir wrap lighting terimi, ışığı yüzeyin arkasından getiren bir geçirgenlik lobu ve Node'da offline pişirilmiş bir kalınlık haritası. Kontrol grubu olarak three'nin tek satırlık `MeshPhysicalMaterial` transmission yolu. Üçü aynı sahnede yan yana: GPU ms, VRAM, fırın süresi ve arkadan aydınlatmada gerçekten ölçülen parlaklık.*

*Tahmini okuma süresi: 21 dakika*

---

Telefonun fenerini avucumun arkasına dayadım. Parmaklarımın kenarı turuncu yandı, parmak aralarındaki ince perde neredeyse kırmızıydı, avuç içimin ortası ise kapkara kaldı.

İki koşul aynı anda tutuyordu: ışık arkada, malzeme ince. Birini bozunca efekt tamamen kayboluyor. Feneri öne alınca elim sıradan bir et rengine dönüyor; avucun kalın yerine tutunca ışık hiç çıkmıyor.

Bir Lambert yüzeyi bu kareyi çizemez. Işık arkadaysa `dot(N, L)` negatiftir, terim sıfıra kırpılır, yüzey siyah kalır. Klasik aydınlatma modeli tek bir soruya cevap veriyor: gelen ışığın ne kadarı geri sekiyor. Mum, ten, süt, mermer ve yaprak başka bir soruya cevap istiyor: ışık dışarı çıkmadan önce malzemenin içinde ne kadar yol aldı.

Bu yazı o ikinci sorunun gerçek zamanlı, kaba ve ölçülebilir bir cevabını kuruyor. Önce ışığın yüzeye girmesine izin veren wrap lighting terimini yazacağız, sonra ışığı yüzeyin arkasından geri getiren görüş-bağımlı geçirgenlik lobunu ekleyeceğiz. Üçüncü parça faturayı ödediğimiz yer: her texel'in altındaki malzemenin ne kadar kalın olduğunu bir kez, Node tarafında, ışın atarak hesaplayıp bir dokuya yazacağız. Sonuna doğru karşı tarafı kuruyoruz: three'nin hazır transmission yolu. İki yaklaşım aynı sahnede, aynı ışıkta, aynı GPU saatiyle tartılıyor.

Sürüm notu: `three@0.185.1` (tam sürüm sabitlenmiş), `WebGLRenderer`, ham GLSL ES 3.00, TypeScript, Vite, vitest; fırın adımı `vite-node` ile koşan bir Node CLI'ı. Saçılma matematiğinin tamamı elle yazılıyor, three burada sahne grafiği ve GL durum makinesi.

Peki hazır yol dururken bunca emek niye? Baştan söyleyeyim, `MeshPhysicalMaterial` üzerinde `transmission: 1` yazmak tek satır ve çoğu proje için doğru cevap o. Kırılma indisini, hacim rengini, pürüzlülüğü doğru kutulara koyunca cam, reçine ve kalın plastik için fazlasıyla ikna edici bir malzeme çıkıyor. Derdim onu gözden düşürmek değil. İki şeyi sayıya bağlamak: ne zaman ihtiyacımdan fazla geliyor ve ne zaman istediğim şeyi hiç veremiyor. İkincisinin cevabı beklediğimden net çıktı.

### Yüzeyin Altındaki Koridor

Opak bir materyalin shader'ında yüzey bir duvardır. Işık gelir, bir kısmı yansır, gerisi yutulur; olayın tamamı yüzeyin üstünde, kalınlığı sıfır olan bir noktada biter.

Yarı saydam malzemede yüzey bir koridor ağzıdır. Işık içeri girer, milyonlarca kez saçılır, rengini kaybede kaybede ilerler ve bambaşka bir noktadan dışarı çıkar. Gerçek subsurface scattering (yüzey altı saçılma) bu yolculuğu integre eder; gerçek zamanlı yaklaşımların tamamı ise o integrali tek bir sayıya indirger: yolun uzunluğu.

Bu, serideki iki kardeş yazıdan da farklı bir iş. Sıvı cam yazısında ışık sınırda **yön** değiştiriyordu; `refract()` ve IOR oradaydı. SDF raymarching yazısında ışın gerçekten adım adım yürüyordu. Burada ne yön değiştiriyoruz ne de ışın yürütüyoruz. İçeride ne olduğunu hiç simüle etmiyoruz; sadece "ışığın kat ettiği yol ne kadar uzun" sorusunun cevabını önceden bir dokuya yazıp, kare başına bir kez okuyoruz.

Bir de sınırı baştan koyalım. Bu yaklaşım ışığın nereden girip nereden çıktığını bilmez, sadece bulunduğunuz noktanın altında ne kadar malzeme olduğunu bilir. Işığı bir kulağın arkasından geçirmeye yeter; ama bir mermer heykelin köşesinde ışığın yanal olarak yayılmasını (diffusion profile, difüzyon profili) taklit edemez. Ekran uzayında bulanıklaştırma ile o iş de yapılır; başka bir yazının konusu.

Sonuç şu: elimizde üç parça olacak. Terminatörü kaydıran bir terim, ışığı arkadan getiren bir terim ve ikisini de besleyen bir kalınlık sayısı.

### Terminatörü Kaydıran İki Bölme

Lambert'in terminatörü (aydınlık ile karanlığın sınırı) serttir. `dot(N, L)` sıfırın altına düştüğü anda yüzey biter. Deride, mumda, sütte o sınır sert değildir; ışık yüzeyin hemen altına girip birkaç milimetre ilerledikten sonra çıktığı için karanlık tarafa taşar ve taşarken kızarır.

Wrap lighting (ışığı yüzeyin etrafına saran aydınlatma) bu taşmayı tek bir bölmeyle taklit ediyor:

```glsl
// src/shaders/lib/translucency.glsl
// Pay terminatörü kaydırır, payda toplam enerjiyi yerinde tutar.
// wrap = 0 verildiğinde fonksiyon birebir Lambert'e döner.
float wrapDiffuse(float ndl, float wrap) {
  float w = max(wrap, 0.0);
  return clamp((ndl + w) / ((1.0 + w) * (1.0 + w)), 0.0, 1.0);
}
```

Paydaki `+ w`, karanlık sınırını `dot(N, L) = -w` noktasına itiyor. `w = 0.5` ile yüzey, ışığa 120 dereceye kadar dönmüş olsa bile hâlâ biraz aydınlık kalıyor. Paydadaki `(1 + w)²` ise bedavaya gelen enerjiyi geri alıyor: kaydırma yapıp normalize etmezseniz malzeme her yerde parlar ve efekt "yarı saydam" değil "biraz fazla pozlanmış" görünür.

Aynı fonksiyonun TypeScript ikizi `src/translucency.ts` içinde duruyor ve testi sınır koşullarını çiviliyor:

```ts
// test/translucency.test.ts (parça)
import { describe, expect, it } from "vitest";
import { backTranslucency, wrapDiffuse } from "../src/translucency";

describe("wrapDiffuse", () => {
  it("wrap = 0 iken Lambert ile birebir aynıdır", () => {
    for (const ndl of [-1, -0.5, -0.001, 0, 0.001, 0.5, 1]) {
      expect(wrapDiffuse(ndl, 0)).toBeCloseTo(Math.max(ndl, 0), 12);
    }
  });

  it("terminatör tam olarak ndl = -wrap noktasında biter", () => {
    for (const w of [0.1, 0.35, 0.8, 1]) {
      expect(wrapDiffuse(-w, w)).toBe(0);
      expect(wrapDiffuse(-w + 1e-3, w)).toBeGreaterThan(0);
    }
  });

  it("tepe parlaklığı 1/(1+w)'ye iner: kaydırma bedava değil", () => {
    for (const w of [0.25, 0.5, 1]) {
      expect(wrapDiffuse(1, w)).toBeCloseTo(1 / (1 + w), 12);
    }
  });
});
```

Üçüncü test bu terimin dürüstlük sınavı. `w` büyüdükçe karanlık taraf açılıyor ama aydınlık taraf sönüyor; toplam ışık yaratmıyorsunuz, sadece dağıtıyorsunuz.

Wrap tek başına da ten için epeyce iş görüyor, o yüzden yıllardır kullanılıyor. Ama bir eksiği var: kameranın nerede durduğunu umursamaz. Elinizi fenerin önünde çevirdiğinizde parlayan kenarın yer değiştirmesi wrap'ten çıkmaz. Onun için ikinci terime ihtiyaç var.

### Işığı Arkadan Getiren Terim

Fenerin karşısındaki elde gördüğünüz kızıllık, ışığın malzemeye girip **kameraya doğru** yol alıp çıkmasıydı. Demek ki aradığımız şey ışık yönüne değil, ışığın tam tersine bakan bir lob (lobe, hüzme). DICE'ta Colin Barré-Brisebois ile Marc Bouchard'ın 2011 GDC'sinde anlattığı "fast subsurface scattering" yaklaşımı tam olarak bunu yapıyor ve üç satıra sığıyor:

```glsl
// src/shaders/lib/translucency.glsl
// lightDir: yüzeyden IŞIĞA doğru, birim. viewDir: yüzeyden KAMERAYA doğru, birim.
// thickness: [0,1] aralığında normalize edilmiş yol uzunluğu (1 = en kalın).
float backTranslucency(vec3 lightDir, vec3 normal, vec3 viewDir, float thickness,
                       float distortion, float power, float scale,
                       float ambient, float absorption) {
  // Işığı normal boyunca biraz bükerek "içeriden çıkıyormuş" hissi veriyoruz.
  vec3 h = normalize(lightDir + normal * distortion);
  float lobe = pow(clamp(dot(viewDir, -h), 0.0, 1.0), power) * scale;
  // Beer-Lambert: yol uzadıkça geçen ışık üstel olarak azalır.
  return (lobe + ambient) * exp(-absorption * thickness);
}
```

`-h` vektörü işin bütün sırrı. Işık tam arkadaysa `lightDir` kameradan uzağa bakar, `-h` de kameraya döner ve nokta çarpım bire koşar: lob patlar. Işık öne geçtiğinde `dot(viewDir, -h)` negatife düşer, kırpılır, terim sadece `ambient` katkısı kadar kalır. Efekt kendiliğinden doğru zamanda ortaya çıkıyor ve doğru zamanda kayboluyor; hiçbir yerde "ışık arkada mı" diye if yazmadık.

`distortion` ışığı yüzey normali boyunca büküyor. Sıfırda lob tamamen ışığın tersine bakar ve efekt siluetin her yerinde aynı olur; büyüttükçe lob yüzeyin eğimine göre kayar ve kıvrımlar belirginleşir. `power` lobun keskinliği: küçük değerde bütün nesne kızarır, büyük değerde sadece ışığın tam karşısındaki kenarlar yanar.

Sınır koşulları burada da tarayıcısız sınanabiliyor:

```ts
// test/translucency.test.ts (parça)
const P = { distortion: 0, power: 4, scale: 1, ambient: 0, absorption: 0 };

it("ışık tam arkadayken lob tepe değerini verir", () => {
  // Kamera +z'de, ışık -z'de: yüzeyden ışığa doğru vektör -z.
  const value = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 0, P);
  expect(value).toBeCloseTo(P.scale, 12);
});

it("ışık tam öndeyken terim ambient'e iner", () => {
  const value = backTranslucency([0, 0, 1], [0, 0, 1], [0, 0, 1], 0, {
    ...P,
    ambient: 0.05,
  });
  expect(value).toBeCloseTo(0.05, 12);
});

it("kalınlık arttıkça üstel olarak sönümlenir", () => {
  const thin = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 0.0, {
    ...P,
    absorption: 3,
  });
  const thick = backTranslucency([0, 0, -1], [0, 0, 1], [0, 0, 1], 1.0, {
    ...P,
    absorption: 3,
  });
  expect(thin).toBeCloseTo(1, 12);
  expect(thick).toBeCloseTo(Math.exp(-3), 12);
});
```

Orijinal formülasyon sönümlemeyi doğrusal yapar (`* (1 - thickness)`). Ben üstelini tercih ettim çünkü tek bir `absorption` uniform'uyla malzemenin karakterini değiştirebiliyorsunuz: küçük değerde saydam bir jel, büyük değerde sadece en ince kenarları parlayan bir mermer. Doğrusal olanla aradaki fark küçük ve gözle bakınca kimse ayırt etmiyor, ama üstel olanın sıfır kalınlıkta tam olarak 1 vermesi testi kolaylaştırıyor.

### Yolun Uzunluğu Nereden Geliyor

Buraya kadar her şey birkaç ALU komutu. Şimdi asıl soruya geldik: `thickness` değerini kim üretiyor?

Üç yol var. Birincisi sabit bir sayı vermek — nesnenin her yeri aynı kalınlıkta sayılır, sonuç gözle bakınca "efekt var ama yerini şaşırmış" görünür. İkincisi çalışma zamanında ölçmek: nesnenin arka yüzlerini ayrı bir derinlik geçişine çizip ön yüzle arasındaki farkı okumak. Bu doğru bir yöntem ve deforme olan mesh'lerde çalışan tek yöntem, ama sahneyi bir kez daha çizmek demek.

Üçüncüsü, bu yazının seçtiği yol: kalınlığı bir kere, offline, ışın atarak hesaplayıp UV uzayında bir dokuya yazmak. Karede bir doku okuması, kurulumda bir fırın turu.

Haritanın hangi yöne baktığını baştan sabitleyelim, çünkü burada işaret hatası yapmak çok kolay:

> Dokuda saklanan değer **yolun uzunluğu**dur. Beyaz = kalın = ışık zor geçer. Siyah = ince = ışık kolay geçer.

Bu konvansiyonu bir kere yazıp her yerde ona sadık kalmak gerekiyor. Ben ilk denememde tersini yapmıştım, çünkü ekranda gördüğüm harita "parlayan yerler beyaz olsun" sezgime uyuyordu. Mum ters yandı: gövdenin kalın ortası ışıldadı, ince rim kapkara kaldı. Hata hiçbir yerde hata gibi görünmüyor, çünkü çıkan görüntü hâlâ makul bir mum görüntüsü. Sadece yanlış mum.

### Her Texel'in Altındaki Nokta

Fırın iki aşamalı. Önce her texel'in hangi yüzey noktasına karşılık geldiğini bulmamız, sonra o noktadan içeri ışın atmamız gerekiyor.

Birinci aşama, mesh'i UV uzayında rasterize etmek. Her üçgenin üç UV köşesini doku koordinatlarına çevirip aradaki texel'leri dolduruyoruz; her texel için baryantrik ağırlıklarla dünya konumunu ve normalini aradeğerliyoruz.

```ts
// src/bake/raster.ts
const EDGE = 1e-6; // texel merkezi kenarın tam üstündeyse elemeyelim

export function rasterizeTriangle(
  size: number,
  a: Vec2,
  b: Vec2,
  c: Vec2,
  emit: (texel: number, wa: number, wb: number, wc: number) => void,
): number {
  // Texel merkezi (x + 0.5, y + 0.5) noktasında; koordinatı yarım kaydırıyoruz.
  const ax = a[0] * size - 0.5;
  const ay = a[1] * size - 0.5;
  const bx = b[0] * size - 0.5;
  const by = b[1] * size - 0.5;
  const cx = c[0] * size - 0.5;
  const cy = c[1] * size - 0.5;

  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-12) return 0; // kutupta dejenere üçgenler var
  const inv = 1 / area;

  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));

  let written = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const wa = ((bx - x) * (cy - y) - (by - y) * (cx - x)) * inv;
      const wb = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) * inv;
      const wc = 1 - wa - wb;
      if (wa < -EDGE || wb < -EDGE || wc < -EDGE) continue;
      emit(y * size + x, wa, wb, wc);
      written++;
    }
  }
  return written;
}
```

Y ekseninde çevirme yok. Bilinçli bir karar. `THREE.DataTexture` varsayılan olarak `flipY = false` ile geliyor; dizinin ilk satırı GL tarafında `v = 0` oluyor. Fırında da ilk satırı `v = 0` kabul edersek iki taraf uyuşuyor. Bir tarafta çevirip diğerinde çevirmezseniz harita dikey olarak aynalanır ve mum tepesinden değil dibinden parlamaya başlar.

Bu aşamanın bir de kapsama sorunu var. Üçgen kenarına denk gelen texel'lerin merkezi çoğu zaman üçgenin dışında kalıyor ve boş kalan bu texel'ler bilinear örneklemede kenarda siyah bir çizgi olarak geri dönüyor. Klasik çözüm dilate (genişletme): boş bir texel'in dolu komşusu varsa değeri oradan kopyalamak.

```ts
// src/bake/dilate.ts
// Dolu komşuların ortalamasını boş texel'e taşır. Kaç texel dolduğunu döndürür.
export function dilate(
  values: Float32Array,
  filled: Uint8Array,
  size: number,
  passes: number,
): number {
  let total = 0;
  for (let pass = 0; pass < passes; pass++) {
    const before = filled.slice();
    let touched = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (before[i] === 1) continue;
        let sum = 0;
        let count = 0;
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const j = ny * size + nx;
          if (before[j] !== 1) continue;
          sum += values[j];
          count++;
        }
        if (count === 0) continue;
        values[i] = sum / count;
        filled[i] = 1;
        touched++;
      }
    }
    total += touched;
    if (touched === 0) break;
  }
  return total;
}
```

`before` kopyası olmadan bu fonksiyon bir geçişte bütün dokuyu yayar, çünkü aynı taramada doldurduğunuz texel bir sonraki komşuya kaynak olur. Sonuç kenardan içeri doğru sürüklenen bir bulaşma oluyor. Kopyayı almak geçiş başına bir `slice()` maliyeti; harita 256² iken kimsenin umurunda değil.

Bir not daha: bu projede UV paketleyici (atlas packer) yok. İki mesh de `LatheGeometry` ile üretiliyor ve lathe'in UV'si birim kareyi baştan sona kaplıyor, çakışan ada yok. Gerçek bir taranmış kafa modelinde durum böyle olmaz; orada ada ada yerleşim ve ada başına kenar payı gerekir. Ölçtüğümüz kapsama oranının yüksek çıkması bu seçimin sonucu, tekniğin marifeti değil: 256'lık haritada texel'lerin %100'ü rasterizasyonda doluyor, dilate'in kapatacağı boşluk hiç kalmıyor (0 texel). Dilate fonksiyonu kodda duruyor ama bu mesh'te işsiz — çakışmayan, boşluksuz bir UV atlası verdiğiniz sürece güvenceye ihtiyacınız olmuyor; adalı bir gerçek modelde aynı satır sıfırdan farklı bir sayı görecek.

Mesh'in kendisi de dikkat isteyen bir yerde. Profil eğrisi eksende başlayıp eksende bitmezse gövde kapanmaz, ışınlar içeriden dışarı kaçar ve harita çöp olur:

```ts
// src/mesh.ts (parça)
// LatheGeometry profili: x = eksene uzaklık, y = yükseklik.
// İlk ve son nokta x = 0 olmak ZORUNDA — yoksa gövde açık kalır.
export function candleProfile(steps = 48): THREE.Vector2[] {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -1)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -1 + 2 * t;
    const body = 0.52 + 0.22 * Math.sin(Math.PI * Math.min(t * 1.15, 1));
    const neck = 0.56 * smoothstep(0.68, 0.97, t); // tepede incelen rim
    points.push(new THREE.Vector2(Math.max(body - neck, 0.06), y));
  }
  points.push(new THREE.Vector2(0, 1));
  return points;
}
```

Bu profil 9.600 üçgenlik kapalı bir gövde veriyor: dibi kalın, boynu ince, tepesindeki rim neredeyse şeffaf olacak kadar dar. Işığı arkasına aldığınızda sırayla o rim, sonra boyun, en son gövde aydınlanıyor.

### İçeriye Doğru Otuz İki Işın

İkinci aşama asıl hesap. Elimizde bir yüzey noktası ve normali var; oradan malzemenin içine doğru bir demet ışın atıp her birinin karşı duvara ne kadar mesafede çarptığını ölçüyoruz. Ortalama, o texel'in kalınlığı.

Yönleri rastgele seçmiyoruz. `Math.random` fırının çıktısını koşudan koşuya değiştirir ve iki bake'i karşılaştırmayı imkânsız kılar. Yerine Hammersley dizisi kullanıyoruz: deterministik, düşük uyumsuzluklu ve test edilebilir.

```ts
// src/bake/sampling.ts
export function radicalInverse2(index: number): number {
  let bits = index >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10; // 1 / 2^32
}

// Duff ve arkadaşlarının dallanmayan ortonormal bazı: n'e dik iki vektör.
export function orthonormalBasis(n: Vec3): [Vec3, Vec3] {
  const sign = n[2] >= 0 ? 1 : -1;
  const a = -1 / (sign + n[2]);
  const b = n[0] * n[1] * a;
  return [
    [1 + sign * n[0] * n[0] * a, sign * b, -sign * n[0]],
    [b, sign + n[1] * n[1] * a, -n[1]],
  ];
}

// Kosinüs ağırlıklı yarım küre örneği: yüzeye yakın yönler daha seyrek.
export function cosineDirection(u1: number, u2: number, n: Vec3): Vec3 {
  const [t, bt] = orthonormalBasis(n);
  const r = Math.sqrt(u1);
  const phi = 2 * Math.PI * u2;
  const x = r * Math.cos(phi);
  const y = r * Math.sin(phi);
  const z = Math.sqrt(Math.max(0, 1 - u1));
  return [
    t[0] * x + bt[0] * y + n[0] * z,
    t[1] * x + bt[1] * y + n[1] * z,
    t[2] * x + bt[2] * y + n[2] * z,
  ];
}
```

Işınları `-N` etrafındaki yarım küreye, doğrudan malzemenin içine atıyoruz. Kosinüs ağırlığı burada fiziksel bir gerekçeden çok pratik bir tercih: yüzeye teğet yönler kalınlık hakkında az şey söylüyor ve gürültüyü artırıyor.

Kesişim testi Möller-Trumbore. Tek dikkat noktası: ön yüz elemesi (backface culling) **kapalı** olmak zorunda, çünkü içeriden bakınca karşı duvarın arkasını görüyoruz.

```ts
// src/bake/intersect.ts
// Üçgenler 9'ar float hâlinde düz bir dizide duruyor; i, üçgenin başlangıç indeksi.
// Dönüş: kesişim mesafesi ya da Infinity. Çift yönlü — det'in işaretine bakmıyoruz.
export function intersectTriangle(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tris: Float32Array,
  i: number,
): number {
  const ax = tris[i],
    ay = tris[i + 1],
    az = tris[i + 2];
  const e1x = tris[i + 3] - ax,
    e1y = tris[i + 4] - ay,
    e1z = tris[i + 5] - az;
  const e2x = tris[i + 6] - ax,
    e2y = tris[i + 7] - ay,
    e2z = tris[i + 8] - az;

  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity; // ışın üçgenin düzlemine paralel

  const inv = 1 / det;
  const tx = ox - ax,
    ty = oy - ay,
    tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;

  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;

  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-5 ? t : Infinity; // arkamızdaki ve ayağımızın dibindeki kesişim sayılmaz
}
```

Son satırdaki `1e-5` kendine çarpmayı engelliyor. Işın yüzeyin tam üstünden başlıyor ve epsilon olmadan çıktığı üçgene sıfır mesafede çarpıyor; kalınlık haritası tamamen siyah çıkıyor. Bu hatayı yaparsanız ekranda gördüğünüz şey "efekt çalışmıyor" değil, "efekt her yerde aynı" oluyor.

Her ışını bütün üçgenlere karşı denemek mümkün, ama fırını saatlerce çalıştırır. Üçgenleri bir BVH'ye (bounding volume hierarchy, sınırlayıcı hacim hiyerarşisi) koyuyoruz: en uzun eksende ortanca bölmeyle kurulan, yaprakları dörder üçgen tutan bir ağaç. Kurulumu `src/bake/bvh.ts` içinde; makaleye giren kısım gezinti döngüsü:

```ts
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
```

`slabDistance` içinde klasik bir NaN tuzağı var. Işın bir eksene tam paralel olduğunda `1 / d` sonsuz oluyor ve kutunun o eksendeki sınırı ışının başlangıcıyla çakışırsa `0 * Infinity = NaN` çıkıyor. `Math.min` ve `Math.max` NaN'i sessizce yayıyor, sonuç "bu kutuya hiç girilmedi" oluyor ve haritada tek texel'lik kara noktalar beliriyor.

Beni yakan tuzak bu değildi. Sinsi olanı `1 / d`nin sonsuz değil sadece devasa olduğu hâl: yön bileşeni `3.422991864151267e-17` gibi bir artık, ışının başlangıcı da kutunun `max` düzleminin tam üstünde. `hi = (max - o) * inv` tam olarak 0 çıkıyor, `tmax` sıfıra kelepçeleniyor ve gerçek kesişimi taşıyan düğüm eleniyor. NaN yok, uyarı yok, sadece eksik bir duvar. Çözüm eşik tabanlı sağlam slab testi: `|1 / d|` `PARALLEL_INV = 1e9`'u aşıyorsa o eksen hiç kısıt üretmiyor, yalnızca başlangıcın dilimin içinde olması isteniyor (`SLAB_EPS = 1e-6` payıyla). Tam paralel ile neredeyse paralel aynı yoldan geçiyor ve çarpım hiç yapılmadığı için `0 * Infinity` de doğmuyor. Testte iki vaka ayrı ayrı duruyor: eksene tam paralel demet, bir de o tek regresyon ışını.

Fırının çekirdek döngüsü artık üç satır:

```ts
// src/bake/trace.ts (parça)
const origin: Vec3 = [0, 0, 0];
let escaped = 0;

for (let i = 0; i < texelCount; i++) {
  if (filled[i] !== 1) continue;
  const p = positions.subarray(i * 3, i * 3 + 3);
  const n = normals.subarray(i * 3, i * 3 + 3);
  // Işını yüzeyin bir tık altından başlat; aksi hâlde ilk kesişim kendisidir.
  origin[0] = p[0] - n[0] * ORIGIN_EPS;
  origin[1] = p[1] - n[1] * ORIGIN_EPS;
  origin[2] = p[2] - n[2] * ORIGIN_EPS;

  let sum = 0;
  for (let r = 0; r < rays; r++) {
    const u1 = (r + 0.5) / rays;
    const u2 = radicalInverse2(r);
    const [dx, dy, dz] = cosineDirection(u1, u2, [-n[0], -n[1], -n[2]]);
    const t = bvh
      ? bvh.intersect(origin[0], origin[1], origin[2], dx, dy, dz, maxChord)
      : bruteForceIntersect(tris, origin, [dx, dy, dz], maxChord);
    // Iska `Infinity` DEĞİL: iki kesişim yolu da `let best = tMax` ile
    // başlayıp ıskaladığında tavanı döndürüyor. Ölçüt bu yüzden `>= maxChord`.
    if (t >= maxChord) escaped++; // kapalı gövdede olmaması gereken durum
    sum += Math.min(t, maxChord);
  }
  raw[i] = sum / rays;
}
```

Kaçan ışın sayısı bir kalite göstergesi. Kapalı bir gövdenin içinden atılan ışın mutlaka bir duvara çarpar; çarpmıyorsa ya mesh'te delik var, ya normal ters, ya da sayacın kendisi bozuk.

Bu yazının ilk hâlinde oranı "tam olarak 0" diye yazmıştım. Yanlıştı. Sayaç `t === Infinity` diye bakıyordu, oysa her iki kesişim yolu da `let best = tMax` ile başlayıp ıskaladığında `Infinity` değil tavanı döndürüyor: sayaç ölüydü, her koşuda zorunlu olarak sıfır veriyordu. Sıfır da insanı en çabuk rahatlatan sayıdır. Ölçütü `t >= maxChord` yapıp fırını yeniden koşturunca gerçek tablo çıktı:

| Fırın | Toplam ışın | Kaçan ışın | Oran |
|---|---|---|---|
| candle 128² | 524.288 | 6 | %0,0011 |
| candle 256² | 2.097.152 | 17 | %0,0008 |
| candle 512² | 8.388.608 | 79 | %0,0009 |
| blob 128² | 524.288 | 5 | %0,0010 |
| blob 256² | 2.097.152 | 2.546 | %0,1214 |
| blob 512² | 8.388.608 | 8.639 | %0,1030 |

Toplam ışın doğrudan `dolu texel × ışın`; kapsama %100 olduğu için `çözünürlük² × 32`. Mumda oran yüz binde bir mertebesinde, damlada 256² ve 512²'de binde bire çıkıyor.

Peki bu ışınlar nereden kaçıyor? Hepsini tek tek izledim; karşıma iki ayrı mekanizma çıktı ve ikisi de mesh'teki bir delik değil.

Mumun 128² koşusundaki altı kaçağın altısı da alt ya da üst kapak bandındaki bir texel'den çıkıyor ve altısının da başlangıç noktası `x = 0` düzleminde duruyor: lathe'in dikiş meridyeni (`u = 0`) ve tam karşısındaki meridyen (`u = 0,5`). O texel'lerde kosinüs örneğinin verdiği yönün `x` bileşeni de `-6e-17` mertebesinde, yani ışın o düzlemin içinde ilerliyor. Karşı duvara vardığında iki komşu üçgenin ortak kenarına tam isabet ediyor; Möller-Trumbore ikisinde de `u`yu `-3,1e-15` ile `-1,8e-16` arasında hesaplayıp ikisini birden eliyor. Ders kitabı su geçirmezlik (watertightness) sorunu.

Damlanın 256² koşusundaki 2.546 kaçağın 2.530'u ise tek bir texel satırında toplanmış: `v ≈ 0,0215`, gövdenin en geniş halkası. O satırın 256 texel'inin hepsi kaçak veriyor, texel başına 32 ışının ortalama 9,9'u. Orada ışın duvarı gerçekten buluyor (örnek bir texel'de `u = 0,1875`, `v = 0,0768` ile üçgenin tam içi) ama mesafe 2.530'unun hepsinde `2,9e-6` ile `1e-5` arasında — yukarıdaki kendine çarpma eşiğinin (`t > 1e-5`) hemen altında. Haritayı simsiyah olmaktan kurtaran koruma, o halkada meşru bir duvarı yiyor.

Bu iki koşunun 2.552 kaçağını tek tek sınıflandırdım: 2.530'u eşik altı çıkış, 22'si ortak kenar isabeti. Sınıflandırılamayan tek ışın kalmadı.

BVH'nin suçu değil: aynı fırını `--bvh=off` ile kaba kuvvetle koşturdum, kaçan ışın yine 6 ve çıktının `sha256`'sı birebir aynı. Kaçan ışınların başlangıç noktalarını ayrıca bir parite testinden geçirdim, hepsi gövdenin içinde. Delik yok; sayısal eşikler var.

İşin can alıcı yanı şu: sayacı düzeltmek çıktıyı değiştirmedi. Eski ve yeni kayıtta haritaların `sha256`'sı ve `meanThicknessNormalized`'ı bayt bayt aynı; değişen tek alan `escapedRays`. Yani düzeltme haritayı değil, iddianın kanıtını düzeltti. Sınanmayan gösterge ölür, ölü gösterge de tam duymak istediğiniz sayıyı fısıldar.

Son adım normalizasyon. Ham değerler dünya birimi cinsinden mesafe; sekiz bite sığdırmak için gözlenen en büyük ortalamaya bölüyoruz ve gerçek karşılığını meta dosyasına yazıyoruz. Bu mesh'te en kalın texel'in ortalama yolu 1,120093 birim, normalize edilmiş haritanın ortalaması 0,852784.

### Fırın Ne Kadar Sürüyor

Fırın `vite-node` ile koşan bir CLI ve bitince stdout'a tek satır JSON basıyor:

```bash
npm run bake -- --mesh=candle --res=256 --rays=32
# BAKE {"mesh":"candle","triangles":9600,"resolution":256,"rays":32,...}
```

Çözünürlük taraması işin karakterini gösteriyor. Texel sayısı dörde katlanıyor, ışın sayısı sabit; dolayısıyla toplam ışın sayısı da dörde katlanıyor.

| Çözünürlük | BVH kurma ms | Rasterizasyon ms | Işın ms | Toplam ms | Atılan ışın | Çıktı baytı |
|---|---|---|---|---|---|---|
| 128² | 21,005 | 8,211 | 1.517,832 | 1.549,352 | 524.288 | 16.384 |
| 256² | 20,865 | 10,161 | 5.655,54 | 5.691,283 | 2.097.152 | 65.536 |
| 512² | 23,977 | 14,968 | 21.048,017 | 21.095,395 | 8.388.608 | 262.144 |

BVH kurma süresi üç satırda da aynı, çünkü mesh değişmiyor. Rasterizasyon texel sayısıyla büyüyor ama ucuz kalıyor. Fatura ışın sütununda ve orada iki çarpan var: texel sayısı ve ışın sayısı. İkincisini de tarayabiliyoruz: 256² haritada ışın sayısını 16'dan 64'e çıkarmak süreyi 2.821,589'den 11.478,595'ye taşıyor.

BVH'nin ne kadar iş yaptığını görmek için aynı fırını ağaçsız da koşturuyoruz. Kaba kuvvet yolu her ışını 9.600 üçgenin hepsine deniyor, o yüzden kıyası küçük bir yapılandırmada yapmak gerekiyor: 64² harita, 8 ışın.

| Yol | 64² × 8 ışın süresi |
|---|---|
| Kaba kuvvet (bütün üçgenler) | 5.733,145 |
| BVH (yaprak = 4 üçgen) | 119,466 |

Bu iki satırdan çıkan oranı büyük yapılandırmalara uzatmayın; BVH'nin kazancı üçgen sayısıyla logaritmik büyüyor ve ben yalnızca tek bir mesh ölçtüm. Söyleyebileceğim tek şey, ağaç olmadan 512² fırınının benim sabrımı aştığı.

Fırın çıktısı `public/thickness/` altına iki dosya bırakıyor: ham `.bin` ve yanına bir meta JSON. PNG kodlayıcı yok, bağımlılık yok; sekiz bitlik gri bir dizi zaten tam olarak bu.

### Sekiz Bit ve Yeşil Kanal

Dokuyu tarayıcıya alırken tek kanallı bırakıyoruz. R8 formatı texel başına bir bayt tutuyor ve WebGL2'de filtrelenebiliyor:

```ts
// src/thickness.ts
export async function loadThickness(
  url: string,
  size: number,
): Promise<THREE.DataTexture> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `kalınlık haritası bulunamadı: ${url} — önce "npm run bake"`,
    );
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length !== size * size) {
    throw new Error(`beklenen ${size * size} bayt, gelen ${data.length}`);
  }

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping; // u ekseni gövdenin etrafında dönüyor
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
```

`DataTexture` kurucusu iki ayarı bizim için doğru yapıyor: `flipY = false` ve `unpackAlignment = 1`. İkincisi tek kanallı dokularda kritik. Varsayılan hizalama 4'tür ve R8 bir dokuda satır genişliği dördün katı değilse GL her satırı biraz kaydırarak okur; harita eğik bir tarama gibi görünür. Bizim genişliklerimiz zaten ikinin kuvveti, ama kendi `Texture`'ınızı elle kurarsanız bu satır sizi bulur.

Kontrol grubunu kurarken burada bir duvara çarptım. three'nin `MeshPhysicalMaterial`'ı da kalınlık haritası kabul ediyor, ama `thicknessMap`'in **yeşil** kanalını okuyor (glTF'in `KHR_materials_volume` uzantısı böyle tanımlamış). R8 bir dokudan yeşil kanal örneklerseniz WebGL2 size sıfır verir; `thicknessFactor` sıfırla çarpılır, hacim yutulması tamamen kapanır ve malzeme mumdan berrak cama döner. Ölçüm modunda bu değeri okuyup rapora yazıyoruz: aynı doku, aynı UV, yeşil kanaldan gelen kalınlık 0.

Çözüm haritayı yeniden pişirmek değil, yüklerken genişletmek. Aynı baytı R ve G kanallarına yazan bir RG8 kopyası çıkarıyoruz; fırın hâlâ tek dosya üretiyor, GPU'da iki temsil duruyor:

```ts
// src/thickness.ts (parça)
// three'nin thicknessMap'i .g okuyor; tek kanallı harita orada sıfır döner.
export function expandToRG(data: Uint8Array, size: number): THREE.DataTexture {
  const rg = new Uint8Array(size * size * 2);
  for (let i = 0; i < size * size; i++) {
    rg[i * 2] = data[i];
    rg[i * 2 + 1] = data[i];
  }
  const texture = new THREE.DataTexture(
    rg,
    size,
    size,
    THREE.RGFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
```

Bedeli iki kat bayt. Alternatifi RGBA8'e genişletmekti; o dört kat ederdi ve iki kanalı boşuna taşırdık.

Fragment shader tarafı artık kısa. Modlar hata ayıklama için: haritayı çıplak göster, sadece geçirgenlik terimini göster, sadece wrap terimini göster.

```glsl
// src/shaders/sss.frag.glsl (parça)
void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(cameraPosition - vWorldPosition);
  vec3 l = normalize(uLightDirection);

  float thickness = uUseMap == 1
    ? texture(uThickness, vUv).r
    : uConstantThickness;

  if (uMode == MODE_THICKNESS) {
    outColor = vec4(vec3(thickness), 1.0);
    return;
  }

  vec3 diffuse = uAlbedo * uLightColor * wrapDiffuse(dot(n, l), uWrap);

  float back = backTranslucency(l, n, v, thickness, uDistortion,
                                uPower, uScale, uAmbient, uAbsorption);
  vec3 transmitted = uInteriorColor * uLightColor * back;

  vec3 h = normalize(l + v);
  float spec = pow(max(dot(n, h), 0.0), uShininess) * uSpecular
             * step(0.0, dot(n, l));

  if (uMode == MODE_TRANSMISSION) { outColor = vec4(transmitted, 1.0); return; }
  if (uMode == MODE_WRAP) { outColor = vec4(diffuse, 1.0); return; }

  // Doğrusal uzayda yazıyoruz; sRGB dönüşümü sondaki present geçişinde.
  outColor = vec4(diffuse + transmitted + spec, 1.0);
}
```

Specular terimindeki `step(0.0, dot(n, l))` çarpanı ışık arkadayken parlamayı kapatıyor. Yumuşattığımız şey difüz taraf; yüzeyin cilası ışığı arkadan alamaz ve o çarpan olmadan mumun arka kenarında olmaması gereken bir vurgu çıkıyor.

Renk uzayı konusunda da bir karar var. Bütün çizim doğrusal (linear) bir ara hedefe yapılıyor, sRGB kodlaması sondaki tek geçişte bir kez uygulanıyor. Bunun sebebi estetik değil ölçüm: parlaklık ortalamasını sRGB kodlanmış piksellerden alırsanız karanlık bölgelerde sayı olduğundan büyük çıkar ve tam da bu yazının merak ettiği aralık orası.

### Tek Satır: `transmission: 1`

Şimdi karşı tarafı kuralım. three'nin fiziksel materyali aynı işi kendi yoluyla yapıyor ve kurulumu gerçekten kısa:

```ts
// src/materials/physical.ts
export function createPhysicalMaterial(
  thicknessRG: THREE.Texture | null,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffe6c4),
    roughness: 0.35,
    metalness: 0,
    ior: 1.45, // mum ~1,45
    transmission: 1, // ışık gövdeden geçsin
    thickness: 1.2, // dünya birimi
    attenuationColor: new THREE.Color(0xff7a3c), // içeride kızaran renk
    attenuationDistance: 0.6,
  });
  // three bu haritanın YEŞİL kanalını okur; R8 harita burada sıfır döner.
  material.thicknessMap = thicknessRG;
  return material;
}
```

Bu yolun asıl maliyeti materyalin kendisinde değil. Sahnede `transmission > 0` olan bir materyal varsa `WebGLRenderer` kareyi çizmeden önce opak nesneleri ayrı bir render hedefine çiziyor, o hedefin mipmap'lerini üretiyor ve materyal arka planı oradan örnekliyor. Sahne iki kez çiziliyor, üstüne her karede mipmap zinciri kuruluyor. Ölçümde çizim çağrısı sütununun neden ikiye katlandığını da bu açıklıyor.

İki yolun aynı görüntüyü üretmediğini baştan söyleyeyim. three'nin materyali fiziksel tabanlı bir BRDF (yansıma dağılım fonksiyonu); ışık şiddeti başka birimlerde, tone mapping devre dışı, enerji dağılımı bambaşka. Piksel piksel karşılaştırma yapmıyoruz. Karşılaştırdığımız şey maliyet ve davranış, hatta tek bir davranış: ışık arkaya geçtiğinde ne oluyor.

### Mum Yansın, Dizüstü Yanmasın

Elle yazdığımız shader ucuz. Pahalı olan yanındaki kontrol grubu: sahne bir kez daha çiziliyor ve her karede bir mipmap zinciri kuruluyor. Bu yükü ziyaretçinin donanımına serbestçe devretmemek için arka tamponun boyutuna üç ayrı tavan koydum.

```ts
// src/viewport.ts
export const MAX_DPR = 2;
export const MAX_PIXELS = 1_200_000;

export function backingSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  scale: number,
) {
  const clampedDpr = Math.min(Math.max(dpr, 1), MAX_DPR);
  const clampedScale = Math.min(Math.max(scale, 0.25), 1);
  const width = Math.max(1, Math.round(cssWidth * clampedDpr * clampedScale));
  const height = Math.max(1, Math.round(cssHeight * clampedDpr * clampedScale));
  return fitPixelBudget(width, height);
}

export function fitPixelBudget(
  width: number,
  height: number,
  budget = MAX_PIXELS,
) {
  const total = width * height;
  if (total <= budget) return { width, height };
  const factor = Math.sqrt(budget / total);
  return {
    width: Math.max(1, Math.floor(width * factor)),
    height: Math.max(1, Math.floor(height * factor)),
  };
}
```

Üç tavan sırasıyla şunlar: `devicePixelRatio` en fazla iki sayılıyor, çözünürlük ölçeği 0,75'ten başlıyor ve toplam piksel sayısı 1,2 milyonu geçemiyor. Retina bir ekranda tam ekrana geçmek bu yüzden faturayı dört katına çıkarmıyor. Dördüncü korkuluk ise çizim döngüsünün kendisinde duruyor:

```ts
// src/main.ts (parça)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setRunning(false);
});
```

Arka plandaki bir sekmede tarayıcı `requestAnimationFrame`'i zaten seyreltiyor. Seyreltmesi yetmiyor: bu satırın asıl işi ölçüm hijyeni. Gizli sekmede toplanan kare süreleri hiçbir şey ifade etmiyor ve o tuzağa seride bir kez düştüğüm için artık peşinen kapatıyorum.

Sahne de mütevazı kalsın istedim: 960 piksel genişliğinde 16:9'luk bir kutuda tek bir mum, arkasında bir pano, altında bir zemin. Işık kaynağı tek. Kontrol grubu onu `DirectionalLight` olarak görüyor, elle yazdığımız materyal aynı yönü taşıyan bir uniform olarak.

### İki Poz, Üç Materyal

Bir ölçüm ancak tekrarlanabildiği kadar ölçümdür. `?measure=1` adresine eklendiğinde demo fareyi de klavyeyi de dinlemeyi kesiyor: arka tampon 960×540'a kilitleniyor, kamera ve ışık sabit pozlara oturuyor, her yapılandırmada otuz ısınma karesi çöpe gidiyor ve arkasından yüz seksen kare tartılıyor. Sonuç konsola tek satır JSON olarak düşüyor.

İki poz var ve ikisi de yazının başındaki fener deneyi:

```ts
// src/measure.ts (parça)
export const POSES = [
  // Işık nesnenin arkasında, kameranın tam karşısında.
  { name: "back", lightAzimuthDeg: 178, lightElevationDeg: 10 },
  // Işık kameranın omzunun üstünde: klasik anahtar ışık.
  { name: "front", lightAzimuthDeg: 28, lightElevationDeg: 34 },
] as const;

export const CAMERA = {
  azimuthDeg: 20,
  elevationDeg: 8,
  distance: 4.2,
  fovYDeg: 40,
} as const;
```

GPU zamanını `EXT_disjoint_timer_query_webgl2` ile okuyoruz. Sorgu sınıfının kendisini seride bir kez yazmıştım, burada tekrar etmiyorum; kuralları aynı: sonuç birkaç kare geç gelir, `GPU_DISJOINT_EXT` yandığında eldeki bütün örnekler çöpe gider, uzantı yoksa sütunun adı "kare süresi" olur.

İlk tablo üç materyalin aynı pozda yan yana hâli. Sahne: tek mum, arka pano, zemin; 960×540 arka tampon; kalınlık haritası 256².

| Materyal | Medyan GPU ms | p95 GPU ms | Çizim çağrısı | Doku baytı |
|---|---|---|---|---|
| Lambert (yalın referans) | 0,5782 | 2,5546 | 4 | 0 |
| Elle yazılmış SSS | 0,3689 | 2,074 | 4 | 65.536 |
| `MeshPhysicalMaterial` transmission | 0,7415 | 2,5901 | 6 | 131.072 |

Doku baytı sütunu ölçülmedi, hesaplandı: R8 harita için `256 × 256 × 1`, RG8 kopyası için iki katı. transmission yolunun ayrıca kendi render hedefi var; onun boyutu kameranın viewport'undan türediği için sabit değil, hesabı 5.528.440 bayt (mipmap zinciriyle birlikte, hesaplanan).

İkinci tablo yazının asıl sorusu. Aynı sahne, aynı materyaller, ışık bir arkada bir önde. Ölçtüğümüz şey mesh piksellerinin ortalama doğrusal parlaklığı; maskeyi ayrı bir siluet geçişi veriyor, böylece üç materyalde de tam olarak aynı piksel kümesi ortalanıyor.

| Materyal | Işık arkada | Işık önde |
|---|---|---|
| Lambert | 0,001827 | 0,564413 |
| Sadece wrap terimi | 0,020677 | 0,427976 |
| Elle yazılmış SSS (tam) | 0,032364 | 0,437932 |
| `MeshPhysicalMaterial` | 0,018767 | 0,009519 |

Parlaklığı sekiz bitlik bir hedeften okumadım, yarım kayan noktalı (half float) bir hedeften okudum. Sebebi ilginç: arkadan aydınlatmada Lambert'in ortalaması sıfıra çok yakın ve sekiz bitte o aralık iki üç basamağa iniyor. Ölçmek istediğiniz fark ölçüm biriminizin altında kalıyorsa ölçmemişsiniz demektir.

Üçüncü tablo, haritanın gerçekten çalışıp çalışmadığının sınavı. Işık arkadayken mesh piksellerini kalınlığa göre iki kovaya ayırıyoruz (harita modunu ekrana çizip kırmızı kanalı okuyarak) ve her kovada ortalama parlaklığa bakıyoruz.

| Materyal | İnce bölge (kalınlık < 0,25) | Kalın bölge (kalınlık > 0,60) |
|---|---|---|
| Lambert | 0,005821 | 0,001756 |
| Elle yazılmış SSS | 0,165403 | 0,030945 |

Lambert satırının iki hücresi arasında anlamlı bir fark çıkmaması bekleniyor: o materyal kalınlığı bilmiyor, kovalar onun için rastgele iki piksel kümesi. SSS satırındaki fark ise doğrudan kalınlık haritasının imzası.

Dördüncüsü haritanın çözünürlüğü. Referans, 512² haritayla çizilmiş kare; RMS o kareye göre.

| Harita | VRAM (hesaplanan) | Medyan GPU ms | RMS (512²'ye göre) |
|---|---|---|---|
| 128² | 16.384 | 0,3483 | 0,000379 |
| 256² | 65.536 | 0,3618 | 0,000317 |
| 512² | 262.144 | 0,3594 | referans |

Bu tablonun GPU ms sütunu ile fırın tablosunun toplam süre sütununu yan yana okumak lazım. Çözünürlüğü dörde katlamak fırında 5.691,283 ms'den 21.095,395 ms'ye çıkan bir fatura kesiyor, karede ise pratikte hiçbir şey değiştirmiyor — üç satır da 0,35–0,36 ms'lik dar bir bantta duruyor ve sıralamaları monoton değil: 256²'nin ölçülen medyanı hem 128²'den hem 512²'den yüksek çıktı. Bu bir çözünürlük etkisi değil, ölçüm gürültüsü; doku okuması dokunun boyutundan büyük ölçüde bağımsız, değişen tek şey önbellek isabet oranı.

Peki o doku okumasının kendisi ne kadar? Kalınlığı haritadan almak yerine sabit bir sayı vererek ölçüyoruz:

| Kalınlık kaynağı | Medyan GPU ms | Referansa RMS |
|---|---|---|
| 256² haritadan | 0,3618 | 0,000317 |
| Sabit sayı (0,5) | 0,4199 | 0,018636 |

Son tablo lobun şekliyle ilgili. `power` ve `distortion` parametrelerini tarayıp GPU süresine bakıyoruz.

| Yapılandırma | Medyan GPU ms |
|---|---|
| power = 1 | 0,3596 |
| power = 4 | 0,4532 |
| power = 12 | 0,4059 |
| distortion = 0 | 0,3706 |
| distortion = 0,5 | 0,4035 |

Beklentim bu tablonun düz çıkması: `pow` bir komut, `normalize` bir komut, ikisi de parametreden bağımsız. Ölçmemin sebebi beklentiyi doğrulamak değil, tersini de mümkün görmem: bazı sürücüler `pow`u sabit üslerde açarak optimize ediyor ve o zaman `power = 1` ile `power = 12` arasında ölçülebilir bir fark kalabiliyor. Bizim durumumuzda üs bir uniform, sabit değil; yine de sürücünün ne yaptığını tahmin etmektense ölçmeyi tercih ettim.

Üç koşunun sonucu bu beklentiyi kısmen doğruladı ama temiz çıkmadı: `power = 4` üç koşuda da en yüksek GPU medyanını verdi, fakat `power = 1` ile `power = 12` arasındaki sıra koşudan koşuya yer değiştirdi. Yani bu düzenekte `power`ın GPU maliyetine etkisini **ölçemedim** — gürültü bandının altında kaldı, ve bu "fark yok" demekten farklı bir cümle. Aynı ölçütü ayrı bir yerden de sınadım: lob taramasının `power = 4` satırıyla harita çözünürlüğü taramasının 256² satırı aynı yapılandırmayı ölçüyor — yukarıdaki iki tabloda duran 0,4532 ve 0,3618. Aralarındaki öz-tutarlılık sapması (|fark| bölü ikisinin ortalaması) yayımlanan medyanlar üzerinden %22,4; koşu bazında %9,3 · %16,4 · %61,6, medyanı %16,4. Eşiğim %10'du ve düzenek onu üç koşunun yalnızca birinde tutturdu — gürültü bandı, `power`da aradığım farktan geniş. Hesabı ham kayıttan `node tools/self-consistency.mjs` yeniden üretiyor.

### Işın, Üçgen ve Sınır Koşulları

Fırının tamamı, tanımı gereği, tarayıcının dışında koşan bir program. Yani bu projede matematiğin büyük kısmını doğrulamak için ekran açmaya gerek yok: testler `vitest` ile koşuyor ve hiçbir dosya `document` ya da `WebGL2RenderingContext` referansı içermiyor.

Kesişim testleri elle kurulmuş geometriler üzerinde:

```ts
// test/intersect.test.ts (parça)
import { describe, expect, it } from "vitest";
import { bruteForceIntersect, intersectTriangle } from "../src/bake/intersect";

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
});
```

BVH'nin testi ise bir eşdeğerlik testi: aynı ışın demeti hem ağaçtan hem kaba kuvvetten geçiriliyor ve iki sonucun on iki hanede aynı olması bekleniyor. Hızlandırma yapısının tek görevi bu; daha hızlı yanlış cevap vermek değil.

```ts
// test/bvh.test.ts (parça)
it("BVH sonucu kaba kuvvetle birebir aynı", () => {
  const tris = icosphereTriangles(2); // deterministik, tohum yok
  const bvh = new Bvh(tris, 4);

  for (let i = 0; i < 200; i++) {
    const [u1, u2] = hammersley(i, 200);
    const dir = cosineDirection(u1, u2, [0, 1, 0]);
    const brute = bruteForceIntersect(tris, [0, 0, 0], dir, 100);
    const tree = bvh.intersect(0, 0, 0, dir[0], dir[1], dir[2], 100);
    expect(tree).toBeCloseTo(brute, 12);
  }
});

it("eksene paralel ışınlarda NaN üretmez", () => {
  const bvh = new Bvh(boxTriangles(1), 4);
  for (const dir of [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ] as const) {
    const t = bvh.intersect(0, 0, 0, dir[0], dir[1], dir[2], 100);
    expect(Number.isNaN(t)).toBe(false);
    expect(t).toBeLessThan(100);
  }
});
```

Listenin geri kalanını okumak sıkıcı, yazmamak pahalı: `radicalInverse2`'nin bilinen ilk değerleri, ortonormal bazın her yönde ortonormal kalması (kutuplar dahil), kosinüs örneklerinin hepsinin normalle pozitif nokta çarpım vermesi, rasterizasyonun üçgen alanıyla orantılı sayıda texel doldurması, baryantrik ağırlıkların toplamının bir olması, dilate'in bir geçişte yalnızca bir halka ilerlemesi, wrap ve geçirgenlik fonksiyonlarının sınır koşulları, `backingSize` kelepçeleri, medyan ve yüzdelik uç durumları.

Hiçbiri mumun mum gibi göründüğünü kanıtlamıyor. Onun için tarayıcıda açıp ışığı arkaya almak, harita modunu açıp gri tonların gövdede doğru yerde koyulaştığını görmek ve `?measure=1` ile konsoldaki tek satırı okumak gerekiyor.

### Özetle:

1. Opak aydınlatma "gelen ışığın ne kadarı geri sekti" sorusuna cevap verir. Yarı saydamlık başka bir soru sorar: ışık dışarı çıkmadan önce malzemenin içinde ne kadar yol aldı. Gerçek zamanlı bütün yaklaşımlar o yolu tek bir sayıya indirger.
2. Wrap lighting terminatörü kaydırır: `(ndl + w) / ((1 + w)²)`. Paydayı unutmayın, yoksa kaydırma bedavaya ışık yaratır. `w = 0` verildiğinde fonksiyon birebir Lambert'e dönmeli; bu, tarayıcı açmadan sınanabilecek bir özdeşliktir.
3. Wrap tek başına yetmez çünkü kameranın nerede olduğunu umursamaz. Kulağın arkasındaki kızıllık görüş-bağımlıdır; onun için ışığın tersine bakan ayrı bir loba ihtiyaç var.
4. O lobun kalbi `normalize(lightDir + normal * distortion)` vektörünün **eksisi**. Işık arkadayken nokta çarpım bire koşar, öne geçtiğinde kırpılır. Hiçbir yerde "ışık arkada mı" koşulu yazmaya gerek kalmaz.
5. Kalınlık haritasının yönünü baştan sabitleyin ve yazın: beyaz = kalın = ışık zor geçer. Ters çevirirseniz ortaya çıkan görüntü hâlâ makul görünür, sadece yanlış nesneye aittir.
6. Kalınlığı üretmenin üç yolu var: sabit sayı (ucuz, yanlış), çalışma zamanında arka yüz derinliği (doğru, sahneyi bir kez daha çizer), offline pişirme (karede bir doku okuması, kurulumda bir fırın turu). Deforme olan mesh'te üçüncüsü yalan söyler.
7. Fırın iki aşamalı: UV uzayında rasterizasyon ile texel başına konum/normal, sonra `-N` yarım küresine kosinüs ağırlıklı ışınlar. `Math.random` kullanmayın; Hammersley dizisi hem deterministik hem test edilebilir.
8. Işın başlangıcını yüzeyin bir tık altına kaydırın ve kesişimde küçük bir `t` eşiği koyun. Aksi hâlde her ışın kendi üçgenine sıfır mesafede çarpar ve harita tamamen siyah çıkar. Eşiğin bedelini de bilin: yüzeye teğet çıkan ışında meşru duvar da o eşiğin altında kalabiliyor, kaçan ışınlarımın büyük çoğunluğu oradan geldi.
9. Kesişim testinde ön yüz elemesi kapalı olmalı. İçeriden bakınca karşı duvarı arkasından görüyorsunuz; `det`in işaretine bakan bir Möller-Trumbore burada sessizce yanlış cevap verir.
10. BVH'yi hız için değil, mümkün olsun diye kuruyorsunuz. Testi "daha hızlı" değil, "kaba kuvvetle birebir aynı" olmalı. Slab testinde `0 * Infinity = NaN` tuzağını ayrı bir vaka olarak sınayın — ama asıl tuzak neredeyse paralel ışın: `1 / d` sonsuz değil sadece devasa olduğunda `hi` tam 0 çıkıp `tmax`'ı sıfıra kelepçeliyor ve doğru düğüm sessizce eleniyor. Eşik tabanlı slab testi kullanın: `|1 / d|` bir tavanı aşan eksen kısıt üretmesin, yalnızca başlangıcın dilimin içinde olması istensin.
11. Rasterizasyondan sonra dilate geçin ve her turda maskenin bir kopyası üzerinden okuyun. Kopyasız dilate tek turda bütün dokuyu boyar.
12. UV'de dikey çevirme yok: `DataTexture` zaten `flipY = false` ve `unpackAlignment = 1` ile geliyor. Kendi `Texture`'ınızı kurarsanız hizalama 4'te kalır ve tek kanallı dokuda satırlar kayar.
13. three'nin `thicknessMap`'i yeşil kanalı okur. Tek kanallı (R8) bir harita orada sıfır döner ve materyal sessizce berrak cama dönüşür. Yükleme sırasında RG8'e genişletmek iki kat bayt, RGBA8'e genişletmek dört kat.
14. `transmission > 0` olan bir materyal sahneyi ikinci kez çizdirir ve her karede mipmap ürettirir. Faturayı materyalin shader'ında değil, kare hattında ödersiniz; çizim çağrısı sayacı bunu doğrudan gösterir.
15. Parlaklık ölçümünü doğrusal uzayda ve yarım kayan noktalı bir hedeften alın. Arkadan aydınlatmada Lambert'in ortalaması sıfıra o kadar yakın ki sekiz bitlik bir hedefte fark ölçüm biriminin altında kalıyor.
16. Kalınlık haritasının çözünürlüğü karede değil fırında ödeniyor. Aynı sayıyı iki tablonun iki ayrı sütununda görmek, bu tekniğin bütün mantığını tek bakışta anlatıyor.

Depoda üç komut var: `npm test` matematiği sınıyor, `npm run bake` haritayı pişiriyor, `npm run dev` demoyu getiriyor. Yukarıdaki tabloların yarısı fırının stdout'undan, yarısı `?measure=1` modunun konsola bıraktığı tek satırdan çıktı. Sayılara imrenmeyin, onlar benim masamdaki GPU'nun hikâyesi. Devralmaya değer olan şey yöntem: ışığı nesnenin arkasına alıp iki parlaklık ortalamasını yan yana koymak.

Bu yaklaşımın çürük tarafı kalınlık haritasının kendisinde duruyor. Harita, mesh'in pişirme anındaki hâlinin bir fotoğrafı. Mumu eritirseniz, karakteri deforme ederseniz, ağzını açtırırsanız harita eski gövdeyi anlatmaya devam ediyor ve kimse size bir hata mesajı vermiyor. Sadece ışık yanlış yerden geçiyor. Çalışma zamanında arka yüz derinliğinden kalınlık ölçen yöntem bu yüzden hâlâ ayakta: sahneyi bir kez daha çizmenin bedelini deformasyona dayanıklılıkla ödüyor.

Ben o bedeli ödemedim, çünkü benim mumum erimiyor. Arkadan gelen ışıkta Lambert'in ortalama parlaklığı 0,001827, elle yazdığımız materyalinki 0,032364. Aradaki farkın tamamı karede değil, 5.691,283 ms'lik tek bir fırın turunda ödendi.

Elimi bir daha fenerin önüne tuttuğumda parmaklarıma başka bakıyordum. Kızıllığı değil, kızıllığın nerede bittiğini arıyordum: ışığın söndüğü yer, etin kalınlaştığı yer. Bir efekti yazmanın en tuhaf yan etkisi bu. Artık ona bakamıyorsunuz, ölçüyorsunuz. 🕯️
