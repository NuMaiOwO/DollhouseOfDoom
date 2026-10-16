import type { InteractionDef, Sim } from "../sim/types";

/**
 * Everything a Sim can do. Objects and other Sims "advertise" these;
 * autonomy scores them. Add a new interaction here and existing rules
 * (personalities, relationships, buffs) apply to it through its tags.
 */
export const INTERACTIONS: InteractionDef[] = [
  // ── Objects ──────────────────────────────────────────────
  {
    id: "snack", label: "Grab a snack", emoji: "🍎", anim: "eat",
    target: "object", objectTypes: ["fridge"], tags: ["food"],
    duration: 10, gains: { hunger: 30 },
    hazards: [{ id: "choke", chancePerUse: 0.004 }],
  },
  {
    id: "cook", label: "Cook a meal", emoji: "🍳", anim: "cook",
    target: "object", objectTypes: ["stove"], tags: ["food", "cooking"],
    duration: 40, gains: { hunger: 65 },
    hazards: [{ id: "fire", chancePerUse: 0.03, cheapMultiplier: 3 }],
  },
  {
    id: "sleep", label: "Sleep", emoji: "💤", anim: "sleep",
    target: "object", objectTypes: ["bed"], tags: ["rest"],
    duration: 480, gains: { energy: 110 },
    stopWhen: (s, a) => s.needs.energy >= 100 && a.elapsed > 60,
  },
  {
    id: "nap", label: "Nap on the couch", emoji: "😪", anim: "sleep",
    target: "object", objectTypes: ["couch"], tags: ["rest"],
    duration: 120, gains: { energy: 35 },
  },
  {
    id: "use_toilet", label: "Use the toilet", emoji: "🚽", anim: "idle",
    target: "object", objectTypes: ["toilet"], tags: ["toilet"],
    duration: 8, gains: { bladder: 100 },
    hazards: [{ id: "geyser", chancePerUse: 0.15 }],
  },
  {
    id: "wander", label: "Wander around", emoji: "", anim: "idle",
    target: "self", tags: ["idle"], duration: 25, baseDesire: 1.2,
  },

  // ── Social ───────────────────────────────────────────────
  {
    id: "chat", label: "Chat", emoji: "💬", anim: "talk",
    target: "sim", tags: ["social", "friendly"], needsAccept: true,
    duration: 20, gains: { social: 25 }, targetGains: { social: 20 },
    onComplete: ({ world: w, sim: s, other: o }) => {
      const ok = w.rng.chance(0.65 + w.rel(s, o!).friendship / 200);
      w.bumpRel(s, o!, { friendship: ok ? 6 : -4 });
      w.bumpRel(o!, s, { friendship: ok ? 5 : -4 });
    },
  },
  {
    id: "insult", label: "Insult", emoji: "💢", anim: "talk",
    target: "sim", tags: ["social", "mean"],
    duration: 8, gains: { social: 10 }, baseDesire: 0.8,
    onComplete: ({ world: w, sim: s, other: o }) => {
      w.bumpRel(o!, s, { friendship: -12 });
      w.bumpRel(s, o!, { friendship: -3 });
      w.addBuff(o!, "angry", 180);
      w.emit({ kind: "social", minor: true, icon: "💢", text: `${s.name} insulted ${o!.name}.`, simId: s.id });
    },
  },
  {
    id: "fight", label: "Fight", emoji: "👊", anim: "fight",
    target: "sim", tags: ["mean", "violent"], adultsOnly: true,
    duration: 15, gains: { social: 5 }, baseDesire: 0.3,
    available: ({ world: w, sim: s, other: o }) =>
      w.rel(s, o!).friendship <= -20 || (w.hasBuff(s, "angry") && w.rel(s, o!).friendship < 0),
    onStart: ({ world: w, sim: s, other: o }) =>
      w.emit({ kind: "social", icon: "👊", text: `${s.name} picked a fight with ${o!.name}!`, simId: s.id, at: w.placeOf(s) }),
    onComplete: ({ world: w, sim: s, other: o }) => {
      const hit = (attacker: Sim, victim: Sim, min: number, max: number) =>
        w.rng.range(min, max) * (attacker.personality === "asshole" ? 1.3 : 1) * (w.isElder(victim) ? 1.5 : 1);
      w.bumpRel(s, o!, { friendship: -15 });
      w.bumpRel(o!, s, { friendship: -15 });
      w.damage(o!, hit(s, o!, 10, 24), "beaten");
      w.damage(s, hit(o!, s, 6, 18), "beaten");
    },
  },
  {
    id: "flirt", label: "Flirt", emoji: "😘", anim: "flirt",
    target: "sim", tags: ["social", "romantic"], adultsOnly: true, needsAccept: true,
    duration: 15, gains: { social: 20 }, targetGains: { social: 15 }, baseDesire: 0.6,
    available: ({ world: w, sim: s, other: o }) => !w.isFamily(s, o!) && w.rel(s, o!).friendship > -20,
    onComplete: ({ world: w, sim: s, other: o }) => {
      w.bumpRel(s, o!, { romance: 10, friendship: 2 });
      w.bumpRel(o!, s, { romance: 8, friendship: 2 });
      w.checkJealousy(s, o!);
    },
  },
  {
    id: "mate", label: "WooHoo", emoji: "💕", anim: "mate",
    target: "sim", tags: ["romantic", "intimate"], adultsOnly: true, needsAccept: true,
    duration: 30, gains: { social: 30, energy: -5 }, targetGains: { social: 30 }, baseDesire: 0.5,
    available: ({ world: w, sim: s, other: o }) =>
      !w.isFamily(s, o!) && w.rel(s, o!).romance >= 50 && s.mateCooldownUntil <= w.t && o!.mateCooldownUntil <= w.t,
    onComplete: ({ world: w, sim: s, other: o }) => {
      w.bumpRel(s, o!, { romance: 8 });
      w.bumpRel(o!, s, { romance: 8 });
      w.makePartners(s, o!);
      s.mateCooldownUntil = o!.mateCooldownUntil = w.t + 5 * 60;
      w.checkJealousy(s, o!);
      if (w.rng.chance(0.8)) w.spawnBaby(s, o!);
    },
  },

  // ── Internal (started by the world, never chosen) ───────
  {
    id: "passed_out", label: "Passed out", emoji: "😵", anim: "sleep",
    target: "self", tags: ["rest"], duration: 180, gains: { energy: 50 }, internal: true,
  },
  {
    id: "flee", label: "Run away!", emoji: "😱", anim: "panic",
    target: "self", tags: [], duration: 30, internal: true,
  },
  {
    id: "launched", label: "Launched by the toilet", emoji: "😱", anim: "launched",
    target: "self", tags: [], duration: 24, internal: true,
    onComplete: ({ world: w, sim: s, action }) => {
      // Comes down where the launch decided (dest). Hard.
      s.x = action!.dest.x;
      w.kill(s, "toilet");
    },
  },
  {
    id: "extinguish", label: "Fight the fire", emoji: "💦", anim: "extinguish",
    target: "fire", tags: ["brave"], duration: 20, internal: true,
  },
];

export const INTERACTION_BY_ID: Record<string, InteractionDef> = Object.fromEntries(
  INTERACTIONS.map((d) => [d.id, d]),
);
