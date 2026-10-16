import type { World } from "./world";

/** Side-view house geometry, in dummy pixels. Floor 0 is the ground floor. */
export const HOUSE_WIDTH = 800;
export const FLOORS = 2;
/** The ladder connecting the floors. */
export const LADDER_X = 400;
export const DOOR_X = 16;
export const CLIMB_MINUTES = 8;
export const WALK_SPEED = 10; // px per game-minute
export const RUN_SPEED = 22;

export const ROOMS = [
  { name: "Kitchen", floor: 0, from: 0, to: 390 },
  { name: "Living Room", floor: 0, from: 410, to: 800 },
  { name: "Bedroom", floor: 1, from: 0, to: 390 },
  { name: "Bathroom", floor: 1, from: 410, to: 560 },
  { name: "Guest Room", floor: 1, from: 560, to: 800 },
];

export function furnish(w: World) {
  w.addObject("fridge", 60, 0);
  w.addObject("stove", 140, 0, "cheap");
  w.addObject("couch", 620, 0);
  w.addObject("bed", 90, 1);
  w.addObject("bed", 220, 1);
  w.addObject("toilet", 490, 1);
  w.addObject("bed", 680, 1);
}
