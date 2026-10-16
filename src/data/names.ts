import type { World } from "../sim/world";

const NAMES = [
  "Bob", "Gloria", "Dirk", "Mimi", "Chad", "Bertha", "Kevin", "Pam", "Moe", "Tina",
  "Gus", "Wanda", "Lenny", "Doris", "Rico", "Fern", "Biff", "Nadia", "Otis", "Peggy",
  "Ziggy", "Hilda", "Barry", "Lulu", "Vinny", "Opal", "Duke", "Trixie", "Sal", "Edna",
  "Rex", "Bunny", "Clint", "Mavis", "Tito", "Gwen", "Norbert", "Kiki", "Frank", "Dolly",
];

const SUFFIXES = ["", " II", " III", " IV", " V", " VI", " VII", " VIII"];

export function pickName(w: World): string {
  const used = new Set([...w.dummies, ...w.graveyard].map((s) => s.name));
  for (const suffix of SUFFIXES) {
    const free = NAMES.map((n) => n + suffix).filter((n) => !used.has(n));
    if (free.length) return w.rng.pick(free);
  }
  return `Dummy #${w.dummies.length + w.graveyard.length + 1}`;
}
