# Game of Sarajevo (Igra Sarajeva)

A 2D retro pixel-art, side-view combat platformer set in Sarajevo's neighbourhoods. Built with
TypeScript, Phaser 3 and Electron, as a Windows desktop game played with keyboard and mouse.

**Status: Milestone 3 (all 13 stages, characters, bosses), ready for playtesting.**

## Run it

```bash
npm install
npm run dev            # browser at http://localhost:5173 (save goes to localStorage)
npm start              # builds and launches the Electron desktop app (save goes to save.json)
npm test               # unit tests (vitest)
npm run build:web && npm run smoke        # headless browser smoke test (movement, menus)
npm run build:web && npm run playthrough  # scripted full Kovači run + 45-enemy stress test
npm run build:web && node scripts/campaign.mjs  # plays all 13 stages and checks every boss fights back
```

The Windows `.exe` packaging (`npm run dist:win`) is configured but is scheduled for milestone 4.

## Install on Windows / share with friends

Every push builds the game on GitHub (Actions → **Build game** → the latest run → *Artifacts*):

- **GameOfSarajevo-Windows**: `GameOfSarajevo-Setup-x.y.z.exe` installs the game with a desktop and Start-menu shortcut. `GameOfSarajevo-Portable-x.y.z.exe` runs without installing.
- **GameOfSarajevo-Web**: the browser version. Upload this zip to itch.io as an HTML game, and friends can play from a link.

The exe isn't code-signed, so Windows SmartScreen shows "Windows protected your PC". Click **More info → Run anyway**. Saves are stored in `%APPDATA%\Game of Sarajevo\save.json`.

To build locally on Windows instead, run `npm run dist:win`. The output goes in `release/`. To regenerate the icon, run `npm run build:web && node scripts/make-icon.mjs`.

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

## Campaign

| # | Stage | Look | Enemies | Boss |
|---|---|---|---|---|
| 1 | Kovači | old town, cobbles, grill coals | souvenir seller, pigeon feeder, delivery runner, crate porter | Master Coppersmith |
| 2 | Bistrik | steep hillside, stone walls, sunset, rose thorns | accordionist (wavy notes), gardener (flower-pot bombs), stair jogger (dash), neighbour (umbrella shield) | Fountain Keeper |
| 3 | Skenderija | winter plaza, snow, ice | skateboarder, figure skater (spin), popcorn vendor, snowball kid | Skating Coach |
| 4 | Marijin Dvor | glass towers at dusk, live wires | clerk (paper planes), scooter courier, security guard (shield), intern (homing paper) | Chief Executive |
| 5 | Grbavica | apartment blocks, tar | football fan (rolling balls), drummer (buffs allies), referee, goalkeeper | Touchline Coach |
| 6 | Malta | tram depot at night, sparking rails | ticket inspector, mechanic (oil-can bombs), cyclist, electrician (sniper) | Tram Driver |
| 7 | Čengić Vila | blocks and market stalls, puddles | granny with trolley (charge), water-balloon kid, chess player, florist (homing petals) | Chess Grandmaster |
| 8 | Hrasno | high-rise towers, paint spills | window cleaner (drops from above), painter, antenna installer (sniper), caretaker (shield) | Building Manager |
| 9 | Pofalići | green hills, thorns | hiker, beekeeper (bee swarms), apple picker, trail runner | Head Beekeeper |
| 10 | Ciglane | brick terraces, wet cement | bricklayer, plank carrier (spin), surveyor (sniper), scaffold worker (drop) | Master Builder |
| 11 | Koševo | stadium under floodlights, steeplechase water | sprinter, javelin thrower (sniper), shot putter (bombs), hammer thrower (spin) | Decathlete |
| 12 | Alipašino Polje | blocks at night, graffiti paint | street baller, block DJ (buffs allies), graffiti artist, breakdancer | Block MC |
| 13 | Dobrinja | airport, jet blast | baggage handler, flight attendant, ramp marshaller (sniper), drone pilot | Flight Captain (3 phases) |

Each stage has its own tileset (ground, platforms and hazard), parallax backdrop, 5 generated arenas, a boss arena and a composed chiptune with a faster boss variant.

**Difficulty curve:** `difficulty` in `stages.json` rises from 1.15 to 5.11. Enemy and boss health scale with it, damage at about a third of that rate, and attack frequency up to 1.7×. Wave sizes, enemies alive at once and spawn speed also grow per stage. Rewards grow too, so later stages need shop upgrades.

**Enemy behaviours** (from `enemies.json`): walker, charger, thrower, jumper, shooter, bomber, dasher, shielder (blocks frontal hits, so attack from behind or above), summoner (homing minions), sniper (shows an aim line first), roller, buffer (powers up nearby enemies), dropper (rappels down onto you), spinner.

**Boss attacks:** slam, shockwave, leap, charge, volley, rain (with ground warnings), summon, barrage, spiral, laser (telegraphed beam across the arena), teleport, zigzag dashes, trap (ground patches), roll, pull (vortex), meteor (homing explosive), shield (invulnerable while minions attack).

## Using your own music

You can give any stage a chiptune version of a real song if you have it as a **MIDI file (.mid)**:

```bash
node scripts/import-midi.mjs path/to/song.mid bistrik            # first 16 bars, looped
node scripts/import-midi.mjs path/to/song.mid bistrik --bars 32 --transpose -2
```

This writes `src/data/music/bistrik.json` and points that stage at it. The highest part becomes the lead, the lowest the bass, one more part the harmony, and General MIDI drums become chip drums. Audio files (MP3/WAV) can't be converted. Copyrighted songs are fine for private play but need a licence if the game is distributed. Traditional sevdalinke are public domain.

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
- **Edit arenas:** `scripts/build-layouts.mjs` contains Kovači's hand-made arenas and the generator for the other stages. It writes `layouts.json`, which you can also edit directly. Legend: `#` solid, `=` one-way, `H` ladder, `^` hazard, `S` enemy spawn, `B` boss spawn. A test checks that every platform and spawn point in every arena is reachable.
- **Edit campaign content:** `scripts/build-content.mjs` generates stages, enemies, bosses, themes, sprite recipes and names. You can also edit the JSON files directly.
- **Pooling:** enemies (64) and projectiles (320 player and 160 enemy) are Arcade groups reused through `get()`, `spawn()`/`fire()` and `kill()`.
- **Resolution:** internal 640×360 (16 px tiles), scaled to the window with nearest-neighbour filtering. That is exactly 3× at 1920×1080.

## Assumptions made

- **Sizes:** characters are about 22 px tall in 24×24 frames (about 1.4 tiles). Bosses are 2× size (48×48).
- **Level-ups:** a level-up offers 3 weapons, with new behaviors favoured and sometimes a tier upgrade of a part you already have. You pick one weapon and one buff per level-up. Each part caps at tier 3.
- **Locked arenas:** a wave is one camera-locked arena. Enemies spawn in sub-batches inside it, with a maximum number alive at once that rises from wave 1 to wave 5. Clearing an arena heals 10% HP.
- **KM:** only a boss kill pays KM. Defeat or quitting pays 0, never unlocks anything and only updates statistics.
- **English:** an optional English file is included. All UI text comes from the language files, and Bosnian is the default.
- **Content limits:** enemies are everyday roles (vendors, couriers, porters). There are no real people, logos, brands or war references, and no memorials or cemeteries are used as locations.
