import type { Ctx, DesireRule, Tag } from "../sim/types";
import { PERSONALITIES } from "./personalities";

const has = (c: Ctx, tag: Tag) => c.def.tags.includes(tag);

/**
 * DESIRE stage rules. Each one multiplies an option's score when it applies.
 * New behaviour (a trait, a mood, a relationship state) = a new rule here,
 * not a change to the autonomy code.
 */
export const DESIRE_RULES: DesireRule[] = [
  {
    id: "personality",
    applies: () => true,
    multiply: ({ dummy, def }) =>
      def.tags.reduce((m, tag) => m * (PERSONALITIES[dummy.personality].tagDesire[tag] ?? 1), 1),
  },
  {
    // Most people don't start trouble for fun. Anger and hate (below) can still push them there.
    id: "decency",
    applies: (c) => has(c, "mean") && c.dummy.personality !== "asshole",
    multiply: 0.1,
  },
  {
    id: "night-rest",
    applies: (c) => has(c, "rest") && (c.world.hour >= 22 || c.world.hour < 6),
    multiply: 2,
  },
  {
    id: "hates-target",
    applies: ({ world, dummy, other }) => !!other && world.rel(dummy, other).friendship <= -30,
    multiply: (c) => (has(c, "mean") ? 2.5 : has(c, "friendly") || has(c, "romantic") ? 0.15 : 1),
  },
  {
    id: "friends-with-target",
    applies: ({ world, dummy, other }) => !!other && world.rel(dummy, other).friendship >= 50,
    multiply: (c) => (has(c, "friendly") ? 1.5 : has(c, "mean") ? 0.3 : 1),
  },
  {
    id: "in-love-with-target",
    applies: ({ world, dummy, other }) => !!other && world.rel(dummy, other).romance >= 50,
    multiply: (c) => (has(c, "romantic") ? 3 : 1),
  },
  {
    id: "angry",
    applies: (c) => c.world.hasBuff(c.dummy, "angry"),
    multiply: (c) => (has(c, "mean") ? 3 : 1),
  },
  {
    id: "grieving",
    applies: (c) => c.world.hasBuff(c.dummy, "grieving") || c.world.hasBuff(c.dummy, "heartbroken"),
    multiply: (c) => (has(c, "romantic") ? 0.1 : has(c, "food") ? 0.5 : has(c, "social") ? 0.6 : 1),
  },
  {
    // Wet yourself or get shot down: hide from everyone for a while.
    id: "embarrassed",
    applies: (c) => c.world.hasBuff(c.dummy, "embarrassed"),
    multiply: (c) => (has(c, "social") || has(c, "romantic") ? 0.1 : 1),
  },
  {
    id: "clingy-favorite",
    applies: ({ world, dummy, other }) => dummy.personality === "clingy" && !!other && world.favoriteOf(dummy) === other,
    multiply: (c) => (has(c, "social") ? 3 : 1),
  },
];
