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
      if (w.objects.find((o) => o.type === "fridge")!.destroyed) continue; // fire got it: starving is fair
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
    const s = w.addSim("clingy")!;
    s.ageMin = s.lifespanMin - 5;
    for (let i = 0; i < 10; i++) w.tick();
    expect(s.alive).toBe(false);
    expect(s.cause).toBe("old_age");
  });

  it("an exploding toilet launches its user (and bystanders) to their death", () => {
    const w = new World(1);
    const toilet = w.objects.find((o) => o.type === "toilet")!;
    const user = w.addSim("foodie", { x: toilet.x, floor: toilet.floor })!;
    const bystander = w.addSim("clingy", { x: toilet.x + 10, floor: toilet.floor })!;
    const farAway = w.addSim("flirty", { x: 50, floor: 0 })!;
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

  it("fire burns objects next to it", () => {
    const w = new World(1);
    const stove = w.objects.find((o) => o.type === "stove")!;
    w.startFire(stove.x, stove.floor);
    for (let i = 0; i < 60; i++) w.tick();
    expect(stove.burn).toBeGreaterThan(0);
  });
});

describe("availability rules", () => {
  it("children can't flirt", () => {
    const w = new World(1);
    const kid = w.addSim("flirty", { ageMin: 0 })!;
    const adult = w.addSim("flirty")!;
    expect(isAvailable({ world: w, sim: kid, other: adult, def: INTERACTION_BY_ID.flirt })).toBe(false);
    expect(isAvailable({ world: w, sim: adult, other: kid, def: INTERACTION_BY_ID.flirt })).toBe(false);
  });

  it("family members never mate", () => {
    const w = new World(1);
    const parent = w.addSim("flirty")!;
    const other = w.addSim("flirty")!;
    const child = w.addSim("flirty", { ageMin: DAY, parents: [parent.id, other.id] })!;
    w.rel(parent, child).romance = 100;
    expect(isAvailable({ world: w, sim: parent, other: child, def: INTERACTION_BY_ID.mate })).toBe(false);
  });
});
