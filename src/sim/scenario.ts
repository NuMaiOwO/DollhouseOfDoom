import type { ChaosLevel } from "../data/tuning";
import type { PersonalityId } from "./types";
import { DAY, World } from "./world";

export const DEFAULT_CAST: PersonalityId[] = ["asshole", "flirty", "foodie", "clingy"];

/** Run a house with no graphics, as fast as possible. Used by tests and `npm run simulate`. */
export function runWorld(
  seed: number, days: number, cast: PersonalityId[] = DEFAULT_CAST, setup?: (w: World) => void, chaos: ChaosLevel = "normal",
) {
  const w = new World(seed);
  w.chaos = chaos;
  for (const p of cast) {
    const s = w.addDummy(p)!;
    s.x = w.rng.range(40, 760);
    s.floor = w.rng.int(0, 1);
  }
  setup?.(w);
  const end = w.t + days * DAY;
  while (w.t < end) w.tick();
  return w;
}
