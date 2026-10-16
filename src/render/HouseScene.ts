import Phaser from "phaser";
import { PERSONALITIES } from "../data/personalities";
import { FLOORS, HOUSE_WIDTH, LADDER_X, ROOMS } from "../sim/house";
import type { Fire, HouseObject, Sim, SimEvent } from "../sim/types";
import { simAnim, simThought } from "../sim/view";
import type { World } from "../sim/world";
import { COLORS, OBJECT_VISUALS, SIM_SIZE } from "./visuals";

/** Game-minutes per real second at 1× speed. */
export const MIN_PER_SEC = 10;

const MARGIN_X = 20;
const ROOF_H = 56;
const FLOOR_H = 120;
export const GAME_W = HOUSE_WIDTH + MARGIN_X * 2;
export const GAME_H = ROOF_H + FLOOR_H * FLOORS + 28;

const sx = (x: number) => MARGIN_X + x;
const floorY = (floor: number) => ROOF_H + (FLOORS - floor) * FLOOR_H;

interface SimView {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  eye: Phaser.GameObjects.Rectangle;
  censor: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  thought: Phaser.GameObjects.Text;
}

interface ObjectView { root: Phaser.GameObjects.Container; body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }

/**
 * Draws whatever the World says. It never changes simulation state;
 * it only advances time by calling world.tick().
 */
export class HouseScene extends Phaser.Scene {
  speed = 1;
  selectedId: number | null = null;
  onSelect: (id: number | null) => void = () => {};

  private acc = 0;
  private sky!: Phaser.GameObjects.Rectangle;
  private sims = new Map<number, SimView>();
  private objects = new Map<number, ObjectView>();
  private fires = new Map<number, Phaser.GameObjects.Rectangle[]>();
  private water!: Phaser.GameObjects.Graphics;

  constructor(readonly world: World) {
    super("house");
  }

  preload() {
    for (const spec of Object.values(OBJECT_VISUALS)) if (spec.sprite) this.load.image(spec.sprite, `assets/${spec.sprite}.png`);
  }

  create() {
    this.drawHouse();
    for (const o of this.world.objects) this.objects.set(o.id, this.makeObject(o));
    this.water = this.add.graphics().setDepth(12);
    this.world.on((e) => this.popup(e));
    this.input.on("pointerdown", (_p: Phaser.Input.Pointer, hit: Phaser.GameObjects.GameObject[]) => {
      if (!hit.length) this.select(null);
    });
    const kb = this.input.keyboard!;
    kb.on("keydown-SPACE", () => (this.speed = this.speed === 0 ? 1 : 0));
    kb.on("keydown-ONE", () => (this.speed = 1));
    kb.on("keydown-TWO", () => (this.speed = 3));
    kb.on("keydown-THREE", () => (this.speed = 8));
  }

  select(id: number | null) {
    this.selectedId = id;
    this.onSelect(id);
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    this.acc += dt * MIN_PER_SEC * this.speed;
    for (let n = 0; this.acc >= 1 && n < 200; n++, this.acc--) this.world.tick();

    this.updateSky();
    this.syncSims(dt);
    this.syncObjects();
    this.syncFires();
    this.drawWater();
  }

  // ── House ─────────────────────────────────────────────────

  private drawHouse() {
    this.sky = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x87b8e0).setOrigin(0);
    const g = this.add.graphics();
    // roof
    g.fillStyle(COLORS.roof).fillTriangle(sx(-12), ROOF_H, sx(HOUSE_WIDTH / 2), 6, sx(HOUSE_WIDTH + 12), ROOF_H);
    // walls and floors
    for (let f = 0; f < FLOORS; f++) {
      g.fillStyle(COLORS.wall[f % COLORS.wall.length]).fillRect(sx(0), floorY(f) - FLOOR_H, HOUSE_WIDTH, FLOOR_H);
      g.fillStyle(COLORS.floor).fillRect(sx(0), floorY(f), HOUSE_WIDTH, 6);
    }
    for (const r of ROOMS) {
      if (r.name === "Bathroom") g.fillStyle(0x34525e).fillRect(sx(r.from), floorY(r.floor) - FLOOR_H, r.to - r.from, FLOOR_H);
      if (r.from > 0 && Math.abs(r.from - LADDER_X) > 20) g.fillStyle(0x1e1b2a).fillRect(sx(r.from) - 2, floorY(r.floor) - FLOOR_H, 4, 40);
    }
    // hole in the upper floor for the ladder
    g.fillStyle(COLORS.wall[0]).fillRect(sx(LADDER_X - 12), floorY(1), 24, 6);
    // room dividers (partial walls) and labels
    g.fillStyle(0x1e1b2a);
    for (let f = 0; f < FLOORS; f++) g.fillRect(sx(LADDER_X) - 30, floorY(f) - FLOOR_H, 4, 40).fillRect(sx(LADDER_X) + 26, floorY(f) - FLOOR_H, 4, 40);
    for (const r of ROOMS) {
      this.add.text(sx(r.from) + 8, floorY(r.floor) - FLOOR_H + 6, r.name.toUpperCase(), { fontSize: "10px", color: "#ffffff" }).setAlpha(0.35);
    }
    // ladder
    g.lineStyle(3, COLORS.ladder);
    const top = floorY(FLOORS - 1), bottom = floorY(0);
    g.lineBetween(sx(LADDER_X) - 9, top, sx(LADDER_X) - 9, bottom).lineBetween(sx(LADDER_X) + 9, top, sx(LADDER_X) + 9, bottom);
    for (let y = top + 8; y < bottom; y += 14) g.lineBetween(sx(LADDER_X) - 9, y, sx(LADDER_X) + 9, y);
    // front door + ground
    g.fillStyle(0x6b4a2b).fillRect(sx(0), floorY(0) - 44, 10, 44);
    g.fillStyle(COLORS.ground).fillRect(0, floorY(0) + 6, GAME_W, GAME_H);
  }

  private updateSky() {
    const h = (this.world.t % 1440) / 60;
    const daylight = Math.max(0, Math.min(1, Math.min(h - 5, 21 - h) / 2));
    const night = Phaser.Display.Color.ValueToColor(0x141a33);
    const day = Phaser.Display.Color.ValueToColor(0x87b8e0);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(night, day, 100, daylight * 100);
    this.sky.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  }

  // ── Sims ──────────────────────────────────────────────────

  private makeSim(s: Sim): SimView {
    const root = this.add.container(sx(s.x), floorY(s.floor)).setDepth(10);
    const body = this.add.rectangle(0, 0, SIM_SIZE.adult.w, SIM_SIZE.adult.h, PERSONALITIES[s.personality].color).setOrigin(0.5, 1);
    body.setStrokeStyle(1, 0x111111);
    const eye = this.add.rectangle(4, -SIM_SIZE.adult.h + 7, 3, 3, 0x111111);
    const censor = this.add.text(0, -18, "▓▓", { fontSize: "18px", color: "#ff6fb5" }).setOrigin(0.5).setVisible(false);
    const name = this.add.text(0, -SIM_SIZE.adult.h - 4, s.name, { fontSize: "9px", color: "#ffffff", resolution: 2 }).setOrigin(0.5, 1);
    const thought = this.add.text(0, -SIM_SIZE.adult.h - 15, "", { fontSize: "14px", resolution: 2 }).setOrigin(0.5, 1);
    root.add([body, eye, censor, name, thought]);
    body.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.select(s.id));
    return { root, body, eye, censor, name, thought };
  }

  private syncSims(dt: number) {
    const w = this.world;
    const t = this.time.now / 1000;
    for (const s of w.sims) {
      let v = this.sims.get(s.id);
      if (!v) this.sims.set(s.id, (v = this.makeSim(s)));
      const anim = simAnim(s);
      const child = w.stage(s) === "child";
      const size = child ? SIM_SIZE.child : SIM_SIZE.adult;

      // position: lerp toward the sim's logical spot
      let tx = sx(s.x), ty = floorY(s.floor);
      if (s.climb) ty = Phaser.Math.Linear(floorY(s.climb.from), floorY(s.climb.to), s.climb.progress);
      if (anim === "sleep" && s.action?.target.kind === "object") {
        const bed = w.objectById(s.action.target.id);
        if (bed) ty -= OBJECT_VISUALS[bed.type].placeholder.h;
      }
      const k = Math.min(1, dt * 12);
      if (anim === "launched") {
        const pos = this.launchPosition(s);
        v.root.setPosition(pos.x, pos.y);
      } else {
        v.root.x += (tx - v.root.x) * k;
        v.root.y += (ty - v.root.y) * k;
      }

      // reset, then apply the fake animation for this state
      v.body.setSize(size.w, size.h).setDisplaySize(size.w, size.h);
      v.body.setFillStyle(s.alive ? PERSONALITIES[s.personality].color : COLORS.dead);
      v.body.setStrokeStyle(s.id === this.selectedId ? 2 : 1, s.id === this.selectedId ? COLORS.selected : 0x111111);
      v.body.y = 0;
      v.body.angle = 0;
      v.body.scaleY = 1;
      v.body.x = 0;
      v.eye.setVisible(true).setPosition(s.facing * (size.w / 2 - 4), -size.h + 7);
      v.censor.setVisible(false);
      v.name.setY(-size.h - 4).setText(s.alive ? s.name : `RIP ${s.name}`);
      v.thought.setY(-size.h - 15);

      switch (anim) {
        case "walk": v.body.y = -Math.abs(Math.sin(t * 12)) * 2; break;
        case "panic": v.body.y = -Math.abs(Math.sin(t * 22)) * 3; v.body.x = Math.sin(t * 40); break;
        case "climb": v.body.y = Math.sin(t * 16); v.eye.setVisible(false); break;
        case "eat": v.body.scaleY = 1 + Math.sin(t * 12) * 0.08; break;
        case "cook": v.body.y = -Math.abs(Math.sin(t * 6)) * 1.5; break;
        case "talk": v.body.y = -Math.max(0, Math.sin(t * 8)) * 2; break;
        case "flirt": v.body.y = -Math.abs(Math.sin(t * 5)) * 5; break;
        case "fight": v.body.x = Math.sin(t * 45) * 3; v.body.angle = Math.sin(t * 30) * 12; break;
        case "mate": v.censor.setVisible(!s.action?.passive); v.body.x = Math.sin(t * 30) * 1.5; break;
        case "extinguish": v.body.angle = s.facing * 10; break;
        case "sleep": v.body.angle = -90 * s.facing; v.eye.setVisible(false); break;
        case "launched": v.body.angle = this.launchProgress(s) > 0.55 ? t * 900 : Math.sin(t * 50) * 8; break;
        case "dead": v.body.angle = 90; v.eye.setVisible(false); break;
      }
      if (anim === "sleep" || anim === "dead") {
        v.name.setY(-size.w - 4);
        v.thought.setY(-size.w - 15);
      }
      const thought = simThought(w, s);
      v.thought.setText(thought ?? "");
    }
    // Sims that left the world (buried): float a ghost up and clean up
    for (const [id, v] of this.sims) {
      if (w.sims.some((s) => s.id === id)) continue;
      this.sims.delete(id);
      const ghost = this.add.text(v.root.x, v.root.y - 20, "👻", { fontSize: "18px" }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: ghost, y: ghost.y - 60, alpha: 0, duration: 2000, onComplete: () => ghost.destroy() });
      v.root.destroy();
    }
  }

  // ── Toilet launch ─────────────────────────────────────────

  /** 0..1 through the launch, smoothed between sim ticks. */
  private launchProgress(s: Sim) {
    const a = s.action!;
    return Math.min(1, (a.elapsed + (this.speed ? this.acc : 0)) / a.duration);
  }

  /** Up through the roof and off-screen, a dramatic pause, then straight back down. */
  private launchPosition(s: Sim) {
    const p = this.launchProgress(s);
    const ground = floorY(s.floor);
    const sky = -80;
    const startX = sx(s.x), landX = sx(s.action!.dest.x);
    if (p < 0.3) {
      const k = 1 - (1 - p / 0.3) ** 3; // ease out: blasted upward
      return { x: startX, y: Phaser.Math.Linear(ground, sky, k) };
    }
    if (p < 0.55) return { x: startX, y: sky };
    const k = ((p - 0.55) / 0.45) ** 2; // ease in: gravity
    return { x: Phaser.Math.Linear(startX, landX, k), y: Phaser.Math.Linear(sky, ground, k) };
  }

  private drawWater() {
    const g = this.water.clear();
    const t = this.time.now / 1000;
    // the jet that carries a launched Sim
    for (const s of this.world.sims) {
      if (s.action?.interactionId !== "launched") continue;
      const p = this.launchProgress(s);
      if (p > 0.45) continue;
      const top = this.launchPosition(s).y;
      const x = sx(s.x);
      g.fillStyle(COLORS.water, 0.85).fillRect(x - 6 + Math.sin(t * 40) * 1.5, top, 12, floorY(s.floor) - 20 - top);
      g.fillStyle(0xffffff, 0.6).fillRect(x - 2, top, 4, floorY(s.floor) - 20 - top);
    }
    // broken toilets keep spraying until repaired
    for (const o of this.world.objects) {
      if (!o.broken) continue;
      const h = 18 + Math.sin(t * 13) * 6 + Math.random() * 4;
      const top = floorY(o.floor) - OBJECT_VISUALS[o.type].placeholder.h - h;
      g.fillStyle(COLORS.water, 0.8).fillRect(sx(o.x) - 3, top, 6, h);
      g.fillStyle(COLORS.water, 0.6).fillCircle(sx(o.x) - 6, top + 2 + Math.random() * 3, 2).fillCircle(sx(o.x) + 6, top + 2 + Math.random() * 3, 2);
    }
  }

  // ── Objects ───────────────────────────────────────────────

  private makeObject(o: HouseObject): ObjectView {
    const spec = OBJECT_VISUALS[o.type];
    const p = spec.placeholder;
    const root = this.add.container(sx(o.x), floorY(o.floor)).setDepth(5);
    const body = spec.sprite
      ? this.add.image(0, 0, spec.sprite).setOrigin(0.5, 1)
      : this.add.rectangle(0, 0, p.w, p.h, p.color).setOrigin(0.5, 1).setStrokeStyle(1, 0x111111);
    const label = this.add.text(0, -p.h - 2, p.label, { fontSize: "8px", color: "#ffffff", resolution: 2 }).setOrigin(0.5, 1).setAlpha(0.8);
    root.add([body, label]);
    return { root, body, label };
  }

  private syncObjects() {
    for (const o of this.world.objects) {
      const v = this.objects.get(o.id)!;
      const p = OBJECT_VISUALS[o.type].placeholder;
      const name = o.destroyed ? `BURNT ${p.label}` : o.broken ? `BROKEN ${p.label}` : o.type === "stove" && o.quality === "cheap" ? `${p.label} ($)` : p.label;
      v.label.setText(name);
      if (v.body instanceof Phaser.GameObjects.Rectangle) {
        const scorched = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(p.color), Phaser.Display.Color.ValueToColor(COLORS.burnt), 50, Math.min(50, o.burn),
        );
        v.body.setFillStyle(o.destroyed ? COLORS.burnt : o.broken ? 0x8c8c8c : Phaser.Display.Color.GetColor(scorched.r, scorched.g, scorched.b));
      } else {
        v.body.setTint(o.destroyed ? COLORS.burnt : 0xffffff);
      }
    }
  }

  // ── Fire ──────────────────────────────────────────────────

  private syncFires() {
    const live = new Set(this.world.fires.map((f) => f.id));
    for (const f of this.world.fires) {
      let flames = this.fires.get(f.id);
      if (!flames) this.fires.set(f.id, (flames = this.makeFire(f)));
      flames.forEach((r, i) => {
        const h = (10 + f.intensity * 26) * Phaser.Math.FloatBetween(0.6, 1.1) * (1 - i * 0.25);
        r.setSize(14 - i * 3, h).setDisplaySize(14 - i * 3, h).setX(sx(f.x) + Phaser.Math.Between(-2, 2));
      });
      if (Math.random() < 0.08) this.smoke(sx(f.x), floorY(f.floor) - 20);
    }
    for (const [id, flames] of this.fires) {
      if (live.has(id)) continue;
      flames.forEach((r) => r.destroy());
      this.fires.delete(id);
    }
  }

  private makeFire(f: Fire) {
    return [0xd8361e, 0xff8a1e, 0xffd84a].map((c) => this.add.rectangle(sx(f.x), floorY(f.floor), 14, 20, c).setOrigin(0.5, 1).setDepth(15));
  }

  private smoke(x: number, y: number) {
    const puff = this.add.rectangle(x + Phaser.Math.Between(-6, 6), y, 6, 6, 0x555555).setDepth(16).setAlpha(0.7);
    this.tweens.add({ targets: puff, y: y - 40, alpha: 0, scale: 2, duration: 1400, onComplete: () => puff.destroy() });
  }

  // ── Event popups ──────────────────────────────────────────

  private popup(e: SimEvent) {
    if (e.kind === "geyser") this.cameras.main.shake(250, 0.006);
    if (e.kind === "death" && e.cause === "toilet") {
      this.cameras.main.shake(350, 0.015);
      if (e.at) {
        const boom = this.add.text(sx(e.at.x), floorY(e.at.floor) - 10, "💥", { fontSize: "34px" }).setOrigin(0.5).setDepth(31);
        this.tweens.add({ targets: boom, scale: 1.8, alpha: 0, duration: 700, onComplete: () => boom.destroy() });
      }
    }
    if (e.minor || !e.icon) return;
    const at = e.at ?? (e.simId ? this.world.simById(e.simId) : undefined);
    if (!at) return;
    const big = e.kind === "death" || e.kind === "birth" || e.kind === "fire";
    const txt = this.add.text(sx(at.x), floorY(at.floor) - 50, e.icon, { fontSize: big ? "26px" : "16px" }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: big ? 2200 : 1400, ease: "Quad.easeOut", onComplete: () => txt.destroy() });
  }
}
