import Phaser from "phaser";
import "./style.css";
import { createSlot, getLastSlot, listSlots, loadSlot, saveSlot, setLastSlot, startAutosave } from "./save";
import { DEFAULT_CAST } from "./sim/scenario";
import { World } from "./sim/world";
import { GAME_H, GAME_W, HouseScene } from "./render/HouseScene";
import { openHousesMenu } from "./ui/houses";
import { mountHud, saveStatus } from "./ui/hud";

// ?seed=123 replays the exact same fresh house and never touches your saves.
const seedParam = Number(new URLSearchParams(location.search).get("seed"));

/** Opens the last played house (or the newest one, or a brand-new one). Null in replay mode. */
function pickSlot(): string | null {
  if (seedParam) return null;
  return getLastSlot() ?? listSlots()[0]?.id ?? createSlot()?.id ?? null;
}

const slotId = pickSlot();
let world = slotId ? loadSlot(slotId) : null;
if (!world) {
  world = new World(seedParam || Date.now() % 1e9);
  for (const p of DEFAULT_CAST) world.moveIn(p);
}
if (slotId) setLastSlot(slotId);

const scene = new HouseScene(world);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_W,
  height: GAME_H,
  backgroundColor: "#15161e",
  scene: [scene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
});

/** A small picture of the house for the Houses menu. */
function makeThumb(): Promise<string | undefined> {
  return new Promise((resolve) => {
    game.renderer.snapshot((img) => {
      if (!(img instanceof HTMLImageElement)) return resolve(undefined);
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = Math.round((200 * GAME_H) / GAME_W);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.7));
    });
  });
}

const w = world;
const autosave = slotId ? startAutosave(slotId, w, makeThumb, saveStatus.saved) : null;

mountHud(w, scene, {
  save: autosave ? () => autosave.saveNow() : null,
  openHouses: () =>
    openHousesMenu({
      currentId: slotId,
      beforeLeave: () => { if (slotId) saveSlot(slotId, w); },
      play: (id) => {
        autosave?.stop();
        setLastSlot(id);
        location.href = location.pathname; // drop ?seed and reload into the chosen house
      },
    }),
});

// Handy in the browser console: world.dummies, world.moveIn("asshole"), ...
(window as unknown as { world: World }).world = w;
console.log(`Dollhouse of Doom, seed ${w.seed}${slotId ? "" : " (replay, not saved)"}`);
