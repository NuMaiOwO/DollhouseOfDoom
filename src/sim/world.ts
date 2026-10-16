import { DEATHS } from "../data/deaths";
import { INTERACTION_BY_ID } from "../data/interactions";
import { pickName } from "../data/names";
import { DANGER, type ChaosLevel, type Danger } from "../data/tuning";
import { PERSONALITIES, PERSONALITY_IDS } from "../data/personalities";
import { acceptChance, canEngage, chooseAction } from "./autonomy";
import { CLIMB_MINUTES, DOOR_X, FLOORS, HOUSE_WIDTH, LADDER_X, RUN_SPEED, WALK_SPEED, furnish } from "./house";
import { clamp, createRng, type Rng } from "./rng";
import {
  NEEDS,
  type Action, type BuffId, type DeathCause, type Fire, type HouseObject, type LifeStage,
  type ObjectType, type PersonalityId, type Place, type Puddle, type Relationship, type Sim, type SimEvent,
} from "./types";

export const DAY = 1440;
export const ADULT_AT = 900;
export const POP_CAP = 15;
const CORPSE_MINUTES = 120;
const MAX_FIRES = 14;

/**
 * The whole simulation. Pure logic: no rendering, no timers.
 * Call tick() once per game-minute.
 */
export class World {
  t = 8 * 60;
  /** How accident-prone the house is (the Chaos slider). */
  chaos: ChaosLevel = "normal";
  readonly rng: Rng;
  sims: Sim[] = [];
  graveyard: Sim[] = [];
  objects: HouseObject[] = [];
  fires: Fire[] = [];
  puddles: Puddle[] = [];
  births = 0;
  firesStarted = 0;
  deaths: Partial<Record<DeathCause, number>> = {};
  readonly events: SimEvent[] = [];
  private rels = new Map<string, Relationship>();
  private nextId = 1;
  private listeners: Array<(e: SimEvent) => void> = [];

  constructor(readonly seed: number = Date.now() % 1e9) {
    this.rng = createRng(seed);
    furnish(this);
  }

  get danger(): Danger { return DANGER[this.chaos]; }

  get day() { return Math.floor(this.t / DAY) + 1; }
  get hour() { return Math.floor((this.t % DAY) / 60); }
  get living() { return this.sims.filter((s) => s.alive); }
  get population() { return this.living.length; }

  // ── Events ────────────────────────────────────────────────

  on(fn: (e: SimEvent) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  emit(e: Omit<SimEvent, "t">) {
    const ev = { ...e, t: this.t };
    this.events.push(ev);
    if (this.events.length > 1000) this.events.shift();
    for (const l of this.listeners) l(ev);
  }

  // ── Setup ─────────────────────────────────────────────────

  addObject(type: ObjectType, x: number, floor: number, quality: "cheap" | "normal" = "normal") {
    const o: HouseObject = { id: this.nextId++, type, x, floor, quality, userId: null, destroyed: false, broken: false, burn: 0 };
    this.objects.push(o);
    return o;
  }

  addSim(
    personality: PersonalityId,
    opts: { x?: number; floor?: number; ageMin?: number; parents?: [number, number]; generation?: number } = {},
  ): Sim | null {
    if (this.population >= POP_CAP) return null;
    const s: Sim = {
      id: this.nextId++,
      name: pickName(this),
      personality,
      x: opts.x ?? DOOR_X,
      floor: opts.floor ?? 0,
      facing: 1,
      climb: null,
      needs: { hunger: this.rng.range(55, 85), energy: this.rng.range(55, 90), social: this.rng.range(40, 80), bladder: this.rng.range(50, 90) },
      health: 100,
      ageMin: opts.ageMin ?? this.rng.range(ADULT_AT, ADULT_AT + 600), // move-ins are young adults
      lifespanMin: this.rng.range(4.5 * DAY, 5.5 * DAY),
      alive: true,
      action: null,
      buffs: [],
      parents: opts.parents ?? null,
      generation: opts.generation ?? 1,
      mateCooldownUntil: 0,
      passedOut: false,
      puddleId: null,
      considered: [],
    };
    this.sims.push(s);
    return s;
  }

  /** A new adult walks in through the front door. */
  moveIn(personality: PersonalityId): Sim | null {
    const s = this.addSim(personality);
    if (s) this.emit({ kind: "arrive", icon: "🚪", text: `${s.name} the ${PERSONALITIES[personality].label} moved in.`, simId: s.id, at: this.placeOf(s) });
    return s;
  }

  // ── Lookups ───────────────────────────────────────────────

  simById(id: number) { return this.sims.find((s) => s.id === id); }
  objectById(id: number) { return this.objects.find((o) => o.id === id); }
  fireById(id: number) { return this.fires.find((f) => f.id === id); }
  placeOf(s: Sim): Place { return { x: s.x, floor: s.floor }; }

  isAdult(s: Sim) { return s.ageMin >= ADULT_AT; }
  isElder(s: Sim) { return s.ageMin >= s.lifespanMin * 0.8; }
  stage(s: Sim): LifeStage { return !this.isAdult(s) ? "child" : this.isElder(s) ? "elder" : "adult"; }

  isAsleep(s: Sim) {
    const a = s.action;
    return !!a && a.phase === "doing" && INTERACTION_BY_ID[a.interactionId].anim === "sleep";
  }

  // ── Relationships ─────────────────────────────────────────

  rel(a: Sim, b: Sim): Relationship {
    const key = `${a.id}>${b.id}`;
    let r = this.rels.get(key);
    if (!r) this.rels.set(key, (r = { friendship: 0, romance: 0, partner: false }));
    return r;
  }

  bumpRel(a: Sim, b: Sim, d: { friendship?: number; romance?: number }) {
    const r = this.rel(a, b);
    const before = { ...r };
    r.friendship = clamp(r.friendship + (d.friendship ?? 0), -100, 100);
    r.romance = clamp(r.romance + (d.romance ?? 0), 0, 100);
    if (!a.alive || !b.alive) return;
    if (before.friendship < 50 && r.friendship >= 50)
      this.emit({ kind: "social", icon: "🤝", text: `${a.name} now considers ${b.name} a friend.`, simId: a.id });
    if (before.friendship > -30 && r.friendship <= -30)
      this.emit({ kind: "social", icon: "😠", text: `${a.name} now hates ${b.name}.`, simId: a.id });
    if (before.romance < 50 && r.romance >= 50)
      this.emit({ kind: "social", icon: "😍", text: `${a.name} has a crush on ${b.name}.`, simId: a.id });
  }

  relationsOf(s: Sim) {
    return [...this.sims, ...this.graveyard]
      .filter((o) => o !== s && this.rels.has(`${s.id}>${o.id}`))
      .map((other) => ({ other, rel: this.rel(s, other) }));
  }

  isFamily(a: Sim, b: Sim) {
    const pa: number[] = a.parents ?? [], pb: number[] = b.parents ?? [];
    return pa.includes(b.id) || pb.includes(a.id) || pa.some((p) => pb.includes(p));
  }

  partnerOf(s: Sim) {
    return this.living.find((o) => o !== s && this.rels.get(`${s.id}>${o.id}`)?.partner);
  }

  favoriteOf(s: Sim) {
    let best: Sim | undefined, bestScore = 10;
    for (const o of this.living) {
      if (o === s) continue;
      const r = this.rels.get(`${s.id}>${o.id}`);
      const score = r ? r.friendship + r.romance : 0;
      if (score > bestScore) [best, bestScore] = [o, score];
    }
    return best;
  }

  makePartners(a: Sim, b: Sim) {
    if (this.partnerOf(a) === b) return;
    for (const [s, newOne] of [[a, b], [b, a]] as const) {
      const ex = this.partnerOf(s);
      if (!ex) continue;
      this.rel(s, ex).partner = this.rel(ex, s).partner = false;
      this.addBuff(ex, "heartbroken", DAY);
      this.emit({ kind: "social", icon: "💔", text: `${s.name} dumped ${ex.name} for ${newOne.name}.`, simId: s.id });
    }
    this.rel(a, b).partner = this.rel(b, a).partner = true;
    this.emit({ kind: "social", icon: "💑", text: `${a.name} and ${b.name} are now a couple.`, simId: a.id });
  }

  /** A partner who sees their other half flirting gets furious. */
  checkJealousy(a: Sim, b: Sim) {
    for (const [cheater, other] of [[a, b], [b, a]] as const) {
      const p = this.partnerOf(cheater);
      if (!p || p === other || this.isAsleep(p) || p.floor !== cheater.floor || Math.abs(p.x - cheater.x) > 250) continue;
      this.addBuff(p, "angry", 240);
      this.bumpRel(p, other, { friendship: -25 });
      this.bumpRel(p, cheater, { friendship: -10, romance: -15 });
      this.emit({ kind: "social", icon: "😡", text: `${p.name} caught ${cheater.name} with ${other.name}!`, simId: p.id, at: this.placeOf(p) });
    }
  }

  // ── Buffs, damage, death, birth ───────────────────────────

  hasBuff(s: Sim, id: BuffId) { return s.buffs.some((b) => b.id === id && b.until > this.t); }

  addBuff(s: Sim, id: BuffId, minutes: number) {
    s.buffs = s.buffs.filter((b) => b.id !== id);
    s.buffs.push({ id, until: this.t + minutes });
  }

  damage(s: Sim, amount: number, cause: DeathCause) {
    if (!s.alive) return;
    s.health -= amount;
    if (s.health <= 0) this.kill(s, cause);
  }

  kill(s: Sim, cause: DeathCause) {
    if (!s.alive) return;
    this.endAction(s);
    s.alive = false;
    s.cause = cause;
    s.diedAt = this.t;
    s.health = 0;
    s.climb = null;
    this.deaths[cause] = (this.deaths[cause] ?? 0) + 1;
    this.emit({ kind: "death", icon: "💀", text: `${s.name} ${DEATHS[cause].verb}`, simId: s.id, cause, at: this.placeOf(s) });
    for (const o of this.living) {
      const r = this.rels.get(`${o.id}>${s.id}`);
      if (!r) continue;
      if (r.partner) this.addBuff(o, "heartbroken", DAY);
      else if (r.friendship >= 30 || r.romance >= 30) this.addBuff(o, "grieving", 8 * 60);
    }
  }

  spawnBaby(a: Sim, b: Sim): Sim | null {
    const personality = this.rng.chance(0.1) ? this.rng.pick(PERSONALITY_IDS) : this.rng.pick([a.personality, b.personality]);
    const baby = this.addSim(personality, {
      x: (a.x + b.x) / 2, floor: a.floor, ageMin: 0, parents: [a.id, b.id],
      generation: Math.max(a.generation, b.generation) + 1,
    });
    if (!baby) return null;
    baby.needs = { hunger: 80, energy: 80, social: 70, bladder: 80 };
    this.births++;
    for (const p of [a, b]) {
      this.bumpRel(p, baby, { friendship: 40 });
      this.bumpRel(baby, p, { friendship: 40 });
    }
    this.emit({
      kind: "birth", icon: "👶",
      text: `${a.name} and ${b.name} had a baby: ${baby.name} (${PERSONALITIES[personality].label}).`,
      simId: baby.id, at: this.placeOf(baby),
    });
    return baby;
  }

  // ── Fire ──────────────────────────────────────────────────

  startFire(x: number, floor: number, by?: Sim, objectType?: ObjectType) {
    if (this.fires.length >= MAX_FIRES || this.fires.some((f) => f.floor === floor && Math.abs(f.x - x) < 12)) return;
    this.fires.push({ id: this.nextId++, x, floor, intensity: 0.3, age: 0, life: this.rng.range(60, 120) });
    this.firesStarted++;
    if (by) this.emit({ kind: "fire", icon: "🔥", text: `${by.name} set the ${objectType ?? "house"} on fire!`, simId: by.id, at: { x, floor } });
  }

  private removeFire(f: Fire) {
    this.fires = this.fires.filter((x) => x !== f);
    if (!this.fires.length) this.emit({ kind: "fire_out", icon: "🧯", text: "The fire is out.", minor: true });
  }

  private destroyObject(o: HouseObject) {
    o.destroyed = true;
    if (o.userId !== null) {
      const user = this.simById(o.userId);
      if (user) this.endAction(user);
    }
    o.userId = null;
    this.emit({ kind: "destroyed", icon: "🔥", text: `The ${o.type} burned down.`, at: { x: o.x, floor: o.floor } });
  }

  /** Player lever: replace everything burnt or broken. */
  rebuild() {
    const fixed = this.objects.filter((o) => o.destroyed || o.broken);
    for (const o of fixed) { o.destroyed = false; o.broken = false; o.burn = 0; }
    if (fixed.length) this.emit({ kind: "info", icon: "🛠️", text: `Repaired or replaced ${fixed.length} object(s).` });
  }

  /** A Sim managed to fix something. */
  repair(o: HouseObject, by: Sim) {
    o.destroyed = false;
    o.broken = false;
    o.burn = 0;
    this.emit({ kind: "repair", icon: "🛠️", text: `${by.name} actually fixed the ${o.type}!`, simId: by.id, at: { x: o.x, floor: o.floor } });
  }

  addPuddle(x: number, floor: number) {
    if (this.puddles.length >= 12 || this.puddles.some((p) => p.floor === floor && Math.abs(p.x - x) < 14)) return;
    this.puddles.push({ id: this.nextId++, x: clamp(x, 8, HOUSE_WIDTH - 8), floor, age: 0, life: this.rng.range(8 * 60, 14 * 60) });
  }

  /** Walking over a puddle: usually a slip, occasionally a fatal one. */
  private checkSlip(s: Sim): boolean {
    const p = this.puddles.find((p) => p.floor === s.floor && Math.abs(p.x - s.x) < 10);
    if (!p) {
      s.puddleId = null;
      return false;
    }
    if (s.puddleId === p.id) return false;
    s.puddleId = p.id;
    const running = s.action?.run;
    if (!this.rng.chance(Math.min(0.95, this.danger.slip * (running ? 1.5 : 1)))) return false;
    this.endAction(s);
    this.emit({ kind: "accident", icon: "💫", minor: true, text: `${s.name} slipped in a puddle.`, simId: s.id, at: this.placeOf(s) });
    if (this.rng.chance(this.danger.fatalSlip * (this.isElder(s) ? 2.5 : 1))) {
      const landing = { x: clamp(s.x + s.facing * 34, 10, HOUSE_WIDTH - 10), floor: s.floor };
      s.action = { interactionId: "fatal_slip", target: { kind: "spot", id: 0 }, dest: landing, phase: "doing", elapsed: 0, duration: 14 };
      return true;
    }
    this.damage(s, this.rng.range(4, 12), "slipped");
    if (s.alive) s.action = { interactionId: "slipped", target: { kind: "spot", id: 0 }, dest: this.placeOf(s), phase: "doing", elapsed: 0, duration: 12 };
    return true;
  }

  /** The fridge tips over onto whoever is raiding it. */
  private crush(s: Sim, fridge: HouseObject) {
    fridge.broken = true;
    fridge.userId = null;
    this.emit({ kind: "accident", icon: "🧊", text: `The fridge fell on ${s.name}!`, simId: s.id, at: this.placeOf(s) });
    this.kill(s, "crushed");
  }

  /** The toilet explodes: whoever is on it (and anyone standing too close) goes through the roof. */
  launch(s: Sim, toilet: HouseObject) {
    toilet.broken = true;
    toilet.userId = null;
    this.addPuddle(toilet.x + 20, toilet.floor);
    this.addPuddle(toilet.x - 20, toilet.floor);
    // Sometimes it takes one unlucky bystander along too.
    const nearby = this.living.filter((o) => o !== s && !o.climb && o.floor === toilet.floor && Math.abs(o.x - toilet.x) < 24);
    const victims = nearby.length && this.rng.chance(0.5) ? [s, this.rng.pick(nearby)] : [s];
    for (const v of victims) {
      this.endAction(v);
      v.passedOut = false;
      v.x = toilet.x;
      const landing = { x: clamp(toilet.x + this.rng.range(-70, 70), 10, HOUSE_WIDTH - 10), floor: toilet.floor };
      v.action = { interactionId: "launched", target: { kind: "spot", id: 0 }, dest: landing, phase: "doing", elapsed: 0, duration: 24 };
    }
    const names = victims.map((v) => v.name).join(" and ");
    this.emit({ kind: "geyser", icon: "🚽", text: `The toilet exploded and launched ${names} into the sky!`, simId: s.id, at: { x: toilet.x, floor: toilet.floor } });
  }

  /** Player lever: the Chaos slider. */
  setChaos(level: ChaosLevel) {
    if (level === this.chaos) return;
    this.chaos = level;
    this.emit({ kind: "info", icon: level === "chaos" ? "🔥" : level === "calm" ? "😌" : "🙂", text: `Chaos level set to ${level}.` });
  }

  /** Player lever: cheap stoves catch fire more often. */
  setStoveQuality(quality: "cheap" | "normal") {
    for (const o of this.objects) if (o.type === "stove") o.quality = quality;
  }

  // ── Simulation step ───────────────────────────────────────

  tick() {
    this.t++;
    for (const s of this.sims) if (s.alive) this.updateBody(s);
    for (const s of this.sims) if (s.alive) this.reactToFire(s);
    for (const s of this.sims) {
      if (!s.alive) continue;
      if (s.action) this.stepAction(s);
      else this.startAction(s, chooseAction(this, s));
    }
    this.updateFires();
    for (const p of this.puddles) p.age++;
    this.puddles = this.puddles.filter((p) => p.age < p.life);
    this.buryCorpses();
  }

  private updateBody(s: Sim) {
    const p = PERSONALITIES[s.personality];
    const asleep = this.isAsleep(s);
    const decay = (k: (typeof NEEDS)[number], base: number) => {
      s.needs[k] = clamp(s.needs[k] - base * (p.decay?.[k] ?? 1), 0, 100);
    };
    decay("hunger", asleep ? 0.05 : 0.1);
    if (!asleep) decay("energy", 0.07);
    decay("social", asleep ? 0.03 : 0.08);
    decay("bladder", asleep ? 0.04 : 0.1);
    s.ageMin++;
    s.buffs = s.buffs.filter((b) => b.until > this.t);

    if (s.needs.hunger <= 0) this.damage(s, 0.08, "starved");
    else if (s.needs.hunger > 30 && s.health < 100) s.health = Math.min(100, s.health + 0.05);
    if (s.needs.social <= 0) this.damage(s, s.personality === "clingy" ? 0.06 : 0.03, "loneliness");
    if (!s.alive) return;
    if (s.ageMin >= s.lifespanMin) return this.kill(s, "old_age");
    if (s.action?.interactionId === "launched" || s.action?.interactionId === "fatal_slip") return;
    if (s.needs.energy <= 0 && !s.passedOut && !asleep) this.passOut(s);
    if (s.needs.bladder <= 0) {
      s.needs.bladder = 100;
      this.addBuff(s, "embarrassed", 8 * 60);
      this.addPuddle(s.x, s.climb ? s.climb.from : s.floor);
      this.emit({ kind: "info", icon: "💦", minor: true, text: `${s.name} wet themselves.`, simId: s.id });
    }
  }

  private passOut(s: Sim) {
    this.endAction(s);
    s.climb = null;
    s.passedOut = true;
    s.action = { interactionId: "passed_out", target: { kind: "spot", id: 0 }, dest: this.placeOf(s), phase: "doing", elapsed: 0, duration: 180 };
    this.emit({ kind: "info", icon: "😵", minor: true, text: `${s.name} passed out from exhaustion.`, simId: s.id });
  }

  private reactToFire(s: Sim) {
    if (s.climb || s.passedOut) return;
    const id = s.action?.interactionId;
    if (id === "flee" || id === "extinguish" || id === "launched" || id === "fatal_slip" || id === "slipped") return;
    const asleep = this.isAsleep(s);
    const range = asleep ? 40 : 140;
    let fire: Fire | undefined, best = range;
    for (const f of this.fires) {
      const d = Math.abs(f.x - s.x);
      if (f.floor === s.floor && d < best) [fire, best] = [f, d];
    }
    if (!fire) return;
    if (asleep && !this.rng.chance(0.08)) return; // heavy sleeper
    this.endAction(s);
    const run = { phase: "walking" as const, elapsed: 0, run: true };
    if (this.isAdult(s) && this.rng.chance(PERSONALITIES[s.personality].bravery)) {
      s.action = {
        ...run, interactionId: "extinguish", duration: 20, target: { kind: "fire", id: fire.id },
        dest: { x: clamp(fire.x + (s.x < fire.x ? -22 : 22), 0, HOUSE_WIDTH), floor: fire.floor },
      };
      return;
    }
    const away = s.x < fire.x ? 10 : HOUSE_WIDTH - 10;
    const dest = Math.abs(away - fire.x) > 200 ? { x: away, floor: s.floor } : { x: fire.x < LADDER_X ? 700 : 100, floor: s.floor === 0 ? 1 : 0 };
    s.action = { ...run, interactionId: "flee", duration: 30, target: { kind: "spot", id: 0 }, dest };
  }

  private startAction(s: Sim, a: Action | null) {
    if (!a) return;
    if (a.target.kind === "object") this.objectById(a.target.id)!.userId = s.id;
    s.action = a;
  }

  private stepAction(s: Sim) {
    const a = s.action!;
    const def = INTERACTION_BY_ID[a.interactionId];

    if (a.phase === "walking") {
      if (++a.elapsed > 240) return this.endAction(s);
      if (a.target.kind === "sim") {
        const o = this.simById(a.target.id);
        if (!o?.alive) return this.endAction(s);
        if (!o.climb) a.dest = { x: clamp(o.x + (s.x <= o.x ? -16 : 16), 0, HOUSE_WIDTH), floor: o.floor };
      }
      if (a.target.kind === "fire" && !this.fireById(a.target.id)) return this.endAction(s);
      if (this.moveToward(s, a.dest, a.run ? RUN_SPEED : WALK_SPEED)) this.beginDoing(s);
      return;
    }

    a.elapsed++;
    if (a.passive) {
      if (a.elapsed >= a.duration) this.endAction(s);
      return;
    }
    const other = a.target.kind === "sim" ? this.simById(a.target.id) : undefined;
    const object = a.target.kind === "object" ? this.objectById(a.target.id) : undefined;
    if ((a.target.kind === "sim" && !other?.alive) ) return this.endAction(s);
    if (object && (object.destroyed || object.broken) !== !!def.targetsBroken) return this.endAction(s);

    for (const k of NEEDS) {
      const g = def.gains?.[k];
      if (g) s.needs[k] = clamp(s.needs[k] + g / a.duration, 0, 100);
      const tg = def.targetGains?.[k];
      if (tg && other) other.needs[k] = clamp(other.needs[k] + tg / a.duration, 0, 100);
    }

    for (const h of def.hazards ?? []) {
      const p = PERSONALITIES[s.personality];
      const d = this.danger;
      const perUse = { crush: d.fridgeFall, geyser: d.toiletExplode, fire: d.stoveFire }[h.id];
      let chance = (perUse / def.duration) * (p.hazard?.[h.id] ?? 1);
      if (h.id === "fire" && object?.quality === "cheap") chance *= d.cheapStove;
      if (!this.rng.chance(chance)) continue;
      if (h.id === "crush" && object) return this.crush(s, object);
      if (h.id === "geyser" && object) return this.launch(s, object);
      if (h.id === "fire" && object) {
        this.startFire(object.x, object.floor, s, object.type);
        this.endAction(s);
        return this.damage(s, this.rng.range(15, 45) * (this.isElder(s) ? 1.5 : 1), "burned");
      }
    }

    if (a.target.kind === "fire") {
      const f = this.fireById(a.target.id);
      if (!f) return this.completeAction(s);
      f.intensity -= 0.07;
      if (f.intensity <= 0) {
        this.emit({ kind: "info", icon: "💦", minor: true, text: `${s.name} put out a fire.`, simId: s.id });
        this.removeFire(f);
        return this.completeAction(s);
      }
    }

    if (a.elapsed >= a.duration || def.stopWhen?.(s, a)) this.completeAction(s);
  }

  private beginDoing(s: Sim) {
    const a = s.action!;
    const def = INTERACTION_BY_ID[a.interactionId];
    const other = a.target.kind === "sim" ? this.simById(a.target.id) : undefined;
    if (other) {
      if (!other.alive || other.climb || other.floor !== s.floor || Math.abs(other.x - s.x) > 40 || !canEngage(this, other)) {
        return this.endAction(s);
      }
      if (def.needsAccept && !this.rng.chance(acceptChance(this, s, other, def))) {
        const romantic = def.tags.includes("romantic");
        this.bumpRel(s, other, { friendship: -2 });
        if (romantic) this.addBuff(s, "embarrassed", 120);
        this.emit({ kind: "rejected", icon: romantic ? "🙅" : "🙄", minor: true, text: `${other.name} rejected ${s.name} (${def.label}).`, simId: s.id });
        return this.endAction(s);
      }
      this.endAction(other);
      other.action = {
        interactionId: def.id, target: { kind: "sim", id: s.id }, dest: this.placeOf(other),
        phase: "doing", elapsed: 0, duration: a.duration + 5, passive: true,
      };
      s.facing = other.x >= s.x ? 1 : -1;
      other.facing = s.facing === 1 ? -1 : 1;
    }
    a.phase = "doing";
    a.elapsed = 0;
    def.onStart?.({ world: this, sim: s, def, other, action: a, object: a.target.kind === "object" ? this.objectById(a.target.id) : undefined });
  }

  private completeAction(s: Sim) {
    const a = s.action!;
    const def = INTERACTION_BY_ID[a.interactionId];
    const other = a.target.kind === "sim" ? this.simById(a.target.id) : undefined;
    const object = a.target.kind === "object" ? this.objectById(a.target.id) : undefined;
    def.onComplete?.({ world: this, sim: s, def, other, object, action: a });
    this.endAction(s);
  }

  /** Stop whatever the Sim is doing and release anything it held (objects, a social partner). */
  endAction(s: Sim) {
    const a = s.action;
    if (!a) return;
    s.action = null;
    if (a.interactionId === "passed_out") s.passedOut = false;
    if (a.target.kind === "object") {
      const o = this.objectById(a.target.id);
      if (o?.userId === s.id) o.userId = null;
    }
    if (a.target.kind === "sim" && a.phase === "doing") {
      const o = this.simById(a.target.id);
      const linked = o?.action?.target.kind === "sim" && o.action.target.id === s.id && o.action.phase === "doing";
      if (o && linked && (o.action!.passive || a.passive)) this.endAction(o);
    }
  }

  private moveToward(s: Sim, dest: Place, speed: number): boolean {
    if (s.climb) {
      s.climb.progress += (speed > WALK_SPEED ? 2 : 1) / CLIMB_MINUTES;
      if (s.climb.progress >= 1) {
        s.floor = s.climb.to;
        s.climb = null;
      }
      return false;
    }
    const goal = s.floor === dest.floor ? dest.x : LADDER_X;
    const dx = goal - s.x;
    if (dx !== 0) s.facing = dx > 0 ? 1 : -1;
    if (Math.abs(dx) > speed) {
      s.x += Math.sign(dx) * speed;
      this.checkSlip(s);
      return false;
    }
    s.x = goal;
    if (this.checkSlip(s)) return false;
    if (s.floor !== dest.floor) {
      s.climb = { from: s.floor, to: s.floor + Math.sign(dest.floor - s.floor), progress: 0 };
      return false;
    }
    return true;
  }

  private updateFires() {
    for (const f of [...this.fires]) {
      f.age++;
      f.intensity = Math.min(1, f.intensity + 0.012);
      if (f.age >= f.life) {
        this.removeFire(f);
        continue;
      }
      if (f.intensity > 0.6 && this.rng.chance(0.03)) {
        this.startFire(clamp(f.x + this.rng.pick([-1, 1]) * this.rng.range(18, 30), 6, HOUSE_WIDTH - 6), f.floor);
      }
      // Fire near the ladder can climb to the floor above.
      if (f.floor < FLOORS - 1 && Math.abs(f.x - LADDER_X) < 40 && f.intensity > 0.6 && this.rng.chance(0.02)) {
        this.startFire(LADDER_X + this.rng.range(-20, 20), f.floor + 1);
      }
      for (const o of this.objects) {
        if (o.destroyed || o.floor !== f.floor || Math.abs(o.x - f.x) >= 24) continue;
        o.burn += f.intensity;
        if (o.burn >= 50) this.destroyObject(o);
      }
      for (const s of this.sims) {
        if (s.alive && !s.climb && s.floor === f.floor && Math.abs(s.x - f.x) < 16) this.damage(s, 5 * f.intensity, "burned");
      }
    }
  }

  private buryCorpses() {
    const ready = this.sims.filter((s) => !s.alive && this.t - s.diedAt! >= CORPSE_MINUTES);
    if (!ready.length) return;
    this.sims = this.sims.filter((s) => !ready.includes(s));
    this.graveyard.push(...ready);
  }
}
