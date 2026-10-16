import { INTERACTION_BY_ID } from "../data/interactions";
import type { AnimState, Sim } from "./types";
import type { World } from "./world";

/** Read-only helpers the renderer and UI use to describe a Sim. */

export function simAnim(s: Sim): AnimState {
  if (!s.alive) return "dead";
  if (s.climb) return "climb";
  const a = s.action;
  if (!a) return "idle";
  if (a.phase === "walking") return a.run ? "panic" : "walk";
  return INTERACTION_BY_ID[a.interactionId].anim;
}

export function simThought(w: World, s: Sim): string | null {
  if (!s.alive) return null;
  const a = s.action;
  if (a) {
    const emoji = INTERACTION_BY_ID[a.interactionId].emoji;
    if (emoji) return emoji;
  }
  if (w.hasBuff(s, "angry")) return "💢";
  if (w.hasBuff(s, "heartbroken")) return "💔";
  if (w.hasBuff(s, "grieving")) return "😢";
  if (s.needs.hunger < 20) return "🍔";
  if (s.needs.energy < 15) return "🥱";
  if (s.needs.bladder < 15) return "🚽";
  if (s.needs.social < 15) return "🗨️";
  return null;
}

export function actionLabel(w: World, s: Sim): string {
  if (!s.alive) return "Dead";
  const a = s.action;
  if (!a) return "Idle";
  const def = INTERACTION_BY_ID[a.interactionId];
  const other = a.target.kind === "sim" ? w.simById(a.target.id) : undefined;
  let label = def.label;
  if (other) label += a.passive ? ` (with ${other.name})` : ` with ${other.name}`;
  if (a.phase === "walking") label = `Going to: ${label}`;
  return label;
}
