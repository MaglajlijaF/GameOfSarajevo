# Game of Sarajevo (Igra Sarajeva)

A 2D retro pixel-art, side-view combat platformer set in Sarajevo's neighbourhoods. Built with
TypeScript, Phaser 3 and Electron, as a Windows desktop game played with keyboard and mouse.

**Status: Milestone 1 (vertical slice), ready for playtesting.**

## Run it

```bash
npm install
npm run dev            # browser at http://localhost:5173 (save goes to localStorage)
npm start              # builds and launches the Electron desktop app (save goes to save.json)
npm test               # unit tests (vitest)
npm run build:web && npm run smoke        # headless browser smoke test (movement, menus)
npm run build:web && npm run playthrough  # scripted full Kovači run + 45-enemy stress test
```

The Windows `.exe` packaging (`npm run dist:win`) is configured but is scheduled for milestone 4.

## Controls (rebindable in Postavke / Settings)

| Action | Default |
|---|---|
| Move | A / D |
| Jump / double jump | Space (hold for a higher jump) |
| Dash (brief invulnerability) | Shift |
| Climb ladder | W / S |
| Drop through a wooden platform | S + Space |
| Aim / attack | Mouse / left click (hold to keep attacking) |
| Pause | Esc |
| Toggle fullscreen | F11 (desktop app), or Settings |

## What milestone 1 contains

- Main menu with a stylised Sarajevo map (Miljacka, hills, tram line) and all 13 stage nodes. Locked stages stay visible but can't be entered.
- Kovači: a side-scrolling level with 5 combat arenas, each camera-locked behind gates until it's cleared, then a boss arena.
- 4 enemy types: souvenir seller (melee walker), pigeon feeder (arcing ranged thrower), delivery runner (platform jumper) and crate porter (wind-up charger).
- Boss **Majstor Kazandžija** (master coppersmith) with 2 phases. Phase 1: slam, charge, pot volley. Phase 2: pot rain with warnings, double shockwave, leap, charge, summon.
- XP → level-up pause → pick 1 of 3 weapons to merge plus 1 of 3 buffs (strength, speed, durability).
- 12 mergeable local weapons. Each merge adds a behavior: tram handle (swing), ćevapi skewer (piercing throw), džezva (coffee spray), fildžan (boomerang), umbrella (orbit), baking tray (ground shockwave), pigeon (homing), tram bell (pulse), burek (bouncer), lokum (slow on every hit), lantern (burn on every hit) and sudžuk (chain hits). The weapon's sprite (attached charms and a glow), swing colour and generated Bosnian name change with every merge, e.g. *Lančana Burekova Tramvajska ručka IV +2*.
- KM rewards (replays pay 35%), and a shop with Health, Damage, Move speed, XP gain and starting weapons (Ćevap-ražanj, Džezva).
- A JSON save file holding money, upgrades, unlocks, clears and settings, with a reset option. Unlocks are recomputed from the clear chain on every load.
- Settings: Bosnian (default) or English, volumes, fullscreen, key rebinding, reset save.
- Generated chiptune music for each stage and the boss, plus generated sound effects (WebAudio, no audio files).

Stages 2–13 currently reuse Kovači's content and are marked as placeholders in the menu. They exist so the unlock chain can be played end to end. Unique content for them comes in milestone 3.

## Architecture

```
src/core/      Pure TS game rules, no Phaser: unlocking, XP, weapon merging, economy, save validation,
               wave director, level assembly, i18n, keybinds. Unit-tested in tests/.
src/data/      JSON data: stages (order = unlock order), enemies, bosses, weapons, buffs, shop,
               characters, sprite recipes, themes, arena layouts, tuning, lang/bs.json + en.json.
src/art/       Programmatic pixel art from palette data: font, humanoid generator (one 24x24 frame
               layout for every character), tiles, parallax layers, weapon icons, map.
               manifest.ts is the single list of every texture.
src/audio/     WebAudio chiptune sequencer + SFX.
src/game/      Phaser layer: scenes, entities (Player, Enemy, Boss), combat (pooled projectiles,
               WeaponSystem), HUD, controls.
src/platform/  Save-file and window bridge (Electron IPC, or localStorage in a browser).
electron/      Main process (atomic save.json writes plus .bak backup) and preload.
```

- **Reorder stages:** edit `order` in `src/data/stages.json`. Unlocking follows that array; no code changes needed.
- **Swap in hand-drawn art:** change an entry in `src/art/manifest.ts` to `{ kind: 'image', url, frameWidth, frameHeight }` and keep the same key and frame layout. Character sheets use 14 frames: idle×2, run×4, jump, fall, attack×2, hurt, defeat×3.
- **Edit arenas:** `scripts/build-layouts.mjs` (ASCII → `layouts.json`, size-checked). Legend: `#` solid, `=` one-way, `H` ladder, `^` hazard, `S` enemy spawn, `B` boss spawn.
- **Pooling:** enemies (64) and projectiles (320 player and 160 enemy) are Arcade groups reused through `get()`, `spawn()`/`fire()` and `kill()`.
- **Resolution:** internal 640×360 (16 px tiles), scaled to the window with nearest-neighbour filtering. That is exactly 3× at 1920×1080.

## Assumptions made

- **Sizes:** characters are about 22 px tall in 24×24 frames (about 1.4 tiles). Bosses are 2× size (48×48).
- **Level-ups:** a level-up offers 3 weapons, with new behaviors favoured and sometimes a tier upgrade of a part you already have. You pick one weapon and one buff per level-up. Each part caps at tier 3.
- **Locked arenas:** a wave is one camera-locked arena. Enemies spawn in sub-batches inside it, with a maximum number alive at once that rises from wave 1 to wave 5. Clearing an arena heals 10% HP.
- **KM:** only a boss kill pays KM. Defeat or quitting pays 0, never unlocks anything and only updates statistics.
- **English:** an optional English file is included. All UI text comes from the language files, and Bosnian is the default.
- **Content limits:** enemies are everyday roles (vendors, couriers, porters). There are no real people, logos, brands or war references, and no memorials or cemeteries are used as locations.
