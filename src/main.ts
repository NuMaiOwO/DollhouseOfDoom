import Phaser from "phaser";
import "./style.css";
import { DEFAULT_CAST } from "./sim/scenario";
import { World } from "./sim/world";
import { GAME_H, GAME_W, HouseScene } from "./render/HouseScene";
import { mountHud } from "./ui/hud";

// ?seed=123 replays the exact same house.
const seed = Number(new URLSearchParams(location.search).get("seed")) || Date.now() % 1e9;
const world = new World(seed);
for (const p of DEFAULT_CAST) world.moveIn(p);

const scene = new HouseScene(world);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_W,
  height: GAME_H,
  backgroundColor: "#15161e",
  scene: [scene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
});
mountHud(world, scene);

// Handy in the browser console: world.sims, world.moveIn("asshole"), ...
(window as unknown as { world: World }).world = world;
console.log(`Dollhouse of Doom, seed ${seed}`);
