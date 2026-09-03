import translucencyChunk from "./shaders/lib/translucency.glsl?raw";

/**
 * Paylaşılan GLSL chunk'ları. three, `glslVersion: THREE.GLSL3` verildiğinde
 * `#version 300 es` satırını ve yerleşik uniform/attribute tanımlarını kaynağın
 * BAŞINA kendisi ekliyor; bu yüzden chunk'lar TS tarafında birleştirilip
 * fragment kaynağının önüne konuyor, dosyalara elle `#version` yazılmıyor.
 */
export const LIB = [translucencyChunk].join("\n");
