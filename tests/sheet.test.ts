import { describe, expect, it } from "vitest";
import { DEFAULT_CHARACTERS } from "../src/sheet/defaults";
import { MAX_DISTANCE, labToRgb, matchSheet, rankMatches, rgbToLab, rollGenes, tagDistance } from "../src/sheet/genes";
import { TAG_KEYS, VIEWS, decodeSheet, encodeSheet, idx, type Tags } from "../src/sheet/sheet";
import { createRng } from "../src/sim/rng";

const same = (a: Uint32Array, b: Uint32Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const sasuke: Tags = { hair: 0x1b1b2a, skin: 0xf1c27d, eyes: 0x555b66 };
const anya: Tags = { hair: 0xff6fb5, skin: 0xffdbc4, eyes: 0x27ae60 };
const colorsIn = (p: Uint32Array) => new Set([...p].filter(Boolean).map((c) => c >>> 8));

describe("sheets", () => {
  it("encode / decode round-trips all three views exactly", () => {
    const s = structuredClone(DEFAULT_CHARACTERS[1].sheet);
    s.left[idx(3, 3)] = 0x12345678; // a detail only on the left view
    const back = decodeSheet(encodeSheet(s));
    for (const v of VIEWS) expect(same(back[v], s[v])).toBe(true);
    expect(back.right[idx(3, 3)]).not.toBe(0x12345678);
  });

  it("stays small enough to keep many Dummies in a save", () => {
    for (const c of DEFAULT_CHARACTERS) expect(encodeSheet(c.sheet).length).toBeLessThan(3000);
  });

  it("ships enough defaults, with distinct tags that really appear in their pixels", () => {
    expect(DEFAULT_CHARACTERS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(DEFAULT_CHARACTERS.map((c) => JSON.stringify(c.tags))).size).toBe(DEFAULT_CHARACTERS.length);
    for (const c of DEFAULT_CHARACTERS) {
      const used = colorsIn(c.sheet.right);
      for (const k of TAG_KEYS) expect(used.has(c.tags[k])).toBe(true);
      expect(colorsIn(c.sheet.back).size).toBeGreaterThan(0); // every default has a back view
    }
  });
});

describe("babies", () => {
  it("OKLab conversion round-trips colors", () => {
    for (const c of [0x000000, 0xffffff, 0xff6fb5, 0x1b1b2a, 0x27ae60, 0x3a7bd5]) {
      const back = labToRgb(rgbToLab(c));
      for (const s of [16, 8, 0]) expect(Math.abs(((back >> s) & 255) - ((c >> s) & 255))).toBeLessThanOrEqual(1);
    }
  });

  it("each gene lies between the two parents' colors", () => {
    const rng = createRng(1);
    const d = (x: number[], y: number[]) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
    for (let i = 0; i < 100; i++) {
      const g = rollGenes(sasuke, anya, rng);
      for (const k of TAG_KEYS) {
        const [G, A, B] = [g, sasuke, anya].map((t) => rgbToLab(t[k]));
        expect(d(G, A) + d(G, B)).toBeLessThan(d(A, B) + 0.02);
      }
    }
  });

  it("never picks a parent's own sheet", () => {
    const rng = createRng(3);
    const [a, b] = DEFAULT_CHARACTERS;
    for (let i = 0; i < 200; i++) {
      const m = matchSheet(rollGenes(a.tags, b.tags, rng), DEFAULT_CHARACTERS, [a.id, b.id], rng)!;
      expect([a.id, b.id]).not.toContain(m.character.id.replace("~repainted", ""));
    }
  });

  it("never accepts a match worse than off by 10", () => {
    const rng = createRng(7);
    for (let i = 0; i < 300; i++) {
      const [a, b] = [rng.pick(DEFAULT_CHARACTERS), rng.pick(DEFAULT_CHARACTERS)];
      const genes = rollGenes(a.tags, b.tags, rng);
      const m = matchSheet(genes, DEFAULT_CHARACTERS, [a.id, b.id], rng)!;
      expect(m.repainted || m.distance <= MAX_DISTANCE).toBe(true);
    }
  });

  it("falls back to a default repainted to the exact gene colors", () => {
    const rng = createRng(8);
    const weird: Tags = { hair: 0x00ffff, skin: 0x300030, eyes: 0xffff00 }; // nothing is close to this
    const m = matchSheet(weird, DEFAULT_CHARACTERS, [], rng)!;
    expect(m.repainted).toBe(true);
    expect(m.character.tags).toEqual(weird);
    const base = DEFAULT_CHARACTERS.find((c) => `${c.id}~repainted` === m.character.id)!;
    for (const v of VIEWS) {
      const used = colorsIn(m.character.sheet[v]);
      for (const k of TAG_KEYS) expect(used.has(base.tags[k])).toBe(false); // old tag colors gone
    }
    expect(colorsIn(m.character.sheet.right).has(weird.hair)).toBe(true);
  });

  it("player art is never repainted: only defaults are used for the fallback", () => {
    const rng = createRng(9);
    const player = { ...DEFAULT_CHARACTERS[0], id: "gallery-1", isDefault: false };
    const m = matchSheet({ hair: 0x00ffff, skin: 0x300030, eyes: 0xffff00 }, [player], [], rng);
    expect(m).toBeNull(); // no defaults in the pool → no repaint of the player's drawing
  });

  it("picks among the 3 closest within the limit, so siblings can differ", () => {
    const rng = createRng(4);
    const genes = DEFAULT_CHARACTERS[5].tags; // something with close matches
    const close = rankMatches(genes, DEFAULT_CHARACTERS).filter((m) => m.distance <= MAX_DISTANCE).slice(0, 3).map((m) => m.character.id);
    const picks = new Set(Array.from({ length: 100 }, () => matchSheet(genes, DEFAULT_CHARACTERS, [], rng)!.character.id));
    expect([...picks].every((id) => close.includes(id))).toBe(true);
  });

  it("grandkids inherit from genes, not from the matched sheet's tags", () => {
    const rng = createRng(5);
    const kidGenes = rollGenes(sasuke, anya, rng);
    const partner = DEFAULT_CHARACTERS[10].tags;
    expect(rollGenes(kidGenes, partner, createRng(6))).toEqual(rollGenes(kidGenes, partner, createRng(6)));
    const kidLook = matchSheet(kidGenes, DEFAULT_CHARACTERS, [], rng)!.character;
    if (tagDistance(kidGenes, kidLook.tags) > 0.001) {
      expect(rollGenes(kidGenes, partner, createRng(6))).not.toEqual(rollGenes(kidLook.tags, partner, createRng(6)));
    }
  });
});
