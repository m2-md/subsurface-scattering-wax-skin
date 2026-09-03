/** The SAME numbers as the MODE_* constants in `src/shaders/sss.frag.glsl`. */
export const MODE_FULL = 0;
export const MODE_THICKNESS = 1;
export const MODE_TRANSMISSION = 2;
export const MODE_WRAP = 3;

export const MODE_LABELS: Record<number, string> = {
  [MODE_FULL]: "Full",
  [MODE_THICKNESS]: "Thickness",
  [MODE_TRANSMISSION]: "Transmission",
  [MODE_WRAP]: "Wrap",
};
