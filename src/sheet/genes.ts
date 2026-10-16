/**
 * Babies, the way NuMaiOwO designed them:
 *  1. For each tag (hair, skin, eyes), roll a color somewhere between the two parents'
 *     colors: sometimes close to one parent, sometimes near the middle.
 *  2. The baby's look is the sheet (defaults + gallery) whose tags are closest to those colors,
 *     at most "off by 10". Never a parent's own sheet; picked among the 3 closest so siblings differ.
 *     If nothing is within 10, a default is repainted to the exact gene colors (defaults only:
 *     their tag colors are exactly their pixel colors; player art is never repainted).
 *  3. The baby's genes are the rolled colors, not the matched sheet's tags, so grandkids
 *     inherit smoothly even when the sprite match is rough. Nobody's art is recolored.
 *
 * Colors are mixed and compared in OKLab, where "halfway" and "close" look right to the eye.
 */
import { TAG_KEYS, repaint, type Character, type Tags } from "./sheet";

/** Largest acceptable "off by" (shown ×100 in the Lab, so 0.10 = "off by 10"). */
export const MAX_DISTANCE = 0.1;

type Lab = [number, number, number];

export function rollGenes(a: Tags, b: Tags, rng: { next(): number }): Tags {
  const out = {} as Tags;
  for (const k of TAG_KEYS) out[k] = labToRgb(mix(rgbToLab(a[k]), rgbToLab(b[k]), rng.next()));
  return out;
}

export interface Match { character: Character; distance: number; repainted?: boolean }

/** All candidates sorted by how close their tags are to the genes. */
export function rankMatches(genes: Tags, pool: Character[], excludeIds: string[] = []): Match[] {
  return pool
    .filter((c) => !excludeIds.includes(c.id))
    .map((character) => ({ character, distance: tagDistance(genes, character.tags) }))
    .sort((x, y) => x.distance - y.distance);
}

/**
 * Picks among the 3 closest within MAX_DISTANCE, weighted 3:2:1 toward the closest.
 * If none are close enough, repaints a random default to the genes.
 */
export function matchSheet(genes: Tags, pool: Character[], excludeIds: string[], rng: { next(): number }): Match | null {
  const top = rankMatches(genes, pool, excludeIds).filter((m) => m.distance <= MAX_DISTANCE).slice(0, 3);
  if (!top.length) return repaintDefault(genes, pool.filter((c) => c.isDefault && !excludeIds.includes(c.id)), rng);
  const weights = [3, 2, 1].slice(0, top.length);
  let r = rng.next() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < top.length; i++) if ((r -= weights[i]) <= 0) return top[i];
  return top[0];
}

function repaintDefault(genes: Tags, defaults: Character[], rng: { next(): number }): Match | null {
  if (!defaults.length) return null;
  const base = defaults[Math.floor(rng.next() * defaults.length)];
  const map = new Map(TAG_KEYS.map((k) => [base.tags[k], genes[k]] as [number, number]));
  return {
    character: { ...base, id: `${base.id}~repainted`, sheet: repaint(base.sheet, map), tags: { ...genes } },
    distance: 0,
    repainted: true,
  };
}

/** Average perceptual distance across the three tags (0 = identical; ~0.1 = clearly different). */
export function tagDistance(a: Tags, b: Tags): number {
  let sum = 0;
  for (const k of TAG_KEYS) {
    const [l1, a1, b1] = rgbToLab(a[k]);
    const [l2, a2, b2] = rgbToLab(b[k]);
    sum += Math.hypot(l1 - l2, a1 - a2, b1 - b2);
  }
  return sum / TAG_KEYS.length;
}

const mix = (x: Lab, y: Lab, t: number): Lab => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];

// ── OKLab (Björn Ottosson) ──
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToLab(rgb: number): Lab {
  const r = toLinear(((rgb >> 16) & 255) / 255), g = toLinear(((rgb >> 8) & 255) / 255), b = toLinear((rgb & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function labToRgb([L, A, B]: Lab): number {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(toSrgb(v) * 255)));
  const r = ch(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = ch(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = ch(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return (r << 16) | (g << 8) | b;
}

export const hex = (rgb: number) => `#${rgb.toString(16).padStart(6, "0")}`;
