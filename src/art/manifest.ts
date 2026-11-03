/**
 * Central asset manifest. Every texture the game uses is listed here.
 * Each entry is either generated from palette data at boot, or loaded from a
 * file. To swap in hand-drawn art, change an entry to
 *   { kind: 'image', url: 'assets/player_amar.png', frameWidth: 24, frameHeight: 24 }
 * keeping the same key and frame layout (see characters.ts ANIMS for frame order).
 */
import { Pix } from './pixel';
import { shade } from './palette';
import { bossFrames, humanoidFrames, FRAME } from './characters';
import { tilesetFrames, TS } from './tiles';
import { farLayer, midLayer, skyLayer } from './backgrounds';
import { WEAPON_ICONS, PROJECTILES, projectilePix, enemyProjectilePix } from './weaponsArt';
import { Rng } from '../core/rng';
import { cityMap } from './map';
import { hashString } from '../core/rng';
import type { CharacterRecipe, GameData } from '../core/types';
import sprites from '../data/sprites.json';

export type AssetEntry =
  | { kind: 'generated'; frameWidth: number; frameHeight: number; build: () => Pix[] }
  | { kind: 'image'; url: string; frameWidth?: number; frameHeight?: number };

function fx(): Record<string, AssetEntry> {
  const one = (w: number, h: number, draw: (p: Pix) => void): AssetEntry => ({
    kind: 'generated', frameWidth: w, frameHeight: h, build: () => { const p = new Pix(w, h); draw(p); return [p]; },
  });
  return {
    fx_px: one(2, 2, (p) => p.rect(0, 0, 2, 2, '#ffffff')),
    fx_dot: one(4, 4, (p) => { p.rect(1, 0, 2, 4, '#ffffff'); p.rect(0, 1, 4, 2, '#ffffff'); }),
    fx_puff: one(10, 10, (p) => { p.circle(5, 5, 4, '#ffffff'); p.circle(3, 4, 2, '#e8e8f0'); }),
    fx_ring: one(32, 32, (p) => { p.circle(16, 16, 15, '#ffffff'); p.circle(16, 16, 12, null as unknown as string); }),
    fx_swing: one(40, 40, (p) => {
      for (let a = -70; a <= 70; a += 2) {
        const r = (a * Math.PI) / 180;
        for (let d = 13; d <= 19; d++) p.set(20 + Math.cos(r) * d, 20 + Math.sin(r) * d, d > 17 ? '#c8d0e0' : '#ffffff');
      }
    }),
    fx_trap: one(28, 8, (p) => { p.rect(2, 3, 24, 5, '#ffffff'); p.rect(0, 5, 28, 3, '#ffffff'); for (let x = 2; x < 26; x += 5) { p.set(x, 2, '#ffffff'); p.set(x + 1, 1, '#ffffff'); } }),
    fx_star: one(7, 7, (p) => p.stamp(['...y...', '...y...', '.yyly..', 'yylllyy', '.yyly..', '...y...', '...y...'])),
    fx_shadow: one(12, 3, (p) => { p.rect(1, 0, 10, 3, '#000000'); p.rect(0, 1, 12, 1, '#000000'); }),
    ui_lock: one(9, 10, (p) => p.stamp(['..kkkkk..', '.kGGGGGk.', '.kGk.kGk.', '.kGk.kGk.', 'kkkkkkkkk', 'kyyyyyyyk', 'kyyykyyyk', 'kyyykyyyk', 'kyyyyyyyk', 'kkkkkkkkk'])),
    ui_check: one(9, 8, (p) => p.stamp(['.......kk', '......kek', '.....keEk', 'kk..keEk.', 'kek.keEk.', '.keEeEk..', '..keEk...', '...kk....'])),
    ui_coin: one(8, 8, (p) => p.stamp(['..kkkk..', '.kyyyyk.', 'kyylyyyk', 'kyykkyyk', 'kyykkyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'])),
    ui_heart: one(9, 8, (p) => p.stamp(['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'])),
    ui_arrow: one(12, 12, (p) => p.stamp(['....kk......', '....kyk.....', '....kyyk....', 'kkkkkyyyk...', 'kyyyyyyyyk..', 'kyyyyyyyyyk.', 'kyyyyyyyyk..', 'kkkkkyyyk...', '....kyyk....', '....kyk.....', '....kk......'])),
    fx_stun: one(15, 6, (p) => { for (const x of [2, 7, 12]) p.stamp(['.y.', 'yly', '.y.'], x - 1, x === 7 ? 0 : 2); }),
    fx_confetti: one(2, 4, (p) => p.rect(0, 0, 2, 4, '#ffffff')),
    fx_steam: steam(),
    fx_tram: one(80, 34, drawTram),
    ui_cursor: one(11, 11, (p) => p.stamp(['.....w.....', '.....w.....', '...........', '....kkk....', 'ww.kw.wk.ww', '....kkk....', '...........', '.....w.....', '.....w.....'], 0, 1)),
  };
}

/** Three frames of a rising steam column (16x56), drawn as soft cloud blobs. */
function steam(): AssetEntry {
  return {
    kind: 'generated', frameWidth: 16, frameHeight: 56,
    build: () => [0, 1, 2].map((f) => {
      const p = new Pix(16, 56);
      const rng = new Rng(77 + f * 13);
      for (let y = 54; y >= 2; y -= 3) {
        const spread = 2 + Math.round(((54 - y) / 52) * 5);
        const n = 2 + (y > 30 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const x = 8 + rng.int(-spread, spread) * (i % 2 ? 1 : -1) * 0.6;
          const r = 1 + rng.int(1, 2) + (y < 24 ? 1 : 0);
          p.circle(x, y + rng.int(-1, 1), r, rng.chance(0.3) ? '#d8dce8' : '#f4f4f4');
        }
      }
      for (let i = 0; i < 6; i++) p.set(rng.int(2, 13), rng.int(4, 50), '#ffffff');
      return p;
    }),
  };
}

/** A generic city tram, side view, facing right (super attack of the tram handle). */
function drawTram(p: Pix): void {
  const body = '#e8c23a', bodyD = '#b08a1e', red = '#c83a2a', cream = '#f0e2c4', glass = '#7ab8e0', glassD = '#3a6a9a';
  p.line(40, 0, 32, 5, '#4a4e5a'); p.line(40, 0, 48, 5, '#4a4e5a'); p.rect(30, 5, 20, 1, '#4a4e5a'); // pantograph
  p.rect(4, 6, 72, 3, cream); p.rect(6, 5, 68, 1, cream);
  p.rect(2, 9, 76, 16, body);
  p.rect(2, 22, 76, 3, red);
  p.rect(2, 9, 76, 1, shade(body, 0.3));
  for (let x = 8; x < 66; x += 12) { p.rect(x, 11, 9, 7, glass); p.rect(x, 11, 9, 1, '#ffffff'); p.rect(x + 8, 12, 1, 6, glassD); }
  p.rect(70, 11, 6, 8, glass); p.rect(70, 11, 6, 1, '#ffffff'); // driver's window
  p.rect(32, 19, 6, 6, bodyD); // door
  p.rect(76, 20, 3, 2, '#fff0a0'); // headlight
  p.rect(2, 25, 76, 2, '#2a2c34');
  for (const x of [10, 22, 56, 68]) { p.circle(x, 29, 3, '#2a2c34'); p.circle(x, 29, 1, '#8a8f9c'); }
  p.outline('#1a1420');
}

/** Straw training dummy on a post (tutorial). Same 14-frame layout as people. */
function dummyFrames(): Pix[] {
  const base = (tilt: number) => {
    const p = new Pix(FRAME, FRAME);
    p.rect(11, 17, 2, 6, '#8a5a2e'); p.rect(8, 22, 8, 2, '#5a3418');
    const sx = 8 + tilt;
    p.rect(sx, 6, 8, 11, '#d8b888'); p.rect(sx, 6, 8, 1, '#f0e2c4'); p.rect(sx, 10, 8, 1, '#9a8a5a'); p.rect(sx, 14, 8, 1, '#9a8a5a');
    p.rect(sx - 3, 9, 3, 2, '#d8b888'); p.rect(sx + 8, 9, 3, 2, '#d8b888');
    p.rect(sx + 1, 1, 6, 5, '#e8c890'); p.set(sx + 2, 3, '#1a1420'); p.set(sx + 5, 3, '#1a1420');
    p.rect(sx + 2, 5, 4, 1, '#c87a3a');
    p.circle(sx + 4, 12, 2, '#e8483a'); p.set(sx + 4, 12, '#f4f4f4');
    p.outline('#1a1420');
    return p;
  };
  const f: Pix[] = [];
  for (let i = 0; i < 10; i++) f.push(base(0));
  f.push(base(2));                                 // hurt: leans back
  f.push(base(3), base(3).shifted(0, 2), base(0).rotatedCW().shifted(0, 6)); // defeat
  return f;
}

export function buildManifest(data: GameData): Record<string, AssetEntry> {
  const m: Record<string, AssetEntry> = { ...fx() };
  m.enemy_dummy = { kind: 'generated', frameWidth: FRAME, frameHeight: FRAME, build: dummyFrames };
  const human = (r: CharacterRecipe): AssetEntry => ({ kind: 'generated', frameWidth: FRAME, frameHeight: FRAME, build: () => humanoidFrames(r) });
  for (const c of data.characters) m[c.sprite] = human(c.recipe);
  const recipes = sprites as Record<string, CharacterRecipe>;
  for (const e of Object.values(data.enemies)) if (recipes[e.sprite]) m[e.sprite] = human(recipes[e.sprite]);
  for (const b of Object.values(data.bosses)) {
    const r = recipes[b.sprite];
    if (!r) continue;
    const aura = b.color ?? '#ff7a2a';
    m[b.sprite] = {
      kind: 'generated', frameWidth: FRAME * 2, frameHeight: FRAME * 2,
      build: () => bossFrames(r, (p, i) => {
        if (i >= 11) return;
        if (b.id === 'kazandzija') {
          // Signature oversized copper hammer.
          const up = i === 8 || i === 6;
          const hx = up ? 30 : 34, hy = up ? 4 : 18;
          p.rect(hx, hy, 3, 20, '#8a5a2e');
          p.rect(hx - 4, hy - 2, 11, 7, '#c87a3a');
          p.rect(hx - 4, hy - 2, 11, 2, '#f0a860');
          p.rect(hx - 4, hy + 4, 11, 1, '#8a4a1e');
          p.outline('#1a1420');
        }
        // Every boss gets an aura outline in its colour so it reads as a boss.
        p.outline(aura);
      }),
    };
  }
  for (const [id, theme] of Object.entries(data.themes)) {
    const seed = hashString(id);
    m[`tiles_${id}`] = { kind: 'generated', frameWidth: TS, frameHeight: TS, build: () => tilesetFrames(theme, seed) };
    m[`bg_${id}_sky`] = { kind: 'generated', frameWidth: 640, frameHeight: 360, build: () => [skyLayer(theme, seed)] };
    m[`bg_${id}_far`] = { kind: 'generated', frameWidth: 640, frameHeight: 360, build: () => [farLayer(theme, seed + 1)] };
    m[`bg_${id}_mid`] = { kind: 'generated', frameWidth: 640, frameHeight: 360, build: () => [midLayer(theme, seed + 2)] };
  }
  for (const id of Object.keys(WEAPON_ICONS)) {
    m[`icon_${id}`] = { kind: 'generated', frameWidth: 16, frameHeight: 16, build: () => { const p = new Pix(16, 16); p.stamp(WEAPON_ICONS[id]); return [p]; } };
  }
  for (const id of Object.keys(PROJECTILES)) {
    const pix = projectilePix(id);
    m[`proj_${id}`] = { kind: 'generated', frameWidth: pix.w, frameHeight: pix.h, build: () => [projectilePix(id)] };
    m[`eproj_${id}`] = { kind: 'generated', frameWidth: pix.w + 4, frameHeight: pix.h + 4, build: () => [enemyProjectilePix(id)] };
  }
  m.ui_map = { kind: 'generated', frameWidth: 640, frameHeight: 360, build: () => [cityMap()] };
  return m;
}
