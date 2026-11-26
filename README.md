# Necromante

> A pixel-art roguelite defense game for mobile: your necromancer never leaves the altar — you drag a circle, and everything that dies inside it rises as undead to fight for you.

The undead army is your **shield, your ammunition and your score** at the same time. Built with **TypeScript + Phaser 3 + Vite** and packaged for Android with **Capacitor**. All art, font, sound effects and music are **generated in code** — the project contains no image or audio files. The game UI and design docs are in Brazilian Portuguese; code and this README are in English.

> **Status:** playable prototype in active development (working title). There is no hosted web demo yet; run it locally (below) or build the Android app.

## Gameplay

- **Drag** anywhere on the field to move the circle (relative movement, so your finger never covers it). The necromancer zaps enemies in the circle; those that die there **rise** on your side.
- **Actions:** *Explode* the dead in the circle, *Merge* three skeletons into a Bone Colossus, *Consume* the dead to heal, and a character-specific **Ritual** charged by kills.
- **Pacts (cards):** on even waves you pick one pact. Pacts belong to five **schools** (bone, flesh, plague, spirit, blood); three cards of a school unlock *Mastery* and five unlock *Dominion*, which changes the weather of the match.
- **Hordes:** waves of 40 to 150+ living enemies; killing dozens at once triggers one big impact and a combo counter.
- **Run structure:** 4 regions (Village, Monastery, Fortress, Cathedral) with 5 waves and a boss each, then infinite **Abyss circles** with new modifiers. Beating a boss unlocks a **checkpoint**, a **crossroads** route choice and optional risk/reward **events**; defeated bosses become **champions** you can bring along.
- **Heresy:** difficulty levels (up to 10) unlocked after the Cathedral, each adding a rule and +10% souls.
- **Daily challenge:** same seed and two Abyss modifiers for everyone, with a first-attempt bonus.
- **Five playable necromancers** with different main actions (unlocked via achievements or souls), **33 items** across 6 slots with set bonuses, gems, a forge, a market and a permanent-upgrade tree (6 branches, 48 nodes, see [`docs/ARVORE.md`](docs/ARVORE.md)).
- **Save & resume** at the end of every wave and when the app is minimized.
- Tutorial without text: a hand shows each gesture at the moment it is useful.

## Tech stack

| Area | Technology |
|---|---|
| Language | TypeScript (strict) |
| Engine | Phaser 3 (`pixelArt` mode), 180×320 portrait base resolution with integer scaling |
| Build / dev | Vite |
| Mobile | Capacitor (Android; haptics, preferences, filesystem, share) |
| Tests | Vitest |
| Lint / format | Biome |
| Art / audio | Procedural pixel art, font, SFX and music generated in code; optional Aseprite import pipeline |
| Tooling | `tsx` scripts for balance simulation and diagnostics |

## Architecture highlights

- **Simulation separate from rendering.** The game logic lives in pure TypeScript under [`src/sim`](src/sim) (no Phaser); scenes only draw. This is what makes the simulation unit-testable and runnable headless.
- **Seeded, deterministic randomness.** A mulberry32 RNG whose state is saved with the run: the same seed gives the same random sequence — useful for debugging, balancing, resuming a run and the daily challenge.
- **Handles hundreds of units.** A spatial grid (`spatial.ts`) for neighbours, areas and separation avoids O(n²) checks.
- **Data-driven content.** Units, bosses, schools, items, regions and modifiers are defined as data (`defs.ts`, `cards.ts`, `items.ts`, `regions.ts`).
- **Balance simulator.** `npm run sim` plays automatic runs with a bot to compare win rates per school, character and starting region, and `scripts/diag.ts` profiles a run wave by wave.
- **Versioned saves with migrations** (save format v5), exposed through Capacitor Preferences.
- **Optional anonymous test telemetry.** Each finished run and errors can be sent to a Supabase project. It uses the public *publishable* key with Row Level Security allowing inserts only (see [`docs/telemetria.sql`](docs/telemetria.sql)); a random device id is the only identifier, rows queue offline, and it can be switched off in Options.

Project layout:

```
src/
  sim/        pure game logic: world, combat, cards/schools, items, regions, events, tree, meta/save
  scenes/     Phaser scenes: Boot, Menu, Run, Graveyard (meta), Bestiary, Records, Options
  art/        procedural sprites, palette, text, Aseprite import
  audio/ fx/  procedural audio and juice (screen shake, damage numbers, ...)
  platform/   save, haptics and telemetry wrappers (Capacitor)
scripts/      balance simulator and diagnostics
tests/        Vitest suites for the simulation
docs/         style guide, upgrade tree, telemetry SQL
```

See also the [ROADMAP](ROADMAP.md) (design notes, in Portuguese) and the [style guide](docs/ESTILO.md).

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 (also prints the LAN address for testing on a phone)
```

To test on a phone, connect it to the same Wi-Fi and open the `Network:` address printed by `npm run dev`.

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm test` | simulation tests (Vitest) |
| `npm run typecheck` | TypeScript type-check |
| `npm run lint` / `npm run format` | Biome |
| `npm run build` | type-check and production build to `dist/` |
| `npm run sim -- 40 2` | balance simulator: 40 automatic runs at meta-progression level 2 |
| `npm run sim -- 16 2 builds` | win rate per school |
| `npm run sim -- 14 2 chars` | win rate per character |
| `npm run android` | build, `cap sync` and open Android Studio (requires Android Studio/JDK) |

### Debug URL parameters

`?run` (skip menu), `?auto` (the game plays itself), `?wave=13` (start at a wave), `?meta=3` (fake meta-progression), `?scene=Graveyard`, `?fps`, `?char=reaper`. `window.__game` exposes the game in the browser console.

## Tests

```bash
npm test
```

4 Vitest suites with about 60 test cases cover the simulation (world/combat, features such as schools, events and characters, items, and the Aseprite importer).

## Assets

Export from Aseprite (JSON with tags) into `public/assets/sprites/` and register it in `manifest.json`; exported art replaces the generated art under the same keys. See `src/art/aseprite.ts` and the example in `docs/exemplo-aseprite/`.

## License

No license has been chosen yet; all rights reserved by default.
