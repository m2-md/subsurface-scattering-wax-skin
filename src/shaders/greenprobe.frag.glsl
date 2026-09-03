uniform sampler2D uThickness;

in vec2 vUv;

layout(location = 0) out vec4 outColor;

// three's thicknessMap reads .g. To measure whether the green channel really
// returns zero on an R8 texture, we write R and G side by side.
void main() {
  outColor = vec4(texture(uThickness, vUv).g, texture(uThickness, vUv).r, 0.0, 1.0);
}
