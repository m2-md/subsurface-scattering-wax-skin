// src/shaders/lib/translucency.glsl
// Pay terminatörü kaydırır, payda toplam enerjiyi yerinde tutar.
// wrap = 0 verildiğinde fonksiyon birebir Lambert'e döner.
float wrapDiffuse(float ndl, float wrap) {
  float w = max(wrap, 0.0);
  return clamp((ndl + w) / ((1.0 + w) * (1.0 + w)), 0.0, 1.0);
}

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
