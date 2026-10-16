import type { World } from "./world";

export const NEEDS = ["hunger", "energy", "social", "bladder"] as const;
export type NeedKey = (typeof NEEDS)[number];
export type Needs = Record<NeedKey, number>;

export type PersonalityId = "asshole" | "flirty" | "foodie" | "clingy";
export type ObjectType = "fridge" | "stove" | "bed" | "couch" | "toilet";
export type LifeStage = "child" | "adult" | "elder";

/** Interactions are described by tags; rules (personality, relationships, buffs) target tags, not interactions. */
export type Tag =
  | "food" | "cooking" | "rest" | "idle" | "toilet" | "repair"
  | "social" | "friendly" | "mean" | "violent" | "romantic" | "intimate"
  | "brave";

/** Named animation states. Placeholders fake them now; sprite-sheet rows map to them later. */
export type AnimState =
  | "idle" | "walk" | "climb" | "eat" | "cook" | "sleep" | "talk" | "flirt"
  | "fight" | "mate" | "panic" | "extinguish" | "launched" | "airborne" | "fallen" | "repair" | "dead";

export type DeathCause = "starved" | "burned" | "crushed" | "slipped" | "beaten" | "old_age" | "loneliness" | "toilet";
export type BuffId = "angry" | "grieving" | "embarrassed" | "heartbroken";

export interface Buff { id: BuffId; until: number }
export interface Place { x: number; floor: number }
export interface Climb { from: number; to: number; progress: number }

export interface Action {
  interactionId: string;
  target: { kind: "object" | "dummy" | "fire" | "spot"; id: number };
  dest: Place;
  phase: "walking" | "doing";
  elapsed: number;
  duration: number;
  run?: boolean;
  /** The receiving side of a social interaction, held in place by the initiator. */
  passive?: boolean;
}

export interface Dummy {
  id: number;
  name: string;
  personality: PersonalityId;
  x: number;
  floor: number;
  facing: 1 | -1;
  climb: Climb | null;
  needs: Needs;
  health: number;
  ageMin: number;
  lifespanMin: number;
  alive: boolean;
  cause?: DeathCause;
  diedAt?: number;
  action: Action | null;
  buffs: Buff[];
  parents: [number, number] | null;
  generation: number;
  mateCooldownUntil: number;
  passedOut: boolean;
  /** Puddle currently underfoot, so each crossing rolls for a slip only once. */
  puddleId: number | null;
  /** Top options from the last autonomy decision, for the "why did they do that" inspector. */
  considered: { label: string; score: number }[];
}

export interface HouseObject {
  id: number;
  type: ObjectType;
  x: number;
  floor: number;
  quality: "cheap" | "normal";
  /** Dummy currently using or walking to this object. */
  userId: number | null;
  destroyed: boolean;
  /** Broken but not burnt (e.g. an exploded toilet). Unusable until repaired. */
  broken: boolean;
  burn: number;
}

export interface Puddle { id: number; x: number; floor: number; age: number; life: number }

export interface Fire { id: number; x: number; floor: number; intensity: number; age: number; life: number }

/** Directional: rel(A, B) is how A feels about B. */
export interface Relationship { friendship: number; romance: number; partner: boolean }

export type EventKind = "arrive" | "death" | "birth" | "fire" | "fire_out" | "destroyed" | "geyser" | "accident" | "repair" | "social" | "rejected" | "info";

export interface WorldEvent {
  kind: EventKind;
  t: number;
  text: string;
  icon?: string;
  minor?: boolean;
  dummyId?: number;
  cause?: DeathCause;
  at?: Place;
}

export interface Ctx {
  world: World;
  dummy: Dummy;
  def: InteractionDef;
  object?: HouseObject;
  other?: Dummy;
  action?: Action;
}

/** Something that can go wrong during an interaction. Its odds live in data/tuning.ts. */
export interface Hazard {
  id: "fire" | "crush" | "geyser";
}

export interface InteractionDef {
  id: string;
  label: string;
  emoji: string;
  anim: AnimState;
  target: "object" | "dummy" | "self" | "fire";
  objectTypes?: ObjectType[];
  tags: Tag[];
  duration: number;
  /** Total need change for the actor over the whole interaction (also what it advertises). */
  gains?: Partial<Needs>;
  targetGains?: Partial<Needs>;
  baseDesire?: number;
  adultsOnly?: boolean;
  /** Social: the target gets an accept/reject roll. */
  needsAccept?: boolean;
  /** Only offered on broken or burnt objects (repairs). */
  targetsBroken?: boolean;
  /** Never chosen by autonomy; started by the world (passing out, fleeing...). */
  internal?: boolean;
  available?: (c: Ctx) => boolean;
  stopWhen?: (s: Dummy, a: Action) => boolean;
  hazards?: Hazard[];
  onStart?: (c: Ctx) => void;
  onComplete?: (c: Ctx) => void;
}

export interface PersonalityDef {
  id: PersonalityId;
  label: string;
  emoji: string;
  color: number;
  blurb: string;
  /** Desire multipliers per tag. */
  tagDesire: Partial<Record<Tag, number>>;
  /** Accept-chance multipliers when on the receiving end. */
  acceptTag?: Partial<Record<Tag, number>>;
  decay?: Partial<Needs>;
  hazard?: Partial<Record<Hazard["id"], number>>;
  /** Chance to fight a fire instead of running. */
  bravery: number;
}

export interface DesireRule {
  id: string;
  applies: (c: Ctx) => boolean;
  multiply: number | ((c: Ctx) => number);
}
