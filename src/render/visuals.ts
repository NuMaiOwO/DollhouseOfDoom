import type { AnimState, ObjectType } from "../sim/types";

/**
 * Visual registry. Everything is a placeholder rectangle for now.
 * When art arrives, set `sprite` to an image key (file in public/assets/<key>.png)
 * and the renderer uses it instead. Gameplay code never changes.
 */
export interface Placeholder { w: number; h: number; color: number; label: string }
export interface VisualSpec { placeholder: Placeholder; sprite: string | null }

export const DUMMY_SIZE = { adult: { w: 16, h: 32 }, child: { w: 12, h: 22 } };

/** Every animation the artist needs to draw (one sprite-sheet row each). */
export const DUMMY_ANIMS: AnimState[] = [
  "idle", "walk", "climb", "eat", "cook", "sleep", "talk", "flirt", "fight", "mate", "panic", "extinguish", "launched", "airborne", "fallen", "repair", "dead",
];

export const OBJECT_VISUALS: Record<ObjectType, VisualSpec> = {
  fridge: { placeholder: { w: 24, h: 46, color: 0xdfe7ec, label: "FRIDGE" }, sprite: null },
  stove: { placeholder: { w: 28, h: 26, color: 0x9aa0a8, label: "STOVE" }, sprite: null },
  bed: { placeholder: { w: 48, h: 14, color: 0x6d8fd6, label: "BED" }, sprite: null },
  toilet: { placeholder: { w: 18, h: 24, color: 0xf4f4f4, label: "TOILET" }, sprite: null },
  couch: { placeholder: { w: 56, h: 20, color: 0x8a5a44, label: "COUCH" }, sprite: null },
};

export const COLORS = {
  wall: [0x3b3550, 0x2f3a4f],
  floor: 0x5b4636,
  ground: 0x3d6b3a,
  ladder: 0xb08a5a,
  roof: 0x7a3b3b,
  dead: 0x6b6b6b,
  burnt: 0x262222,
  selected: 0xffe66d,
  water: 0x5fc4ff,
  puddle: 0xe8e27a,
};
