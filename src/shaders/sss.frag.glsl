uniform sampler2D uThickness;
uniform vec3 uAlbedo;
uniform vec3 uInteriorColor;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform float uWrap;
uniform float uDistortion;
uniform float uPower;
uniform float uScale;
uniform float uAmbient;
uniform float uAbsorption;
uniform float uShininess;
uniform float uSpecular;
uniform float uConstantThickness;
uniform int uUseMap;
uniform int uMode;

in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec2 vUv;

layout(location = 0) out vec4 outColor;

// src/modes.ts ile AYNI sayılar.
const int MODE_FULL = 0;
const int MODE_THICKNESS = 1;
const int MODE_TRANSMISSION = 2;
const int MODE_WRAP = 3;

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
