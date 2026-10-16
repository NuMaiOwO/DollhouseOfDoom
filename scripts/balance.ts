/**
 * Checks each Chaos level against the agreed death-rate targets (see src/data/tuning.ts).
 *   npm run balance            all levels
 *   npm run balance -- normal  one level
 */
import { DEATHS } from "../src/data/deaths";
import type { ChaosLevel } from "../src/data/tuning";
import { PERSONALITY_IDS } from "../src/data/personalities";
import { DEFAULT_CAST, runWorld } from "../src/sim/scenario";
import type { DeathCause, PersonalityId, Dummy } from "../src/sim/types";
import { DAY, type World } from "../src/sim/world";

const RUNS = 40;
const REAL_MIN_PER_DAY = 1440 / 10 / 60; // 1× speed = 10 game-minutes per real second
const BUSY_CAST: PersonalityId[] = [...DEFAULT_CAST, ...DEFAULT_CAST];
const ACCIDENTS: DeathCause[] = ["toilet", "crushed", "burned"];

interface Target { label: string; value: number; ok: (v: number) => boolean; fmt: (v: number) => string }

const TARGETS: Record<ChaosLevel, (r: Result) => Target[]> = {
  calm: (r) => [
    { label: "Busy house: minutes between deaths", value: r.minPerDeath, ok: (v) => v >= 4, fmt: (v) => `${v.toFixed(1)} min (want ≥ 4)` },
    { label: "Houses reaching grandkids (gen 3+)", value: r.gen3, ok: (v) => v >= 0.5, fmt: pct("≥ 50%") },
  ],
  normal: (r) => [
    { label: "Busy house: minutes between deaths", value: r.minPerDeath, ok: (v) => v >= 2 && v <= 3, fmt: (v) => `${v.toFixed(1)} min (want 2–3)` },
    { label: "Houses reaching grandkids (gen 3+)", value: r.gen3, ok: (v) => v >= 0.5, fmt: pct("≥ 50%") },
    { label: "Object accidents vs beatings", value: r.accidents - r.beaten, ok: (v) => v > 0, fmt: () => `${(r.accidents * 100).toFixed(0)}% vs ${(r.beaten * 100).toFixed(0)}% (want accidents ahead)` },
  ],
  chaos: (r) => [
    { label: "Busy house: minutes between deaths", value: r.minPerDeath, ok: (v) => v <= 1.5, fmt: (v) => `${v.toFixed(1)} min (want ≤ 1.5)` },
    { label: "Object accidents vs beatings", value: r.accidents - r.beaten, ok: (v) => v > 0, fmt: () => `${(r.accidents * 100).toFixed(0)}% vs ${(r.beaten * 100).toFixed(0)}% (want accidents ahead)` },
  ],
};

function pct(want: string) {
  return (v: number) => `${(v * 100).toFixed(0)}% (want ${want})`;
}

type Causes = Partial<Record<DeathCause, number>>;
interface Result { minPerDeath: number; gen3: number; accidents: number; beaten: number; busyCauses: Causes; familyCauses: Causes; births: number }

const deadIn = (w: World): Dummy[] => [...w.graveyard, ...w.dummies.filter((s) => !s.alive)];

function measure(chaos: ChaosLevel): Result {
  // Busy house: 8 Dummies, 3 days, count deaths per real minute.
  let busyDeaths = 0;
  const busyCauses: Causes = {}, familyCauses: Causes = {};
  for (let seed = 1; seed <= RUNS; seed++) {
    const w = runWorld(seed, 3, BUSY_CAST, undefined, chaos);
    for (const s of deadIn(w)) {
      busyDeaths++;
      busyCauses[s.cause!] = (busyCauses[s.cause!] ?? 0) + 1;
    }
  }
  const minPerDeath = (RUNS * 3 * REAL_MIN_PER_DAY) / busyDeaths;

  // Families: default 4-Dummy house over 8 days, with a new Dummy moving in each morning (an active player).
  let gen3 = 0, births = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const w = runWorld(seed, 0, DEFAULT_CAST, undefined, chaos);
    for (let day = 0; day < 8; day++) {
      for (let i = 0; i < DAY; i++) w.tick();
      w.moveIn(w.rng.pick(PERSONALITY_IDS));
    }
    births += w.births;
    if ([...w.dummies, ...w.graveyard].some((s) => s.generation >= 3)) gen3++;
    for (const s of deadIn(w)) familyCauses[s.cause!] = (familyCauses[s.cause!] ?? 0) + 1;
  }

  // "Top killers" is judged on the busy house: that is where the moment-to-moment comedy happens.
  const total = Object.values(busyCauses).reduce((a, b) => a + b, 0);
  const share = (cs: DeathCause[]) => cs.reduce((a, c) => a + (busyCauses[c] ?? 0), 0) / total;
  return { minPerDeath, gen3: gen3 / RUNS, accidents: share(ACCIDENTS), beaten: share(["beaten"]), busyCauses, familyCauses, births: births / RUNS };
}

const levels = (process.argv[2] ? [process.argv[2]] : ["calm", "normal", "chaos"]) as ChaosLevel[];
let allOk = true;
for (const level of levels) {
  const r = measure(level);
  console.log(`\n=== ${level.toUpperCase()} ===`);
  for (const t of TARGETS[level](r)) {
    const ok = t.ok(t.value);
    allOk &&= ok;
    console.log(`  ${ok ? "✓" : "✗"} ${t.label.padEnd(38)} ${t.fmt(t.value)}`);
  }
  console.log(`    babies per default house: ${r.births.toFixed(1)}`);
  console.log(`    busy house deaths:   ${breakdown(r.busyCauses)}`);
  console.log(`    family house deaths: ${breakdown(r.familyCauses)}`);
}
console.log(allOk ? "\nAll targets met." : "\nSome targets missed.");
process.exitCode = allOk ? 0 : 1;

function breakdown(causes: Causes) {
  const total = Object.values(causes).reduce((a, b) => a + b, 0);
  return (Object.entries(causes) as [DeathCause, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${DEATHS[c].title} ${((n / total) * 100).toFixed(0)}%`)
    .join(", ");
}
