out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vUv;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  // normalMatrix GÖRÜŞ uzayına götürür; burada dünya uzayı gerekiyor.
  vWorldNormal = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * world;
}
