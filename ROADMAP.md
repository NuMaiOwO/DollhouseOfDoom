# Roadmap

**Rule: feature-complete first, content second.** Build every core system to its
"done" bar before adding more deaths, personalities or polish. New ideas go in the
[Parking lot](#parking-lot), not into the current milestone.

| # | Milestone | Status |
|---|---|---|
| 0 | Core gameplay prototype | ✅ Done: it's fun |
| 1 | Save / load | ✅ Done |
| 2 | Character Studio, cast library, baby blending | 🔨 Next |
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
- [x] The whole house survives closing and reopening (Sims, relationships, objects, fires, puddles, codex, graveyard, clock)
- [x] Autosaves regularly and when the page or app is closed
- [x] Up to 5 house slots, each autosaving independently; the last played house resumes on launch
- [x] Houses menu: thumbnail, name, day, population, deaths, last played; Play / Rename / Copy / Delete / New house
- [x] In-game confirm and rename dialogs (no browser popups)
- [x] Save status next to the Save button ("Saved 10s ago"; the icon pulses on each autosave; warns if saving fails)
- [x] Manual Save button with a "Saved" confirmation, on top of autosave (no Ctrl+S: it would steal the shortcut from work apps)
- [x] A loaded game continues exactly as if it had never stopped (tested)
- [x] Old or broken saves are ignored instead of crashing

## 2. Character Studio + cast library + baby blending
Done when:
- [ ] A fixed character template with regions (hair, face, torso, legs, feet), decided **before** anyone draws
- [ ] Pixel painter: draw on the template, pick colors, erase, clear
- [ ] Name + personality per character; saved to a local cast library
- [ ] Edit and delete cast members
- [ ] "Add" moves in a random cast member (optionally: random from one personality)
- [ ] Sims render with their drawing (transforms only: bob, spin, tip over; no per-frame art)
- [ ] Babies inherit each region from one parent, with occasional small color mutations
- [ ] Traits visibly carry across generations (tested)

## 3. Build mode
Done when:
- [ ] The house is a grid of cells (wall, floor, empty) instead of a hard-coded layout
- [ ] Add and remove walls and floors
- [ ] Place and remove ladders (more than one; floors are no longer fixed at 2)
- [ ] Place, move and remove furniture from a catalog (fridge, stove, toilet, bed, couch), with placement rules
- [ ] Rooms are detected from walls (names optional)
- [ ] Sims find their way through any layout, and get stuck when there's no route (intentionally!)
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

- Sims catch fire and run around spreading it
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
- Family tree view
- Sprite art to replace placeholders (the visual registry is ready)
