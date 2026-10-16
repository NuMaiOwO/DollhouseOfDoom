import { INTERACTIONS, OBJECT_NEED } from "../data/interactions";
import { DESIRE_RULES } from "../data/modifiers";
import { PERSONALITIES } from "../data/personalities";
import { FLOORS, HOUSE_WIDTH, LADDER_X } from "./house";
import { clamp } from "./rng";
import { NEEDS, type Action, type Ctx, type InteractionDef, type Place, type Sim } from "./types";
import type { World } from "./world";

/**
 * Every decision goes through the same stages:
 *   1. AVAILABLE  - can it happen at all?          (isAvailable)
 *   2. DESIRE     - how much does this Sim want it? (desire + DESIRE_RULES)
 *   3. ACCEPT     - does the other Sim agree?       (acceptChance, rolled on arrival)
 *   4. OUTCOME    - what changes?                   (InteractionDef.onComplete)
 */

const TOP_N = 3;

export interface Option { ctx: Ctx; score: number }

export function scoreOptions(w: World, s: Sim): Option[] {
  const options: Option[] = [];
  const consider = (ctx: Ctx) => {
    if (!isAvailable(ctx)) return;
    const score = desire(ctx);
    if (score > 0) options.push({ ctx, score });
  };
  for (const def of INTERACTIONS) {
    if (def.internal) continue;
    if (def.target === "object") {
      for (const object of w.objects) if (def.objectTypes?.includes(object.type)) consider({ world: w, sim: s, def, object });
    } else if (def.target === "sim") {
      for (const other of w.sims) if (other !== s && other.alive) consider({ world: w, sim: s, def, other });
    } else {
      consider({ world: w, sim: s, def });
    }
  }
  return options.sort((a, b) => b.score - a.score);
}

export function chooseAction(w: World, s: Sim): Action | null {
  const top = scoreOptions(w, s).slice(0, TOP_N);
  s.considered = top.map((o) => ({ label: optionLabel(o.ctx), score: o.score }));
  if (!top.length) return null;
  // Weighted pick among the best few: always taking the max looks robotic.
  let r = w.rng.next() * top.reduce((sum, o) => sum + o.score, 0);
  const picked = top.find((o) => (r -= o.score) <= 0) ?? top[0];
  return actionFor(w, picked.ctx);
}

// ── Stage 1: AVAILABLE ──────────────────────────────────────

export function isAvailable(c: Ctx): boolean {
  const { world: w, sim: s, def, object: o, other } = c;
  if (def.adultsOnly && !w.isAdult(s)) return false;
  if (o) {
    const unusable = o.destroyed || o.broken;
    if (def.targetsBroken ? !unusable : unusable) return false;
    if (o.userId !== null && o.userId !== s.id) return false;
    if (w.fires.some((f) => f.floor === o.floor && Math.abs(f.x - o.x) < 40)) return false;
  }
  if (other) {
    if (def.adultsOnly && !w.isAdult(other)) return false;
    if (!canEngage(w, other)) return false;
  }
  return def.available ? def.available(c) : true;
}

/** Whether a Sim can be pulled into a social interaction right now. */
export function canEngage(w: World, t: Sim): boolean {
  if (!t.alive || t.passedOut || w.isAsleep(t)) return false;
  const a = t.action;
  if (!a) return true;
  if (a.passive || a.interactionId === "flee" || a.interactionId === "extinguish" || a.interactionId === "launched" || a.interactionId === "fatal_slip") return false;
  return !(a.target.kind === "sim" && a.phase === "doing");
}

// ── Stage 2: DESIRE ─────────────────────────────────────────

/** How much a need at this level wants fixing. Quadratic: starving beats peckish by a lot. */
const urgency = (v: number) => 10 * ((100 - v) / 100) ** 2 + 0.1;

export function desire(c: Ctx): number {
  const { sim: s, def } = c;
  let score = def.baseDesire ?? 0;
  for (const k of NEEDS) {
    const g = def.gains?.[k];
    if (!g) continue;
    score += (urgency(s.needs[k]) * Math.min(g, 100 - s.needs[k])) / 10;
  }
  if (def.targetsBroken && c.object) score += urgency(s.needs[OBJECT_NEED[c.object.type]]) * 1.5;
  for (const rule of DESIRE_RULES) {
    if (rule.applies(c)) score *= typeof rule.multiply === "function" ? rule.multiply(c) : rule.multiply;
  }
  const where = targetPlace(c);
  if (where) score -= travelDistance(s, where) / 120;
  return score;
}

// ── Stage 3: ACCEPT ─────────────────────────────────────────

export function acceptChance(w: World, actor: Sim, target: Sim, def: InteractionDef): number {
  const r = w.rel(target, actor);
  let p = 0.55 + r.friendship / 150;
  if (def.tags.includes("romantic")) p = 0.25 + r.romance / 100 + r.friendship / 300;
  if (def.id === "mate") p = r.romance >= 30 ? 0.5 + r.romance / 200 : 0.03;
  const tp = PERSONALITIES[target.personality];
  for (const tag of def.tags) p *= tp.acceptTag?.[tag] ?? 1;
  if (w.hasBuff(target, "angry") && def.tags.includes("friendly")) p *= 0.3;
  if ((w.hasBuff(target, "grieving") || w.hasBuff(target, "heartbroken")) && def.tags.includes("romantic")) p *= 0.2;
  if (target.needs.hunger < 15 || target.needs.energy < 10) p *= 0.3;
  if (w.hasBuff(target, "embarrassed")) p *= 0.3;
  return clamp(p, 0.02, 0.97);
}

// ── Helpers ─────────────────────────────────────────────────

function targetPlace(c: Ctx): Place | null {
  if (c.object) return c.object;
  if (c.other) return c.other;
  return null;
}

export function travelDistance(a: Place, b: Place): number {
  if (a.floor === b.floor) return Math.abs(a.x - b.x);
  return Math.abs(a.x - LADDER_X) + Math.abs(b.x - LADDER_X) + 60 * Math.abs(a.floor - b.floor);
}

function optionLabel(c: Ctx): string {
  if (c.other) return `${c.def.label} with ${c.other.name}`;
  return c.def.label;
}

function actionFor(w: World, c: Ctx): Action {
  const { def } = c;
  const base = { interactionId: def.id, phase: "walking" as const, elapsed: 0, duration: def.duration };
  if (c.object) return { ...base, target: { kind: "object", id: c.object.id }, dest: { x: c.object.x, floor: c.object.floor } };
  if (c.other) return { ...base, target: { kind: "sim", id: c.other.id }, dest: { x: c.other.x, floor: c.other.floor } };
  return {
    ...base,
    duration: w.rng.int(15, 40),
    target: { kind: "spot", id: 0 },
    dest: { x: w.rng.range(20, HOUSE_WIDTH - 20), floor: w.rng.int(0, FLOORS - 1) },
  };
}
