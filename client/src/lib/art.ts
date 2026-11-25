// ===========================================================================
// lib/art.ts: small helpers for the generated artwork (avatars, background,
// Live Wire layout). Everything is deterministic: same input -> same picture.
// ===========================================================================

/** FNV-1a string hash -> unsigned 32-bit int. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny seeded random number generator, returns 0..1. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An organic closed "blob" path around (cx, cy).
 * Picks `points` radii between r*(1-wobble) and r, then joins them with
 * smooth curves (Catmull-Rom converted to cubic Bezier).
 */
export function blobPath(
  rand: () => number,
  cx: number,
  cy: number,
  r: number,
  points = 7,
  wobble = 0.18,
): string {
  const pts: [number, number][] = [];
  const offset = rand() * Math.PI * 2;
  for (let i = 0; i < points; i++) {
    const a = offset + (i / points) * Math.PI * 2;
    const rr = r * (1 - wobble + rand() * wobble);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const p = (i: number) => pts[(i + points) % points]!;
  let d = `M${p(0)[0].toFixed(2)},${p(0)[1].toFixed(2)}`;
  for (let i = 0; i < points; i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }
  return d + 'Z';
}

/**
 * Watercolor-ish pairs for avatars: [light center, deeper edge].
 * Fixed colors (not theme vars) so a person looks the same in both themes.
 */
export const AVATAR_PALETTES: [string, string][] = [
  ['#F1CBB0', '#C2562F'], // terracotta
  ['#C9D0EA', '#3D4A7A'], // indigo
  ['#D8E2C6', '#6E8B6B'], // sage
  ['#EBCFDD', '#8A5477'], // plum
  ['#F1DEB4', '#B8862F'], // ochre
  ['#CFE3E2', '#3F7A78'], // teal
];
