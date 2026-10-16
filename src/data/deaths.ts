import type { DeathCause, Sim } from "../sim/types";

interface DeathInfo {
  title: string;
  /** Completes "<name> ..." in the event log. */
  verb: string;
  /** Codex hint shown before the death is discovered. */
  hint: string;
  epitaphs: string[];
}

export const DEATHS: Record<DeathCause, DeathInfo> = {
  starved: {
    title: "Starved",
    verb: "starved to death.",
    hint: "What happens when the fridge is gone?",
    epitaphs: ["Never found the fridge.", "Was too busy to eat. Forever now."],
  },
  burned: {
    title: "Burned to a Crisp",
    verb: "burned to a crisp.",
    hint: "Cheap stoves are a bargain.",
    epitaphs: ["Well done.", "Finally warm.", "Should have bought the good stove."],
  },
  crushed: {
    title: "Crushed by Fridge",
    verb: "was crushed by the fridge.",
    hint: "Don't rock the fridge.",
    epitaphs: ["Wanted a midnight snack. Got the whole fridge.", "Pinned by their appetite."],
  },
  slipped: {
    title: "Slipped in a Puddle",
    verb: "slipped in a puddle and cracked their head.",
    hint: "Someone should really mop that up.",
    epitaphs: ["Didn't watch their step.", "Slipped away. Then hit the floor."],
  },
  beaten: {
    title: "Beaten to Death",
    verb: "was beaten to death.",
    hint: "Hate someone long enough...",
    epitaphs: ["Lost the argument.", "Should have walked away."],
  },
  old_age: {
    title: "Old Age",
    verb: "died of old age.",
    hint: "Survive long enough.",
    epitaphs: ["Made it. Somehow.", "Outlived the stove."],
  },
  toilet: {
    title: "Toilet Rocket",
    verb: "was launched through the roof by an exploding toilet.",
    hint: "Never trust the plumbing.",
    epitaphs: ["Flushed with success.", "Went up. Came down.", "Should have used the bushes."],
  },
  loneliness: {
    title: "Died of Loneliness",
    verb: "died of loneliness.",
    hint: "Some people really need a hug.",
    epitaphs: ["Nobody came to the funeral either.", "Just wanted a friend."],
  },
};

export function epitaph(s: Sim): string {
  if (!s.cause) return "";
  const list = DEATHS[s.cause].epitaphs;
  return list[s.id % list.length];
}
