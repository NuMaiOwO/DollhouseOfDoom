import { PERSONALITY_IDS } from "../data/personalities";
import { createRng } from "../sim/rng";
import { SHEET_W, emptySheet, idx, mirror, type Character, type Pixels, type Sheet } from "./sheet";

/**
 * The default characters: so the game works before the player draws anything, and as the
 * fallback for babies. Generated. Their tag colors are exactly the colors used in their
 * pixels (hair, skin, eyes), which is what makes repainting a default safe.
 * (Defaults mirror their right side; players draw every view.)
 */
const HAIR = [0x1b1b2a, 0x5a3825, 0xf2d16b, 0xc0392b, 0xe67e22, 0xff6fb5, 0x3a7bd5, 0x2ecc71, 0xe8e8e8, 0x8c8c8c, 0x8e44ad, 0x16a085];
const SKIN = [
  0xffe0bd, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, // human
  0x9ad1a0, 0xa8c8ff, 0xb48ef0, 0xe06666, 0x9fa8b0, 0x7bd36b, 0x4a6fd4, 0xf2e36b, // fantasy: mint, sky, lavender, red, stone, slime, deep blue, yellow
];
const EYES = [0x2c3e50, 0x6b4226, 0x2e86de, 0x27ae60, 0xb03a2e, 0x7d3c98, 0xf1c40f, 0x7f8c8d];
const OUTFIT = [0x3a6ea5, 0xd62828, 0x2a9d8f, 0xf4a261, 0x6a4c93, 0x9c6644, 0x264653, 0xe9c46a, 0x2b2d42, 0xf5f5f5, 0x1d3557, 0x4a4e69];
const SHOES = [0x111111, 0x3d2b1f, 0x7a1e1e, 0x5c5c5c];
const STYLES = ["spiky", "bob", "curly", "bun", "bald"] as const;
const NAMES = [
  "Bob", "Gloria", "Dirk", "Mimi", "Chad", "Bertha", "Kevin", "Pam", "Moe", "Tina", "Gus", "Wanda",
  "Lenny", "Doris", "Rico", "Fern", "Biff", "Nadia", "Otis", "Peggy", "Ziggy", "Hilda", "Barry", "Lulu",
  "Vinny", "Opal", "Duke", "Trixie", "Sal", "Edna", "Rex", "Bunny", "Clint", "Mavis", "Tito", "Gwen",
];
const WHITE = 0xffffff, MOUTH = 0xa0303a;

interface Look {
  hair: number; skin: number; eyes: number;
  style: (typeof STYLES)[number];
  shirt: number; pants: number; shoes: number;
}

export const DEFAULT_CHARACTERS: Character[] = (() => {
  const rng = createRng(20261016);
  const tagColors = new Set([...HAIR, ...SKIN, ...EYES]);
  // Outfits never reuse a tag color, so repainting a tag can't touch clothes.
  const outfit = OUTFIT.filter((c) => !tagColors.has(c));
  return NAMES.map((name, i) => {
    const look: Look = {
      hair: HAIR[i % HAIR.length],
      skin: SKIN[(i * 5) % SKIN.length],
      eyes: EYES[(i * 3 + Math.floor(i / 8)) % EYES.length],
      style: STYLES[(i * 7) % STYLES.length],
      shirt: rng.pick(outfit), pants: rng.pick(outfit), shoes: rng.pick(SHOES),
    };
    return {
      id: `default-${i + 1}`,
      name,
      sheet: drawLook(look),
      tags: { hair: look.hair, skin: look.skin, eyes: look.eyes },
      personality: PERSONALITY_IDS[i % PERSONALITY_IDS.length],
      isDefault: true,
    };
  });
})();

function rgba(rgb: number) {
  return ((rgb << 8) | 0xff) >>> 0;
}

function darker(rgb: number, k = 0.72) {
  const ch = (s: number) => Math.round(((rgb >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function rectOn(p: Pixels) {
  return (x0: number, y0: number, x1: number, y1: number, rgb: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (x >= 0 && x < SHEET_W) p[idx(x, y)] = rgba(rgb);
  };
}

/** Body shared by the side and back views: torso, arms, hands, legs, feet. */
function body(rect: ReturnType<typeof rectOn>, l: Look, side: boolean) {
  rect(7, 20, 17, 34, l.shirt);
  rect(5, 21, 7, 31, side ? darker(l.shirt) : l.shirt);
  rect(17, 21, 19, 31, l.shirt);
  rect(5, 31, 7, 33, l.skin);
  rect(17, 31, 19, 33, l.skin);
  rect(8, 34, 12, 44, l.pants);
  rect(12, 34, 16, 44, side ? darker(l.pants) : l.pants);
  rect(8, 44, 12, 48, l.shoes);
  rect(12, 44, side ? 18 : 16, 48, l.shoes);
}

function drawLook(l: Look): Sheet {
  const s = emptySheet();

  // facing right; all hair is exactly the hair tag color, so the tag describes what you see
  const r = rectOn(s.right);
  r(7, 9, 17, 20, l.skin);
  r(17, 14, 18, 16, l.skin);
  r(11, 12, 14, 16, WHITE);
  r(12, 12, 14, 16, l.eyes);
  r(14, 12, 17, 16, WHITE);
  r(15, 12, 17, 16, l.eyes);
  r(13, 17, 16, 18, MOUTH);
  if (l.style === "spiky") {
    r(6, 6, 18, 11, l.hair);
    for (let x = 6; x < 18; x += 3) r(x, 2 + (x % 2), x + 2, 6, l.hair);
    r(6, 11, 9, 15, l.hair);
  }
  if (l.style === "bob") { r(6, 5, 18, 11, l.hair); r(6, 11, 10, 18, l.hair); }
  if (l.style === "curly") { r(5, 4, 19, 11, l.hair); r(5, 11, 9, 17, l.hair); }
  if (l.style === "bun") { r(7, 6, 17, 10, l.hair); r(6, 2, 11, 6, l.hair); }
  if (l.style === "bald") r(11, 18, 17, 21, l.hair); // a beard in the hair color
  body(r, l, true);
  s.left = mirror(s.right);

  // back view: the back of the head, no face
  const b = rectOn(s.back);
  b(7, 9, 17, 20, l.skin);
  if (l.style === "spiky") {
    b(6, 6, 18, 17, l.hair);
    for (let x = 6; x < 18; x += 3) b(x, 2 + (x % 2), x + 2, 6, l.hair);
  }
  if (l.style === "bob") b(6, 5, 18, 18, l.hair);
  if (l.style === "curly") b(5, 4, 19, 18, l.hair);
  if (l.style === "bun") { b(7, 6, 17, 14, l.hair); b(9, 2, 15, 6, l.hair); }
  body(b, l, false);
  return s;
}
