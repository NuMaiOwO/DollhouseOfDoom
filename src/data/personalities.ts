import type { PersonalityDef, PersonalityId } from "../sim/types";

export const PERSONALITIES: Record<PersonalityId, PersonalityDef> = {
  asshole: {
    id: "asshole",
    label: "Asshole",
    emoji: "😈",
    color: 0xd9443b,
    blurb: "Insults everyone. Picks fights with anyone they hate.",
    tagDesire: { mean: 5, violent: 2, friendly: 0.4, romantic: 0.6 },
    acceptTag: { friendly: 0.6, romantic: 0.7 },
    bravery: 0.1,
  },
  flirty: {
    id: "flirty",
    label: "Flirty",
    emoji: "😘",
    color: 0xe86fb5,
    blurb: "Hits on everyone. Partners are a suggestion.",
    tagDesire: { romantic: 5, intimate: 3, friendly: 1.2 },
    acceptTag: { romantic: 1.8, intimate: 2 },
    decay: { social: 1.3 },
    bravery: 0.3,
  },
  foodie: {
    id: "foodie",
    label: "Foodie",
    emoji: "🍔",
    color: 0xf2a33a,
    blurb: "Always eating. Always cooking. Not always safely.",
    tagDesire: { food: 3, cooking: 2 },
    decay: { hunger: 1.5 },
    hazard: { fire: 1.5 },
    bravery: 0.4,
  },
  clingy: {
    id: "clingy",
    label: "Clingy",
    emoji: "🥺",
    color: 0x7aa7e8,
    blurb: "Needs people. Has a favorite. Can die of loneliness.",
    tagDesire: { social: 2, friendly: 2 },
    acceptTag: { friendly: 1.5, romantic: 1.3 },
    decay: { social: 2 },
    bravery: 0.25,
  },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES) as PersonalityId[];
