uniform vec3 uAlbedo;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform float uShininess;
uniform float uSpecular;

in vec3 vWorldPosition;
in vec3 vWorldNormal;

layout(location = 0) out vec4 outColor;

// Yalın referans: kalınlık okuması YOK, doku bağı YOK.
// Doku baytı = 0 iddiası tam olarak buna dayanıyor.
void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(cameraPosition - vWorldPosition);
  vec3 l = normalize(uLightDirection);

  vec3 diffuse = uAlbedo * uLightColor * max(dot(n, l), 0.0);

  vec3 h = normalize(l + v);
  float spec = pow(max(dot(n, h), 0.0), uShininess) * uSpecular
             * step(0.0, dot(n, l));

  outColor = vec4(diffuse + spec, 1.0);
}
