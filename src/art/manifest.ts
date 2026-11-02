/**
 * Central asset manifest. Every texture the game uses is listed here.
 * Each entry is either generated from palette data at boot, or loaded from a
 * file. To swap in hand-drawn art, change an entry to
 *   { kind: 'image', url: 'assets/player_amar.png', frameWidth: 24, frameHeight: 24 }
 * keeping the same key and frame layout (see characters.ts ANIMS for frame order).
 */
import { Pix } from './pixel';
import { bossFrames, humanoidFrames, FRAME } from './characters';
import { tilesetFrames, TS } from './tiles';
import { farLayer, midLayer, skyLayer } from './backgrounds';
import { WEAPON_ICONS, PROJECTILES, projectilePix } from './weaponsArt';
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
    fx_star: one(7, 7, (p) => p.stamp(['...y...', '...y...', '.yyly..', 'yylllyy', '.yyly..', '...y...', '...y...'])),
    fx_shadow: one(12, 3, (p) => { p.rect(1, 0, 10, 3, '#000000'); p.rect(0, 1, 12, 1, '#000000'); }),
    ui_lock: one(9, 10, (p) => p.stamp(['..kkkkk..', '.kGGGGGk.', '.kGk.kGk.', '.kGk.kGk.', 'kkkkkkkkk', 'kyyyyyyyk', 'kyyykyyyk', 'kyyykyyyk', 'kyyyyyyyk', 'kkkkkkkkk'])),
    ui_check: one(9, 8, (p) => p.stamp(['.......kk', '......kek', '.....keEk', 'kk..keEk.', 'kek.keEk.', '.keEeEk..', '..keEk...', '...kk....'])),
    ui_coin: one(8, 8, (p) => p.stamp(['..kkkk..', '.kyyyyk.', 'kyylyyyk', 'kyykkyyk', 'kyykkyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'])),
    ui_heart: one(9, 8, (p) => p.stamp(['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'])),
    ui_arrow: one(12, 12, (p) => p.stamp(['....kk......', '....kyk.....', '....kyyk....', 'kkkkkyyyk...', 'kyyyyyyyyk..', 'kyyyyyyyyyk.', 'kyyyyyyyyk..', 'kkkkkyyyk...', '....kyyk....', '....kyk.....', '....kk......'])),
    ui_cursor: one(11, 11, (p) => p.stamp(['.....w.....', '.....w.....', '...........', '....kkk....', 'ww.kw.wk.ww', '....kkk....', '...........', '.....w.....', '.....w.....'], 0, 1)),
  };
}

export function buildManifest(data: GameData): Record<string, AssetEntry> {
  const m: Record<string, AssetEntry> = { ...fx() };
  const human = (r: CharacterRecipe): AssetEntry => ({ kind: 'generated', frameWidth: FRAME, frameHeight: FRAME, build: () => humanoidFrames(r) });
  for (const c of data.characters) m[c.sprite] = human(c.recipe);
  const recipes = sprites as Record<string, CharacterRecipe>;
  for (const e of Object.values(data.enemies)) if (recipes[e.sprite]) m[e.sprite] = human(recipes[e.sprite]);
  for (const b of Object.values(data.bosses)) {
    const r = recipes[b.sprite];
    if (!r) continue;
    m[b.sprite] = {
      kind: 'generated', frameWidth: FRAME * 2, frameHeight: FRAME * 2,
      build: () => bossFrames(r, (p, i) => {
        // Boss signature: a big copper hammer and a heavy moustache.
        if (i >= 11) return;
        const up = i === 8 || i === 6;
        const hx = up ? 30 : 34, hy = up ? 4 : 18;
        p.rect(hx, hy, 3, 20, '#8a5a2e');
        p.rect(hx - 4, hy - 2, 11, 7, '#c87a3a');
        p.rect(hx - 4, hy - 2, 11, 2, '#f0a860');
        p.rect(hx - 4, hy + 4, 11, 1, '#8a4a1e');
        p.outline('#1a1420');
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
  }
  m.ui_map = { kind: 'generated', frameWidth: 640, frameHeight: 360, build: () => [cityMap()] };
  return m;
}
