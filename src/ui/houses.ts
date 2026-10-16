import { MAX_SLOTS, createSlot, deleteSlot, duplicateSlot, listSlots, renameSlot, type SlotMeta } from "../save";
import { confirmDialog, openModal, promptDialog } from "./dialog";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/**
 * The Houses menu: every save slot with Play / Rename / Copy / Delete, plus New house.
 * `currentId` is the house being played (null in replay mode). `beforeLeave` saves it first.
 */
export function openHousesMenu(opts: { currentId: string | null; beforeLeave: () => void; play: (id: string) => void }) {
  const { body, close } = openModal("Houses");

  const render = () => {
    const slots = listSlots();
    const card = (s: SlotMeta) => {
      const current = s.id === opts.currentId;
      return `<li class="slot${current ? " current" : ""}" data-id="${s.id}">
        <div class="thumb">${s.thumb ? `<img src="${s.thumb}" alt="">` : "🏚️"}</div>
        <div class="info">
          <b>${esc(s.name)}</b>${current ? ' <span class="tag">Playing</span>' : ""}
          <div class="small">Day ${s.day} · 👥 ${s.population} · 💀 ${s.dead} · ${ago(s.updatedAt)}</div>
          <div class="slot-actions">
            ${current ? "" : '<button data-a="play" class="primary">▶ Play</button>'}
            <button data-a="rename">Rename</button>
            <button data-a="copy" ${slots.length >= MAX_SLOTS ? "disabled" : ""}>Copy</button>
            ${current ? "" : '<button data-a="delete" class="danger">Delete</button>'}
          </div>
        </div></li>`;
    };
    body.innerHTML = `<ul class="slots">${slots.map(card).join("")}</ul>
      <div class="modal-actions">
        <span class="small">${slots.length}/${MAX_SLOTS} slots${slots.length >= MAX_SLOTS ? " · delete a house to make room" : ""}</span>
        <button data-a="new" class="primary" ${slots.length >= MAX_SLOTS ? "disabled" : ""}>＋ New house</button>
      </div>`;

    for (const b of body.querySelectorAll<HTMLButtonElement>("button[data-a]")) {
      const id = b.closest<HTMLElement>(".slot")?.dataset.id;
      const slot = slots.find((s) => s.id === id);
      b.onclick = async () => {
        switch (b.dataset.a) {
          case "play":
            opts.beforeLeave();
            close();
            opts.play(id!);
            break;
          case "new": {
            const meta = createSlot();
            if (!meta) return;
            opts.beforeLeave();
            close();
            opts.play(meta.id);
            break;
          }
          case "rename": {
            const name = await promptDialog("Rename house", slot!.name);
            if (name) renameSlot(id!, name);
            render();
            break;
          }
          case "copy":
            opts.beforeLeave(); // copy the latest state of the current house
            duplicateSlot(id!);
            render();
            break;
          case "delete":
            if (await confirmDialog(`Delete "${slot!.name}"? Everyone in it is gone for good.`, "Delete", true)) deleteSlot(id!);
            render();
            break;
        }
      };
    }
  };
  render();
}
