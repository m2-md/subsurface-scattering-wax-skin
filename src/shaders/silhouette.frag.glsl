layout(location = 0) out vec4 outColor;

// Mask pass: paints the mesh pixels white. The mask is drawn once and kept so
// that the SAME set of pixels can be averaged across all three materials.
void main() {
  outColor = vec4(1.0);
}
