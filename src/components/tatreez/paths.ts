/**
 * Original geometric line-work inspired by the structure of Palestinian
 * tatreez (cross-stitch) embroidery: diamond lattices, eight-point stars,
 * and cypress chevrons — drawn as stroke paths so they can be "stitched"
 * on screen via pathLength animation. All artwork here is original.
 */

/** Eight-point star built from two overlapping squares (48×48 viewBox). */
export const STAR_OUTER =
  "M24 2 L30 18 L46 24 L30 30 L24 46 L18 30 L2 24 L18 18 Z";
export const STAR_INNER = "M24 12 L36 24 L24 36 L12 24 Z";

/** Diamond with stitch ticks (24×24 viewBox). */
export const DIAMOND = "M12 2 L22 12 L12 22 L2 12 Z";
export const DIAMOND_CORE = "M12 7 L17 12 L12 17 L7 12 Z";

/** Cypress chevron column (16×28 viewBox) — the saru motif. */
export const CYPRESS =
  "M8 2 L14 9 M8 2 L2 9 M8 8 L14 15 M8 8 L2 15 M8 14 L14 21 M8 14 L2 21 M8 20 L8 27";

/** Running zigzag border segment (40×12 viewBox). */
export const ZIGZAG = "M0 10 L5 2 L10 10 L15 2 L20 10 L25 2 L30 10 L35 2 L40 10";
