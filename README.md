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
npm run build:web && npm run features      # intro → tutorial, steam vents, stun, all 12 supers, creator, keyboard mode, ending
```

The Windows `.exe` packaging (`npm run dist:win`) is configured but is scheduled for milestone 4.

## Install on Windows / share with friends

Every push builds the game on GitHub (Actions → **Build game** → the latest run → *Artifacts*):

- **GameOfSarajevo-Windows**: `GameOfSarajevo-Setup-x.y.z.exe` installs the game with a desktop and Start-menu shortcut. `GameOfSarajevo-Portable-x.y.z.exe` runs without installing.
- **GameOfSarajevo-Web**: the browser version. Upload this zip to itch.io as an HTML game, and friends can play from a link.

The exe isn't code-signed, so Windows SmartScreen shows "Windows protected your PC". Click **More info → Run anyway**. Saves are stored in `%APPDATA%\Game of Sarajevo\save.json`.

To build locally on Windows instead, run `npm run dist:win`. The output goes in `release/`. To regenerate the icon, run `npm run build:web && node scripts/make-icon.mjs`.

## Controls (rebindable in Postavke / Settings)

| Action | Mouse mode (default) | Keyboard-only mode |
|---|---|---|
| Move | A / D | A / D |
| Jump / double jump | Space (hold for a higher jump) | Space |
| Dash (brief invulnerability) | Shift | Shift |
| Climb ladder | W / S | W / S |
| Drop through a wooden platform | S + Space | S + Space |
| Attack | aim with the mouse, hold left click | hold J: attacks the way you face; W tilts up, S (in the air) tilts down |
| Super ability | Q | K |
| Menus | mouse | arrow keys (or WASD) + Enter |
| Pause | Esc | Esc |
| Toggle fullscreen | F11 (desktop app), or Settings | |

Switch modes in **Postavke → Nišanjenje** (Settings → Aiming). Switching moves attack and super between the mouse and J/K. Menus also work with the arrow keys and Enter in mouse mode.

## Story, tutorial and ending

- **First launch** plays the intro cutscene: thirteen self-appointed bosses have taken over the neighbourhoods, and you set out to beat them all and make Sarajevo a *Šeher* again. The tutorial follows.
- **Tutorial** (*Vodič* on the menu, replayable): a short course covering moving, jumping, double jump, dash, ladders, dropping through platforms, attacking training dummies and steam grates. Gates open as you show each skill. It ends with cards on levels and weapons, the super ability, waves and bosses, and KM and the shop.
- **Ending:** beating the Dobrinja boss for the first time plays the ending. Dawn breaks over the city, all 13 bosses celebrate, confetti and fireworks fall, and the title *SARAJEVO JE PONOVO ŠEHER!* appears. *Priča* replays the intro, and *Kraj priče* (once earned) replays the ending. Enter or click moves on, Esc skips.

## Your own character

*Lik* (Character) offers the six preset Sarajevans plus a creator. You choose a name (up to 12 letters, Bosnian letters supported), skin, hairstyle, hair colour, shirt and trousers. *Nasumično* randomises everything. The name appears in the HUD and in the story.

## Hazards: sewer grates

Every stage has sewer grates in shallow dips. You can stand on them, but every few seconds a grate glows and hisses, then bursts steam for about a second. The steam hurts you (by the stage's hazard damage) and **enemies too**: 25% of an enemy's health per hit, 3% for bosses. Luring enemies onto a grate is a valid tactic.

## Super abilities

Once per stage, at the level-3 level-up, you pick **one of three random super abilities**, each belonging to a different weapon. It starts charged, refills from kills (14) and boss damage (1 per 4% of boss health), and fires with Q (K in keyboard mode). Supers scale with stage difficulty.

| Weapon | Super |
|---|---|
| Tram handle | a tram rushes through the arena |
| Ćevapi | three rings of skewers |
| Džezva | hot-coffee fountain |
| Fildžan | eight boomerang cups |
| Umbrella | 5 s invulnerable with big umbrellas orbiting you |
| Tepsija | earthquake: hits and stuns everything on screen |
| Pigeon | 14 homing pigeons |
| Bell | three huge sound rings that also clear projectiles |
| Burek | two giant bouncing bureks |
| Lokum | sugar cloud: heavy slow on screen |
| Lantern | fireworks over every enemy, plus burning |
| Sudžuk | lightning that jumps across the screen |

**Tepsija's normal attack stuns** enemies it hits (0.9 s, +0.3 s per tier, with stars over their heads). Bosses get a third of that and can't be stunned again for 3 s, so they can't be locked down.

**Enemy projectiles** fly at 72% of their old speed along the same paths: gravity is scaled with them, so arcs still land where they were aimed. They are drawn 4 px larger with a dark outline and a red rim, so they stand out from your own shots.

## Campaign

| # | Stage | Look | Enemies | Boss |
|---|---|---|---|---|
| 1 | Kovači | old town, cobbles | souvenir seller, pigeon feeder, delivery runner, crate porter | Master Coppersmith |
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

Each stage has its own tileset (ground, platforms, sewer grates), parallax backdrop, 5 generated arenas, a boss arena and a composed chiptune with a faster boss variant.

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
- **Grates everywhere:** the request was to replace the fire pits with steam sewers. All 13 stages now use sewer grates instead of their old static hazards (coals, thorns, paint, …), because a pit that just hurts on contact was the problem in every stage. The old styles remain in `themes.json` (`hazardStyle`) if a stage should get one back.
- **Super timing:** offered at level 3 (the second level-up), so even short early stages get one.
- **Content limits:** enemies are everyday roles (vendors, couriers, porters). There are no real people, logos, brands or war references, and no memorials or cemeteries are used as locations.
