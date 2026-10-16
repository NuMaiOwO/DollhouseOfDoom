import { World, type SaveData } from "./sim/world";

/**
 * House save slots, kept in browser storage. The desktop app (milestone 4) will
 * swap the storage underneath for files; the functions here stay the same.
 *
 * Layout: one index of slot metadata (for the Houses menu) + one key per slot's game data.
 */
export const MAX_SLOTS = 5;
const PREFIX = "dollhouse-of-doom";
const INDEX_KEY = `${PREFIX}/slots`;
const LAST_KEY = `${PREFIX}/last-slot`;
const LEGACY_KEY = `${PREFIX}/save`; // the single save from before slots existed
const slotKey = (id: string) => `${PREFIX}/slot/${id}`;
const AUTOSAVE_MS = 15_000;

export interface SlotMeta {
  id: string;
  name: string;
  day: number;
  population: number;
  dead: number;
  createdAt: number;
  updatedAt: number;
  /** Small JPEG of the house, as a data URL. */
  thumb?: string;
}

// ── storage helpers (never throw: storage can be full, blocked or private) ──

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Could not save ${key}:`, err);
    return false;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing to remove
  }
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── slots ──

export function listSlots(): SlotMeta[] {
  migrateLegacySave();
  return (read<SlotMeta[]>(INDEX_KEY) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

function writeIndex(slots: SlotMeta[]) {
  write(INDEX_KEY, slots);
}

function updateMeta(id: string, patch: Partial<SlotMeta>) {
  writeIndex(listSlots().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

/** Registers an empty slot; the game creates a fresh house when it opens a slot with no data. */
export function createSlot(name?: string): SlotMeta | null {
  const slots = listSlots();
  if (slots.length >= MAX_SLOTS) return null;
  const now = Date.now();
  const used = new Set(slots.map((s) => s.name));
  let n = slots.length + 1;
  while (!name && used.has(`House ${n}`)) n++;
  const meta: SlotMeta = { id: newId(), name: name ?? `House ${n}`, day: 1, population: 0, dead: 0, createdAt: now, updatedAt: now };
  writeIndex([...slots, meta]);
  return meta;
}

export function loadSlot(id: string): World | null {
  const data = read<SaveData>(slotKey(id));
  if (!data) return null;
  try {
    return World.fromSave(data);
  } catch (err) {
    console.warn("Ignoring unreadable save:", err);
    return null;
  }
}

export function saveSlot(id: string, w: World, thumb?: string): boolean {
  if (!write(slotKey(id), w.toSave())) return false;
  updateMeta(id, {
    day: w.day,
    population: w.population,
    dead: w.graveyard.length + w.dummies.filter((s) => !s.alive).length,
    updatedAt: Date.now(),
    ...(thumb ? { thumb } : {}),
  });
  return true;
}

export function renameSlot(id: string, name: string) {
  const clean = name.trim().slice(0, 40);
  if (clean) updateMeta(id, { name: clean });
}

/** Copies a house into a new slot (e.g. a backup before trying something cruel). */
export function duplicateSlot(id: string): SlotMeta | null {
  const source = listSlots().find((s) => s.id === id);
  const data = read<SaveData>(slotKey(id));
  if (!source || !data) return null;
  const copy = createSlot(`${source.name} (copy)`.slice(0, 40));
  if (!copy) return null;
  write(slotKey(copy.id), data);
  updateMeta(copy.id, { day: source.day, population: source.population, dead: source.dead, thumb: source.thumb, updatedAt: Date.now() });
  return copy;
}

export function deleteSlot(id: string) {
  remove(slotKey(id));
  writeIndex(listSlots().filter((s) => s.id !== id));
  if (getLastSlot() === id) remove(LAST_KEY);
}

export function getLastSlot(): string | null {
  const id = read<string>(LAST_KEY);
  return id && listSlots().some((s) => s.id === id) ? id : null;
}

export function setLastSlot(id: string) {
  write(LAST_KEY, id);
}

/**
 * Saves the open slot every few seconds and whenever the page is hidden or closed.
 * Returns `saveNow` (for the Save button) and `stop`.
 */
export function startAutosave(
  id: string, w: World, makeThumb: () => Promise<string | undefined>, onSaved: (ok: boolean) => void = () => {},
) {
  let thumb: string | undefined;
  const save = () => onSaved(saveSlot(id, w, thumb));
  const saveWithThumb = async () => {
    thumb = (await makeThumb().catch(() => undefined)) ?? thumb;
    save();
  };
  const onHide = () => { if (document.visibilityState === "hidden") save(); };
  const timer = setInterval(saveWithThumb, AUTOSAVE_MS);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", save);
  void saveWithThumb();
  return {
    saveNow: saveWithThumb,
    stop: () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    },
  };
}

/** Before slots there was one save; turn it into the first slot so nobody loses their house. */
function migrateLegacySave() {
  const legacy = read<SaveData>(LEGACY_KEY);
  if (!legacy) return;
  remove(LEGACY_KEY);
  const now = Date.now();
  const meta: SlotMeta = { id: newId(), name: "My house", day: Math.floor(legacy.t / 1440) + 1, population: 0, dead: 0, createdAt: now, updatedAt: now };
  write(slotKey(meta.id), legacy);
  write(INDEX_KEY, [...(read<SlotMeta[]>(INDEX_KEY) ?? []), meta]);
  write(LAST_KEY, meta.id);
}
