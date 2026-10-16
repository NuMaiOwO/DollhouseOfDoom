# Roadmap

The little people are called **Dummies** (not Sims). No genders: anyone can pair with anyone.

**Rule: feature-complete first, content second.** Build every core system to its
"done" bar before adding more deaths, personalities or polish. New ideas go in the
[Parking lot](#parking-lot), not into the current milestone.

| # | Milestone | Status |
|---|---|---|
| 0 | Core gameplay prototype | ✅ Done: it's fun |
| 1 | Save / load | ✅ Done |
| 2 | Character Studio, character gallery, babies | 🔨 Next |
| 3 | Build mode | ⏳ |
| 4 | Small / big modes + desktop window | ⏳ |
| — | **The game is "done"**: content phase starts | |

---

## 0. Core gameplay prototype ✅
Needs and autonomy, relationships, babies, aging, 4 personalities, fire, toilet,
fridge, puddles, repairs, death codex, graveyard, Chaos slider with agreed death
rates (`npm run balance`).

## 1. Save / load ✅
Done when:
- [x] The whole house survives closing and reopening (Dummies, relationships, objects, fires, puddles, codex, graveyard, clock)
- [x] Autosaves regularly and when the page or app is closed
- [x] Up to 5 house slots, each autosaving independently; the last played house resumes on launch
- [x] Houses menu: thumbnail, name, day, population, deaths, last played; Play / Rename / Copy / Delete / New house
- [x] In-game confirm and rename dialogs (no browser popups)
- [x] Save status next to the Save button ("Saved 10s ago"; the icon pulses on each autosave; warns if saving fails)
- [x] Manual Save button with a "Saved" confirmation, on top of autosave (no Ctrl+S: it would steal the shortcut from work apps)
- [x] A loaded game continues exactly as if it had never stopped (tested)
- [x] Old or broken saves are ignored instead of crashing

## 2. Character Studio + character gallery + babies
Done when:
- [x] Sheet format decided: three 24×48 views drawn separately: facing right, facing left, back (turned away, e.g. climbing). PNG layout 72×48. No layers. Draw anything: no regions, nothing the game needs to recognize in the drawing
- [ ] Pixel painter: draw on the sheet, pick colors, erase, clear
- [ ] Optional mirror helpers (nothing mirrors automatically): a one-time "Copy & flip from the other side" button (asks before overwriting) and a live mirror toggle (off by default)
- [ ] Every sheet has 3 tag colors, labeled "hair", "skin", "eyes" (just labels: a slime or a demon lord tags whatever 3 colors it likes)
- [ ] Name + personality per character
- [ ] **Character gallery**: the player's saved characters; browse, edit, delete
- [ ] Import / export character sheets as PNG (draw in any pixel tool; share characters)
- [ ] A set of default sheets (any personality), so the game works before the player draws anything
- [ ] "Add" moves in a random character from the gallery + defaults (optionally: from one personality)
- [ ] Dummies render with their sheet (transforms only: bob, spin, tip over; no per-frame art)
- [ ] **Babies**: for each tag, a color somewhere between the two parents' colors (leaning toward one parent or near the middle); the baby is the sheet, from defaults + gallery, whose tags are closest
  - The baby's **genes are the rolled colors**, not the matched sheet's tags; grandkids roll from the genes, so family colors drift smoothly even when the sprite match is rough
  - Never a parent's own sheet; pick randomly among the 3 closest (weighted), so siblings differ
  - Matches must be within "off by 10"; if nothing is, a default is repainted to the exact gene colors (defaults only, never player art)
  - Matched sheets are used as drawn: no recoloring of anyone's art
  - ~30–40 default sheets with a wide spread of tag colors, so matches stay close while the gallery is small
- [ ] **Baby Lab** test page: pick several pairs, see a grid of babies per pair, reroll, breed babies onward (grandkids), so matching can be judged by eye

## 3. Build mode
Done when:
- [ ] The house is a grid of cells (wall, floor, empty) instead of a hard-coded layout
- [ ] Add and remove walls and floors
- [ ] Place and remove ladders (more than one; floors are no longer fixed at 2)
- [ ] Place, move and remove furniture from a catalog (fridge, stove, toilet, bed, couch), with placement rules
- [ ] Rooms are detected from walls (names optional)
- [ ] Dummies find their way through any layout, and get stuck when there's no route (intentionally!)
- [ ] Fire, puddles and launches work on player-built houses
- [ ] The layout saves and loads
- [ ] Wallpaper / floor colors (basic decorating)

## 4. Small / big modes + desktop window
Done when:
- [ ] **Small mode**: a 1:2 (height:width) box with the house, Add, and speed; Meddle, Chaos and other controls hidden under `⋯`
- [ ] **Big mode**: house plus Character Studio, Build mode, inspector, log, codex, graveyard
- [ ] `⤢` switches between the modes
- [ ] Desktop app (Tauri): small mode is frameless, always on top, docked to a screen edge
- [ ] Low CPU when idle (capped frame rate, paused when hidden)
- [ ] Keyboard shortcuts never interfere with other apps: none in small mode; big mode only uses keys no work app needs
- [ ] Saves go to a file instead of browser storage

---

## Parking lot
Ideas for the content phase. Don't start these before milestones 1–4 are done.

- Dummies catch fire and run around spreading it
- Repairs can go wrong (electrocution, soaking)
- Fridge has limited food; "stock the fridge" lever
- Slow motion / camera focus on dramatic deaths
- Locking doors, removing ladders as a cruelty lever (partly comes with build mode)
- Pool (and removing its ladder)
- More personalities (Lazy, Neat freak, Paranoid, Peacemaker)
- Ghosts that haunt the house
- "While you were away" summary
- Sound effects (death sting, bonk, sad trombone)
- Export / import cast packs to share
- Family tree view (the comically long kind: generations of Sasuke × Anya descendants)
- Sprite art to replace placeholders (the visual registry is ready)
