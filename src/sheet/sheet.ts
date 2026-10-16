/**
 * Character sheets: what a Dummy looks like.
 *
 * A sheet is three 24×48 pixel drawings, one per view the game shows:
 * facing right, facing left (drawn separately; nothing is mirrored automatically)
 * and back (turned away, e.g. climbing the ladder). As a PNG it is 72×48: [right | left | back].
 *
 * Players can draw anything. The game never looks inside the drawing: a character
 * is described by 3 tag colors (see Tags), which is all babies need.
 *
 * Pure logic (no DOM), so the simulation and tests can use it.
 */
import type { PersonalityId } from "../sim/types";

export const SHEET_W = 24;
export const SHEET_H = 48;
export const VIEWS = ["right", "left", "back"] as const;
export type View = (typeof VIEWS)[number];

/** RGBA packed as 0xRRGGBBAA. 0 = empty. */
export type Pixels = Uint32Array;
export type Sheet = Record<View, Pixels>;

/**
 * Three colors the player picks for a character. "hair", "skin" and "eyes" are just labels:
 * a slime or a demon lord tags whatever three colors it likes. Colors are 0xRRGGBB.
 */
export interface Tags { hair: number; skin: number; eyes: number }
export const TAG_KEYS = ["hair", "skin", "eyes"] as const;
export type TagKey = (typeof TAG_KEYS)[number];

/** A drawn character: in the gallery, or one of the defaults. */
export interface Character {
  id: string;
  name: string;
  sheet: Sheet;
  tags: Tags;
  personality?: PersonalityId;
  /** True for the game's generated defaults (the only sheets the game may repaint). */
  isDefault?: boolean;
}

export const idx = (x: number, y: number) => y * SHEET_W + x;
const blank = () => new Uint32Array(SHEET_W * SHEET_H);

export function emptySheet(): Sheet {
  return { right: blank(), left: blank(), back: blank() };
}

/** Flips a drawing horizontally (for the Studio's optional mirror helpers). */
export function mirror(p: Pixels): Pixels {
  const out = blank();
  for (let y = 0; y < SHEET_H; y++) for (let x = 0; x < SHEET_W; x++) out[idx(SHEET_W - 1 - x, y)] = p[idx(x, y)];
  return out;
}

/** Replaces exact colors (0xRRGGBB → 0xRRGGBB) in every view. Only ever used on defaults. */
export function repaint(s: Sheet, map: Map<number, number>): Sheet {
  const out = emptySheet();
  for (const v of VIEWS) {
    out[v] = s[v].map((c) => {
      if (!c) return 0;
      const to = map.get(c >>> 8);
      return to === undefined ? c : (((to << 8) | (c & 255)) >>> 0);
    });
  }
  return out;
}

// ── Compact text encoding (for saves) ──────────────────────
// Palette + run-length encoded indices + base64. A typical sheet is a couple of KB.

export function encodeSheet(s: Sheet): string {
  const palette: number[] = [];
  const lookup = new Map<number, number>([[0, 0]]);
  const indexOf = (c: number) => {
    const known = lookup.get(c);
    if (known !== undefined) return known;
    if (palette.length >= 255) return lookup.get(nearest(c, palette))!; // >255 colors: reuse the closest
    palette.push(c);
    lookup.set(c, palette.length);
    return palette.length;
  };
  const indices: number[] = [];
  for (const v of VIEWS) for (const c of s[v]) indices.push(indexOf(c));
  const bytes: number[] = [3, palette.length];
  for (const c of palette) bytes.push((c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255, c & 255);
  for (let i = 0; i < indices.length; ) {
    let run = 1;
    while (run < 255 && indices[i + run] === indices[i]) run++;
    bytes.push(run, indices[i]);
    i += run;
  }
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

export function decodeSheet(text: string): Sheet {
  const bytes = Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
  if (bytes[0] !== 3) throw new Error(`Unknown sheet encoding ${bytes[0]}`);
  const palette = [0];
  let p = 2;
  for (let i = 0; i < bytes[1]; i++, p += 4) palette.push(((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0);
  const n = SHEET_W * SHEET_H;
  const all = new Uint32Array(VIEWS.length * n);
  for (let o = 0; p < bytes.length; p += 2) all.fill(palette[bytes[p + 1]], o, (o += bytes[p]));
  return { right: all.slice(0, n), left: all.slice(n, 2 * n), back: all.slice(2 * n, 3 * n) };
}

function nearest(c: number, palette: number[]) {
  const ch = (v: number, s: number) => (v >>> s) & 255;
  let best = palette[0], bestD = Infinity;
  for (const q of palette) {
    const d = (ch(c, 24) - ch(q, 24)) ** 2 + (ch(c, 16) - ch(q, 16)) ** 2 + (ch(c, 8) - ch(q, 8)) ** 2;
    if (d < bestD) [best, bestD] = [q, d];
  }
  return best;
}
