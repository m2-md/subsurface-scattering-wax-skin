uniform sampler2D uThickness;

in vec2 vUv;

layout(location = 0) out vec4 outColor;

// three'nin thicknessMap'i .g okuyor. R8 bir dokuda yeşil kanalın gerçekten
// sıfır dönüp dönmediğini ölçmek için R ve G'yi yan yana yazıyoruz.
void main() {
  outColor = vec4(texture(uThickness, vUv).g, texture(uThickness, vUv).r, 0.0, 1.0);
}
