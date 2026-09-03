layout(location = 0) out vec4 outColor;

// Maske geçişi: mesh piksellerini beyaz boyar. Üç materyalde de AYNI piksel
// kümesini ortalayabilmek için maske bir kez çizilip saklanıyor.
void main() {
  outColor = vec4(1.0);
}
