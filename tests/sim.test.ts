import { describe, expect, it } from "vitest";
import { INTERACTION_BY_ID } from "../src/data/interactions";
import { isAvailable } from "../src/sim/autonomy";
import { runWorld } from "../src/sim/scenario";
import { DAY, World } from "../src/sim/world";

const summary = (w: World) => JSON.stringify({ t: w.t, deaths: w.deaths, births: w.births, events: w.events.map((e) => e.text) });

describe("simulation", () => {
  it("is deterministic for a given seed", () => {
    expect(summary(runWorld(42, 3))).toBe(summary(runWorld(42, 3)));
  });

  it("nobody starves on day one while the fridge works", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const w = runWorld(seed, 1);
      const fridgeWentDown = w.events.some((e) => (e.kind === "destroyed" || e.kind === "accident") && e.text.includes("fridge"));
      if (fridgeWentDown) continue; // burnt or toppled at some point: starving is fair
      expect(w.deaths.starved ?? 0).toBe(0);
    }
  });

  it("foodies with a cheap stove start fires", () => {
    let housesWithFire = 0;
    for (let seed = 1; seed <= 30; seed++) {
      if (runWorld(seed, 3, ["foodie", "foodie"]).firesStarted > 0) housesWithFire++;
    }
    expect(housesWithFire).toBeGreaterThanOrEqual(10);
  });

  it("a house of assholes ends in beatings", () => {
    let beaten = 0;
    for (let seed = 1; seed <= 10; seed++) beaten += runWorld(seed, 5, ["asshole", "asshole", "asshole", "asshole"]).deaths.beaten ?? 0;
    expect(beaten).toBeGreaterThan(0);
  });

  it("flirty houses make babies", () => {
    let births = 0;
    for (let seed = 1; seed <= 10; seed++) births += runWorld(seed, 4, ["flirty", "flirty", "flirty"]).births;
    expect(births).toBeGreaterThan(0);
  });

  it("everyone dies of old age eventually", () => {
    const w = new World(1);
    const s = w.addDummy("clingy")!;
    s.ageMin = s.lifespanMin - 5;
    for (let i = 0; i < 10; i++) w.tick();
    expect(s.alive).toBe(false);
    expect(s.cause).toBe("old_age");
  });

  it("an exploding toilet launches its user (and bystanders) to their death", () => {
    const w = new World(1);
    const toilet = w.objects.find((o) => o.type === "toilet")!;
    const user = w.addDummy("foodie", { x: toilet.x, floor: toilet.floor })!;
    const bystander = w.addDummy("clingy", { x: toilet.x + 10, floor: toilet.floor })!;
    const farAway = w.addDummy("flirty", { x: 50, floor: 0 })!;
    w.launch(user, toilet);
    expect(toilet.broken).toBe(true);
    for (let i = 0; i < 30; i++) w.tick();
    expect(user.cause).toBe("toilet");
    expect(bystander.cause).toBe("toilet");
    expect(farAway.alive).toBe(true);
    w.rebuild();
    expect(toilet.broken).toBe(false);
  });

  it("toilets explode now and then in normal play", () => {
    let launches = 0;
    for (let seed = 1; seed <= 30; seed++) launches += runWorld(seed, 6).deaths.toilet ?? 0;
    expect(launches).toBeGreaterThan(0);
  });

  it("wetting yourself leaves a puddle and embarrassment", () => {
    const w = new World(1);
    const s = w.addDummy("flirty")!;
    s.needs.bladder = 0.01;
    w.tick();
    expect(w.puddles.length).toBe(1);
    expect(w.hasBuff(s, "embarrassed")).toBe(true);
  });

  it("puddles make people slip, and sometimes it's fatal", () => {
    let slips = 0, deaths = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const w = new World(seed);
      const s = w.addDummy("foodie", { x: 300, floor: 0 })!;
      w.addPuddle(250, 0);
      w.objects.find((o) => o.type === "fridge")!.x = 200; // give them a reason to walk over it
      s.needs.hunger = 5;
      w.events.length = 0;
      for (let i = 0; i < 40; i++) w.tick();
      if (w.events.some((e) => e.kind === "accident")) slips++;
      if (s.cause === "slipped") deaths++;
    }
    expect(slips).toBeGreaterThan(50);
    expect(deaths).toBeGreaterThan(0);
    expect(deaths).toBeLessThan(slips / 4);
  });

  it("the fridge can fall on someone and break", () => {
    let crushed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = runWorld(seed, 6, ["foodie", "foodie", "foodie"]);
      if (w.deaths.crushed) {
        crushed++;
        const fridge = w.objects.find((o) => o.type === "fridge")!;
        expect(fridge.broken || fridge.destroyed || w.events.some((e) => e.kind === "repair")).toBe(true);
      }
    }
    expect(crushed).toBeGreaterThan(0);
  });

  it("dummies eventually repair broken things themselves", () => {
    let fixedHouses = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const w = runWorld(seed, 0, undefined, (w) => {
        w.objects.find((o) => o.type === "toilet")!.broken = true;
      });
      for (let i = 0; i < 1440 && w.objects.find((o) => o.type === "toilet")!.broken; i++) w.tick();
      if (!w.objects.find((o) => o.type === "toilet")!.broken) fixedHouses++;
    }
    expect(fixedHouses).toBeGreaterThan(5);
  });

  it("anyone can die of loneliness, not just clingy dummies", () => {
    const w = new World(1);
    const s = w.addDummy("asshole")!;
    s.needs.social = 0;
    s.needs.hunger = 20; // no health regen
    s.health = 0.02;
    w.tick();
    expect(s.cause).toBe("loneliness");
  });

  it("fire burns objects next to it", () => {
    const w = new World(1);
    const stove = w.objects.find((o) => o.type === "stove")!;
    w.startFire(stove.x, stove.floor);
    for (let i = 0; i < 60; i++) w.tick();
    expect(stove.burn).toBeGreaterThan(0);
  });
});

describe("save / load", () => {
  it("a loaded game continues exactly as if it never stopped", () => {
    for (const seed of [3, 11, 42]) {
      const original = runWorld(seed, 1.5, ["asshole", "flirty", "foodie", "clingy", "flirty"], undefined, "chaos");
      const loaded = World.fromSave(JSON.parse(JSON.stringify(original.toSave())));
      for (let i = 0; i < 2 * DAY; i++) {
        original.tick();
        loaded.tick();
      }
      const later = (w: World) => JSON.stringify({ t: w.t, deaths: w.deaths, births: w.births, events: w.events.slice(-100).map((e) => e.text) });
      expect(later(loaded)).toBe(later(original));
    }
  });

  it("loads saves from before the Sims → Dummies rename (v1)", () => {
    const current = runWorld(7, 0.5);
    const v1 = JSON.parse(JSON.stringify(current.toSave()));
    v1.version = 1;
    v1.sims = v1.dummies;
    delete v1.dummies;
    for (const e of v1.events) if (e.dummyId !== undefined) { e.simId = e.dummyId; delete e.dummyId; }
    const loaded = World.fromSave(v1);
    expect(loaded.dummies.map((d) => d.name)).toEqual(current.dummies.map((d) => d.name));
    expect(loaded.events.some((e) => e.dummyId !== undefined)).toBe(true);
  });

  it("refuses saves from an incompatible version", () => {
    const data = { ...new World(1).toSave(), version: 999 };
    expect(() => World.fromSave(data)).toThrow();
  });
});

describe("chaos slider", () => {
  it("calm < normal < chaos in deaths", () => {
    const deaths = (level: "calm" | "normal" | "chaos") => {
      let n = 0;
      for (let seed = 1; seed <= 15; seed++) {
        const w = runWorld(seed, 3, ["asshole", "flirty", "foodie", "clingy", "asshole", "flirty", "foodie", "clingy"], undefined, level);
        n += w.graveyard.length + w.dummies.filter((s) => !s.alive).length;
      }
      return n;
    };
    const calm = deaths("calm"), normal = deaths("normal"), chaos = deaths("chaos");
    expect(calm).toBeLessThan(normal);
    expect(normal).toBeLessThan(chaos);
  });
});

describe("availability rules", () => {
  it("children can't flirt", () => {
    const w = new World(1);
    const kid = w.addDummy("flirty", { ageMin: 0 })!;
    const adult = w.addDummy("flirty")!;
    expect(isAvailable({ world: w, dummy: kid, other: adult, def: INTERACTION_BY_ID.flirt })).toBe(false);
    expect(isAvailable({ world: w, dummy: adult, other: kid, def: INTERACTION_BY_ID.flirt })).toBe(false);
  });

  it("family members never mate", () => {
    const w = new World(1);
    const parent = w.addDummy("flirty")!;
    const other = w.addDummy("flirty")!;
    const child = w.addDummy("flirty", { ageMin: DAY, parents: [parent.id, other.id] })!;
    w.rel(parent, child).romance = 100;
    expect(isAvailable({ world: w, dummy: parent, other: child, def: INTERACTION_BY_ID.mate })).toBe(false);
  });
});
