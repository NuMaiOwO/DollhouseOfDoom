# Dollhouse of Doom

A tiny side-view dollhouse. Drop in Dummies (our little not-Sims) with one extreme personality, then watch them
eat, flirt, fight, breed, set the kitchen on fire, and die.

## Run it

```
npm install          # first time only
npm run dev          # play at http://localhost:5173  (add ?seed=123 to replay a house)
npm test             # headless simulation tests
npm run simulate     # balance report: npm run simulate -- [runs] [days] [cast]
                     #   e.g. npm run simulate -- 50 6 asshole,asshole,flirty
npm run balance      # check every Chaos level against the agreed death-rate targets
npm run build        # itch.io build in dist/ (zip the contents, upload as HTML game)
npm run screenshot   # headless Edge screenshots of the running game
```

Controls: Space pause, 1/2/3 speed, click a Dummy to inspect it.

## How it's built

```
src/sim/      pure simulation, no graphics (testable, runs headless)
  world.ts      the World: tick(), needs, actions, fire, death, birth, events
  autonomy.ts   decision stages: AVAILABLE -> DESIRE -> ACCEPT -> OUTCOME
src/data/     the content: add features here, not in the AI code
  interactions.ts   everything Dummies can do (tags, gains, hazards, outcomes)
  personalities.ts  personality = bundle of tag multipliers
  modifiers.ts      desire rules (hate, love, anger, grief, decency...)
  deaths.ts         death codex entries + epitaphs
  tuning.ts         ALL accident odds, per Chaos level (Calm / Normal / Chaos) + the targets
src/render/   Phaser greybox renderer; only reads sim state
  visuals.ts    visual registry: set `sprite` to swap a placeholder for real art
src/ui/       DOM HUD: controls, inspector, log, codex, graveyard
```

**Changing how deadly things are:** edit `src/data/tuning.ts`, then run `npm run balance`.
Normal must hit: a death every 2–3 real minutes in a busy (8-Dummy) house, grandkids in most houses,
and object accidents ahead of beatings.

**Adding a personality:** add an entry in `personalities.ts` with tag multipliers.
**Adding an interaction:** add it to `interactions.ts` with tags; existing rules apply automatically.
**Adding art:** put `stove.png` in `public/assets/`, set `sprite: "stove"` in `visuals.ts`.
