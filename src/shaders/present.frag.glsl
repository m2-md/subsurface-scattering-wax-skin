uniform sampler2D uSource;

in vec2 vUv;

layout(location = 0) out vec4 outColor;

// Doğrusal ara hedefi sRGB'ye kodlayan TEK geçiş. Bütün çizim doğrusal
// yapılıyor; parlaklık ortalaması bu geçişten ÖNCE alınıyor.
void main() {
  vec3 c = max(texture(uSource, vUv).rgb, vec3(0.0));
  outColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}
