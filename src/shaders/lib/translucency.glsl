// src/shaders/lib/translucency.glsl
// The numerator shifts the terminator, the denominator keeps total energy put.
// Given wrap = 0 the function collapses exactly to Lambert.
float wrapDiffuse(float ndl, float wrap) {
  float w = max(wrap, 0.0);
  return clamp((ndl + w) / ((1.0 + w) * (1.0 + w)), 0.0, 1.0);
}

// lightDir: from surface to LIGHT, unit. viewDir: from surface to CAMERA, unit.
// thickness: path length normalized to [0,1] (1 = thickest).
float backTranslucency(vec3 lightDir, vec3 normal, vec3 viewDir, float thickness,
                       float distortion, float power, float scale,
                       float ambient, float absorption) {
  // We bend the light a bit along the normal for an "it comes from inside" feel.
  vec3 h = normalize(lightDir + normal * distortion);
  float lobe = pow(clamp(dot(viewDir, -h), 0.0, 1.0), power) * scale;
  // Beer-Lambert: as the path grows, transmitted light falls off exponentially.
  return (lobe + ambient) * exp(-absorption * thickness);
}
