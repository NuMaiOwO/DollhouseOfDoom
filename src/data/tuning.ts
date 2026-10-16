/**
 * Every accident number in one place, per Chaos level (the in-game slider).
 *
 * Agreed targets for NORMAL, checked by `npm run balance`:
 *   - Busy house (8 Dummies): someone dies every 2–3 real minutes at 1× speed.
 *   - The default house usually reaches grandkids (generation 3+), with the player moving someone in each day.
 *   - Object accidents (toilet, fridge, fire) are the top killers, ahead of beatings.
 * CHAOS is roughly NuMaiOwO's "comically frequent" values; CALM is the first prototype's.
 */
export type ChaosLevel = "calm" | "normal" | "chaos";

export interface Danger {
  /** Chance the fridge falls on you, per snack. */
  fridgeFall: number;
  /** Chance the toilet explodes, per use. */
  toiletExplode: number;
  /** Chance a meal starts a fire on a safe stove. */
  stoveFire: number;
  /** Fire chance multiplier for a cheap stove. */
  cheapStove: number;
  /** Chance that crossing a puddle is a slip (running: ×1.5). */
  slip: number;
  /** Chance a slip is fatal (elders: ×2.5). */
  fatalSlip: number;
  /** Multiplier on fight damage. */
  fightDamage: number;
  /** Chance a Dummy's repair attempt works. */
  repairSuccess: number;
}

export const DANGER: Record<ChaosLevel, Danger> = {
  calm: { fridgeFall: 0.004, toiletExplode: 0.006, stoveFire: 0.01, cheapStove: 3, slip: 0.3, fatalSlip: 0.01, fightDamage: 0.2, repairSuccess: 0.4 },
  normal: { fridgeFall: 0.012, toiletExplode: 0.015, stoveFire: 0.02, cheapStove: 3, slip: 0.4, fatalSlip: 0.01, fightDamage: 0.3, repairSuccess: 0.2 },
  chaos: { fridgeFall: 0.1, toiletExplode: 0.1, stoveFire: 0.05, cheapStove: 3, slip: 0.6, fatalSlip: 0.06, fightDamage: 1.3, repairSuccess: 0.1 },
};

export const CHAOS_LEVELS: { id: ChaosLevel; label: string }[] = [
  { id: "calm", label: "😌 Calm" },
  { id: "normal", label: "🙂 Normal" },
  { id: "chaos", label: "🔥 Chaos" },
];
