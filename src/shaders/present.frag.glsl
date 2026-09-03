uniform sampler2D uSource;

in vec2 vUv;

layout(location = 0) out vec4 outColor;

// The ONLY pass that encodes the linear intermediate target to sRGB. All
// drawing is done linear; the luminance mean is taken BEFORE this pass.
void main() {
  vec3 c = max(texture(uSource, vUv).rgb, vec3(0.0));
  outColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}
