/**
 * Headless balance report: runs many houses and summarises how people died.
 *   npm run simulate -- [runs=50] [days=6] [cast=asshole,flirty,foodie,clingy]
 */
import { DEATHS } from "../src/data/deaths";
import { DEFAULT_CAST, runWorld } from "../src/sim/scenario";
import type { DeathCause, PersonalityId } from "../src/sim/types";

const runs = Number(process.argv[2] ?? 50);
const days = Number(process.argv[3] ?? 6);
const cast = (process.argv[4]?.split(",") as PersonalityId[] | undefined) ?? DEFAULT_CAST;

const deaths: Partial<Record<DeathCause, number>> = {};
const firstDeathDays: number[] = [];
let births = 0, fires = 0, maxGen = 0, aliveAtEnd = 0, extinct = 0;
const interactions: Record<string, number> = {};

for (let seed = 1; seed <= runs; seed++) {
  const w = runWorld(seed, days, cast);
  for (const [cause, n] of Object.entries(w.deaths)) deaths[cause as DeathCause] = (deaths[cause as DeathCause] ?? 0) + n;
  const firstDeath = w.events.find((e) => e.kind === "death");
  if (firstDeath) firstDeathDays.push(firstDeath.t / 1440);
  births += w.births;
  fires += w.firesStarted;
  aliveAtEnd += w.population;
  if (w.population === 0) extinct++;
  maxGen = Math.max(maxGen, ...[...w.sims, ...w.graveyard].map((s) => s.generation));
  for (const e of w.events) interactions[e.kind] = (interactions[e.kind] ?? 0) + 1;
}

const avg = (n: number) => (n / runs).toFixed(2);
console.log(`\n${runs} houses × ${days} days, cast: ${cast.join(", ")}\n`);
console.log("Deaths per house:");
for (const cause of Object.keys(DEATHS) as DeathCause[]) console.log(`  ${DEATHS[cause].title.padEnd(20)} ${avg(deaths[cause] ?? 0)}`);
console.log(`\nBirths per house:      ${avg(births)}`);
console.log(`Fires per house:       ${avg(fires)}`);
console.log(`Alive at end (avg):    ${avg(aliveAtEnd)}`);
console.log(`Extinct houses:        ${extinct}/${runs}`);
console.log(`Max generation:        ${maxGen}`);
const sorted = firstDeathDays.sort((a, b) => a - b);
if (sorted.length) console.log(`First death (median):  day ${sorted[Math.floor(sorted.length / 2)].toFixed(2)}`);
console.log(`Event counts:          ${JSON.stringify(interactions)}\n`);
