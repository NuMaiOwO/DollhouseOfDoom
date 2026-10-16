/** In-game modal dialogs (browser confirm()/prompt() won't be reliable in the desktop app). */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);

/** A short message that fades out by itself. */
export function toast(message: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.classList.add("out"), 1400);
  setTimeout(() => el.remove(), 1900);
}

/** Opens a modal with arbitrary content. Returns the content element and a close function. */
export function openModal(title: string, onClose?: () => void) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x" aria-label="Close">✕</button></div>
    <div class="modal-body"></div></div>`;
  document.body.append(backdrop);
  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector<HTMLButtonElement>(".modal-x")!.onclick = close;
  return { body: backdrop.querySelector<HTMLDivElement>(".modal-body")!, close };
}

export function confirmDialog(message: string, confirmLabel = "OK", danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const { body, close } = openModal("Are you sure?", () => { if (!answered) resolve(false); });
    body.innerHTML = `<p>${esc(message)}</p>
      <div class="modal-actions"><button data-a="no">Cancel</button><button data-a="yes" class="${danger ? "danger" : "primary"}">${esc(confirmLabel)}</button></div>`;
    for (const b of body.querySelectorAll<HTMLButtonElement>("button")) {
      b.onclick = () => {
        answered = true;
        resolve(b.dataset.a === "yes");
        close();
      };
    }
    body.querySelector<HTMLButtonElement>('[data-a="yes"]')!.focus();
  });
}

export function promptDialog(title: string, initial: string): Promise<string | null> {
  return new Promise((resolve) => {
    let answered = false;
    const { body, close } = openModal(title, () => { if (!answered) resolve(null); });
    body.innerHTML = `<form><input maxlength="40" value="${esc(initial)}" />
      <div class="modal-actions"><button type="button" data-a="no">Cancel</button><button type="submit" class="primary">Save</button></div></form>`;
    const input = body.querySelector("input")!;
    body.querySelector("form")!.onsubmit = (e) => {
      e.preventDefault();
      answered = true;
      resolve(input.value);
      close();
    };
    body.querySelector<HTMLButtonElement>('[data-a="no"]')!.onclick = () => close();
    input.focus();
    input.select();
  });
}
