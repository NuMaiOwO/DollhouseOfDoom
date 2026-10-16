/**
 * Baby Lab: a test bench for judging babies by eye.
 * Pair characters, roll babies (genes between the parents' tag colors), and see which
 * sheet each baby matched, from defaults + imported sheets (standing in for the gallery).
 */
import "../style.css";
import "./lab.css";
import { DEFAULT_CHARACTERS } from "../sheet/defaults";
import { hex, matchSheet, rollGenes } from "../sheet/genes";
import { pngToSheet, renderView, sheetToPngBlob, templateGuideCanvas } from "../sheet/image";
import { TAG_KEYS, VIEWS, type Character, type Sheet, type TagKey, type Tags, type View } from "../sheet/sheet";
import { createRng } from "../sim/rng";
import { openModal } from "../ui/dialog";

/** Something that can be a parent: a look (sheet) plus genes. For drawn characters the genes are their tags. */
interface Parent { key: number; name: string; look: Character; genes: Tags | null; kind: "default" | "import" | "baby" }
interface Baby { genes: Tags; look: Character; distance: number; repainted: boolean }
interface Pair { a: Parent; b: Parent; babies: Baby[] }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
const rng = createRng(Date.now() % 1e9);
let nextKey = 1;

const defaults: Parent[] = DEFAULT_CHARACTERS.map((c) => ({ key: nextKey++, name: c.name, look: c, genes: c.tags, kind: "default" }));
const imported: Parent[] = [];
const kept: Parent[] = [];
const pairs: Pair[] = [];
let picked: Parent | null = null;

/** Where babies' looks come from: defaults + the player's gallery (imported sheets here). */
const pool = (): Character[] => [...DEFAULT_CHARACTERS, ...imported.filter((p) => p.genes).map((p) => p.look)];

const settings = () => ({
  count: Number($<HTMLSelectElement>("count").value),
  zoom: Number($<HTMLSelectElement>("zoom").value),
  view: $<HTMLSelectElement>("facing").value as View | "all",
});

function breed(a: Parent, b: Parent): Baby[] {
  const babies: Baby[] = [];
  for (let i = 0; i < settings().count; i++) {
    const genes = rollGenes(a.genes!, b.genes!, rng);
    const m = matchSheet(genes, pool(), [a.look.id, b.look.id], rng);
    if (m) babies.push({ genes, look: m.character, distance: m.distance, repainted: !!m.repainted });
  }
  return babies;
}

function figure(sheet: Sheet): HTMLElement {
  const { zoom, view } = settings();
  const box = document.createElement("div");
  box.className = "figure";
  for (const v of view === "all" ? VIEWS : [view]) box.append(renderView(sheet, v, zoom));
  return box;
}

const chips = (t: Tags | null, label = "") =>
  `<div class="chips">${label ? `<span class="chip-label">${label}</span>` : ""}${TAG_KEYS.map((k) =>
    t ? `<span class="chip" style="background:${hex(t[k])}" title="${k} ${hex(t[k])}"></span>` : `<span class="chip unset" title="${k}: not picked">?</span>`,
  ).join("")}</div>`;

function card(p: Parent): HTMLElement {
  const el = document.createElement("div");
  el.className = `card${picked === p ? " picked" : ""}${p.genes ? "" : " needs-tags"}`;
  el.append(figure(p.look.sheet));
  const info = document.createElement("div");
  info.innerHTML = `<div class="name">${esc(p.name)}</div>${chips(p.genes)}`;
  el.append(info);
  if (p.kind !== "default") {
    const tools = document.createElement("div");
    tools.className = "tools";
    tools.innerHTML = `${p.kind === "import" ? '<button data-a="tags" title="Pick tag colors">🎨</button><button data-a="png" title="Export PNG">⬇</button>' : ""}<button data-a="del" title="Remove">✕</button>`;
    el.append(tools);
  }
  el.onclick = (e) => {
    const action = (e.target as HTMLElement).closest("button")?.dataset.a;
    if (action === "tags") return pickTags(p);
    if (action === "png") return void download(p);
    if (action === "del") {
      for (const list of [imported, kept]) if (list.includes(p)) list.splice(list.indexOf(p), 1);
      if (picked === p) picked = null;
      return render();
    }
    if (!p.genes) return pickTags(p);
    if (!picked) picked = p;
    else if (picked === p) picked = null;
    else {
      pairs.unshift({ a: picked, b: p, babies: breed(picked, p) });
      picked = null;
    }
    render();
  };
  return el;
}

function render() {
  $("imported").replaceChildren(...imported.map(card));
  if (!imported.length) $("imported").innerHTML = `<p class="hint">Nothing yet. ⬆ Import PNG sheets (72×48: right | left | back, see ⬇ Template guide), then pick their 3 tag colors with 🎨.</p>`;
  $("kept").replaceChildren(...kept.map(card));
  if (!kept.length) $("kept").innerHTML = `<p class="hint">None yet.</p>`;
  $("defaults").replaceChildren(...defaults.map(card));

  const box = $("pairs");
  if (!pairs.length) {
    box.innerHTML = `<p class="hint">No pairs yet. Click two characters, or press 🎲 4 random pairs.</p>`;
    return;
  }
  box.replaceChildren(
    ...pairs.map((p) => {
      const row = document.createElement("section");
      row.className = "pair";
      row.innerHTML = `<div class="pair-head"><b>${esc(p.a.name)} × ${esc(p.b.name)}</b>
        <span><button data-a="reroll">🔁 Reroll</button> <button data-a="remove">✕</button></span></div>`;
      row.querySelector<HTMLButtonElement>('[data-a="reroll"]')!.onclick = () => { p.babies = breed(p.a, p.b); render(); };
      row.querySelector<HTMLButtonElement>('[data-a="remove"]')!.onclick = () => { pairs.splice(pairs.indexOf(p), 1); render(); };

      const parents = document.createElement("div");
      parents.className = "parents";
      for (const par of [p.a, p.b]) {
        const cell = document.createElement("div");
        cell.className = "parent";
        cell.append(figure(par.look.sheet));
        cell.insertAdjacentHTML("beforeend", `<div class="name">${esc(par.name)}</div>${chips(par.genes)}`);
        parents.append(cell);
      }

      const babies = document.createElement("div");
      babies.className = "babies";
      for (const baby of p.babies) {
        const cell = document.createElement("div");
        cell.className = "baby";
        cell.title = "Click to keep this baby as a parent (for grandkids)";
        cell.append(figure(baby.look.sheet));
        cell.insertAdjacentHTML("beforeend",
          `${chips(baby.genes, "genes")}${chips(baby.look.tags, "look")}<div class="small">${esc(baby.look.name)} · ${baby.repainted ? '<span class="repainted">repainted default</span>' : `off by ${(baby.distance * 100).toFixed(0)}`}</div>`);
        cell.onclick = () => {
          kept.push({ key: nextKey++, name: `${p.a.name}×${p.b.name} kid (${baby.look.name})`, look: baby.look, genes: baby.genes, kind: "baby" });
          render();
        };
        babies.append(cell);
      }
      row.append(parents, babies);
      return row;
    }),
  );
}

/** Eyedropper: pick a sheet's 3 tag colors by clicking pixels. */
function pickTags(p: Parent) {
  const tags: Partial<Tags> = { ...(p.genes ?? {}) };
  let current: TagKey = "hair";
  const { body, close } = openModal(`Tag colors: ${p.name}`);
  const scale = 8;
  const draw = () => {
    body.innerHTML = `<p>Choose a tag, then click a pixel on the drawing. These are just labels: tag any 3 colors you like.</p>
      <div class="tag-buttons">${TAG_KEYS.map((k) =>
        `<button data-k="${k}" class="${k === current ? "primary" : ""}">${k} <span class="chip" style="background:${tags[k] !== undefined ? hex(tags[k]!) : "transparent"}"></span></button>`).join("")}</div>
      <div class="picker"></div>
      <div class="modal-actions"><button data-a="done" class="primary" ${TAG_KEYS.every((k) => tags[k] !== undefined) ? "" : "disabled"}>Done</button></div>`;
    for (const b of body.querySelectorAll<HTMLButtonElement>("[data-k]")) b.onclick = () => { current = b.dataset.k as TagKey; draw(); };
    const views = body.querySelector(".picker")!;
    for (const v of VIEWS) {
      const c = renderView(p.look.sheet, v, scale);
      c.onclick = (e) => {
        const rect = c.getBoundingClientRect();
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * c.width);
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * c.height);
        const [r, g, b, a] = c.getContext("2d")!.getImageData(x, y, 1, 1).data;
        if (a < 16) return;
        tags[current] = (r << 16) | (g << 8) | b;
        current = TAG_KEYS[(TAG_KEYS.indexOf(current) + 1) % TAG_KEYS.length];
        draw();
      };
      views.append(c);
    }
    body.querySelector<HTMLButtonElement>('[data-a="done"]')!.onclick = () => {
      p.genes = tags as Tags;
      p.look = { ...p.look, tags: tags as Tags };
      close();
      render();
    };
  };
  draw();
}

async function download(p: Parent) {
  const blob = await sheetToPngBlob(p.look.sheet);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\w-]+/g, "_")}.png`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── controls ──
for (const id of ["count", "zoom", "facing"]) $(id).addEventListener("change", () => {
  if (id === "count") for (const p of pairs) p.babies = breed(p.a, p.b);
  render();
});
$("import").onclick = () => $<HTMLInputElement>("file").click();
$<HTMLInputElement>("file").onchange = async (e) => {
  const input = e.target as HTMLInputElement;
  for (const file of input.files ?? []) {
    try {
      const name = file.name.replace(/\.png$/i, "");
      const look: Character = { id: `import-${nextKey}`, name, sheet: await pngToSheet(file), tags: { hair: 0, skin: 0, eyes: 0 } };
      imported.push({ key: nextKey++, name, look, genes: null, kind: "import" });
    } catch (err) {
      alert(`${file.name}: ${(err as Error).message}`);
    }
  }
  input.value = "";
  render();
};
$("guide").onclick = () => {
  templateGuideCanvas().toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob!);
    a.download = "sheet-template-guide.png";
    a.click();
  });
};
$("random").onclick = () => {
  const all = [...imported, ...kept, ...defaults].filter((p) => p.genes);
  for (let i = 0; i < 4; i++) {
    const a = rng.pick(all);
    const b = rng.pick(all.filter((x) => x !== a));
    pairs.unshift({ a, b, babies: breed(a, b) });
  }
  render();
};
$("rerollall").onclick = () => { for (const p of pairs) p.babies = breed(p.a, p.b); render(); };
$("clear").onclick = () => { pairs.length = 0; render(); };

// start with a couple of contrasting pairs
pairs.push({ a: defaults[0], b: defaults[5], babies: [] }, { a: defaults[2], b: defaults[7], babies: [] });
for (const p of pairs) p.babies = breed(p.a, p.b);
render();
