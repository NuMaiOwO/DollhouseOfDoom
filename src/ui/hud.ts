import { DEATHS, epitaph } from "../data/deaths";
import { PERSONALITIES, PERSONALITY_IDS } from "../data/personalities";
import { CHAOS_LEVELS } from "../data/tuning";
import type { HouseScene } from "../render/HouseScene";
import { toast } from "./dialog";
import { NEEDS, type DeathCause, type WorldEvent } from "../sim/types";
import { actionLabel } from "../sim/view";
import { POP_CAP, type World } from "../sim/world";

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
const SPEEDS = [
  { label: "⏸", value: 0 },
  { label: "1×", value: 1 },
  { label: "3×", value: 3 },
  { label: "8×", value: 8 },
];

/** Quiet "Saved 10s ago" indicator next to the Save button; autosaves just pulse the icon. */
export const saveStatus = {
  last: 0,
  failed: false,
  saved(ok: boolean) {
    saveStatus.failed = !ok;
    if (!ok) return;
    saveStatus.last = Date.now();
    const icon = document.getElementById("saveicon");
    icon?.classList.remove("pulse");
    void icon?.offsetWidth; // restart the animation
    icon?.classList.add("pulse");
  },
  text() {
    if (saveStatus.failed) return "⚠️ Save failed (storage full?)";
    if (!saveStatus.last) return "Not saved yet";
    const s = Math.round((Date.now() - saveStatus.last) / 1000);
    return s < 5 ? "Saved just now" : s < 60 ? `Saved ${s}s ago` : `Saved ${Math.floor(s / 60)} min ago`;
  },
};

/** Plain DOM UI around the game canvas: controls, inspector, log, codex, graveyard. */
export function mountHud(w: World, scene: HouseScene, opts: { save: (() => Promise<void>) | null; openHouses: () => void }) {
  // speed
  const speedBox = $("speed");
  for (const s of SPEEDS) {
    const b = document.createElement("button");
    b.textContent = s.label;
    b.dataset.speed = String(s.value);
    b.onclick = () => (scene.speed = s.value);
    speedBox.append(b);
  }

  // add dummies
  const addBox = $("add");
  for (const id of PERSONALITY_IDS) {
    const p = PERSONALITIES[id];
    const b = document.createElement("button");
    b.className = "add";
    b.innerHTML = `${p.emoji} ${p.label}`;
    b.title = p.blurb;
    b.style.setProperty("--c", `#${p.color.toString(16).padStart(6, "0")}`);
    b.onclick = () => w.moveIn(id);
    addBox.append(b);
  }

  // levers
  const stoveBtn = $("stove") as HTMLButtonElement;
  stoveBtn.onclick = () => {
    const stove = w.objects.find((o) => o.type === "stove")!;
    w.setStoveQuality(stove.quality === "cheap" ? "normal" : "cheap");
  };
  ($("rebuild") as HTMLButtonElement).onclick = () => w.rebuild();
  const chaosBox = $("chaos");
  for (const level of CHAOS_LEVELS) {
    const b = document.createElement("button");
    b.textContent = level.label;
    b.dataset.chaos = level.id;
    b.onclick = () => w.setChaos(level.id);
    chaosBox.append(b);
  }

  // event log
  const log = $("log");
  const addLine = (e: WorldEvent) => {
    const li = document.createElement("li");
    li.className = `${e.kind}${e.minor ? " minor" : ""}`;
    li.innerHTML = `<span class="time">D${Math.floor(e.t / 1440) + 1} ${clock(e.t)}</span> ${esc(e.text)}`;
    log.prepend(li);
    while (log.children.length > 80) log.lastChild!.remove();
  };
  for (const e of w.events.slice(-80)) addLine(e); // restored from a save
  w.on(addLine);
  ($("houses") as HTMLButtonElement).onclick = () => opts.openHouses();
  const saveBtn = $("save") as HTMLButtonElement;
  const save = async () => {
    if (!opts.save) return toast("Replay mode: this house isn't saved");
    await opts.save();
    toast(saveStatus.failed ? "⚠️ Couldn't save" : "💾 Saved ✓");
  };
  // No Ctrl+S on purpose: as a desktop idler, it would swallow the shortcut people meant for their work apps.
  saveBtn.onclick = save;

  scene.onSelect = () => render();
  const render = () => {
    $("clock").textContent = `Day ${w.day} · ${clock(w.t)}`;
    const status = $("savestatus");
    status.textContent = opts.save ? saveStatus.text() : "Replay: not saved";
    status.classList.toggle("bad", saveStatus.failed);
    $("pop").textContent = `${w.population}/${POP_CAP}`;
    for (const b of speedBox.querySelectorAll("button")) b.classList.toggle("on", Number(b.dataset.speed) === scene.speed);
    for (const b of chaosBox.querySelectorAll("button")) b.classList.toggle("on", (b as HTMLElement).dataset.chaos === w.chaos);
    for (const b of addBox.querySelectorAll("button")) (b as HTMLButtonElement).disabled = w.population >= POP_CAP;
    const stove = w.objects.find((o) => o.type === "stove")!;
    stoveBtn.textContent = stove.quality === "cheap" ? "Stove: cheap 🔥" : "Stove: safe";
    renderInspector(w, scene);
    renderCodex(w);
    renderGraveyard(w);
  };
  render();
  setInterval(render, 250);
}

function clock(t: number) {
  const m = t % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
}

function bar(label: string, v: number) {
  const hue = Math.round((v / 100) * 120);
  return `<div class="bar"><span>${label}</span><div><i style="width:${v}%;background:hsl(${hue} 70% 45%)"></i></div></div>`;
}

function renderInspector(w: World, scene: HouseScene) {
  const box = $("inspector");
  const s = scene.selectedId !== null ? w.dummyById(scene.selectedId) : undefined;
  if (!s) {
    box.innerHTML = `<p class="hint">Click a Dummy to inspect them.</p>`;
    return;
  }
  const p = PERSONALITIES[s.personality];
  const rels = w.relationsOf(s)
    .filter(({ other }) => other.alive)
    .sort((a, b) => Math.abs(b.rel.friendship) + b.rel.romance - (Math.abs(a.rel.friendship) + a.rel.romance))
    .slice(0, 5)
    .map(({ other, rel }) => `<li>${rel.partner ? "💑" : ""} ${esc(other.name)} <span class="num">🤝 ${Math.round(rel.friendship)} ❤️ ${Math.round(rel.romance)}</span></li>`)
    .join("");
  const buffs = s.buffs.map((b) => b.id).join(", ") || "none";
  const why = s.considered.map((c) => `<li>${esc(c.label)} <span class="num">${c.score.toFixed(1)}</span></li>`).join("");
  box.innerHTML = `
    <h3>${p.emoji} ${esc(s.name)} <small>${p.label} · ${w.stage(s)} · gen ${s.generation}</small></h3>
    <p class="doing">${esc(actionLabel(w, s))}</p>
    ${bar("Health", s.health)}
    ${NEEDS.map((k) => bar(k[0].toUpperCase() + k.slice(1), s.needs[k])).join("")}
    <p class="small">Moods: ${buffs}</p>
    <h4>Relationships</h4><ul class="list">${rels || "<li class='hint'>Nobody yet</li>"}</ul>
    <h4>Last decision (top options)</h4><ul class="list">${why || "<li class='hint'>-</li>"}</ul>`;
}

function renderCodex(w: World) {
  const causes = Object.keys(DEATHS) as DeathCause[];
  const found = causes.filter((c) => w.deaths[c]).length;
  $("codex").innerHTML = `<h4>Death Codex ${found}/${causes.length}</h4><ul class="list">${causes
    .map((c) => (w.deaths[c] ? `<li>💀 ${DEATHS[c].title} <span class="num">×${w.deaths[c]}</span></li>` : `<li class="hint">??? · ${DEATHS[c].hint}</li>`))
    .join("")}</ul>`;
}

function renderGraveyard(w: World) {
  const dead = [...w.graveyard, ...w.dummies.filter((s) => !s.alive)].reverse();
  $("graveyard").innerHTML = `<h4>Graveyard (${dead.length})</h4><ul class="list">${
    dead.slice(0, 30).map((s) =>
      `<li>🪦 <b>${esc(s.name)}</b> ${PERSONALITIES[s.personality].emoji} <span class="small">${DEATHS[s.cause!].title} · day ${(s.ageMin / 1440).toFixed(1)} old<br><i>"${esc(epitaph(s))}"</i></span></li>`,
    ).join("") || "<li class='hint'>Empty. For now.</li>"
  }</ul>`;
}
