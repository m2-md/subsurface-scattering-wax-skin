import translucencyChunk from "./shaders/lib/translucency.glsl?raw";

/**
 * Shared GLSL chunks. When given `glslVersion: THREE.GLSL3`, three itself
 * prepends the `#version 300 es` line and the built-in uniform/attribute
 * declarations to the FRONT of the source; that is why the chunks are joined on
 * the TS side and put before the fragment source, with no `#version` by hand.
 */
export const LIB = [translucencyChunk].join("\n");
