out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vUv;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  // normalMatrix takes you to VIEW space; here we need world space.
  vWorldNormal = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * world;
}
