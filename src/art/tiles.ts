import { Pix } from './pixel';
import { shade, mix } from './palette';
import { Rng } from '../core/rng';
import type { ThemeDef } from '../core/types';

/** Tile indices in every generated tileset. */
export const TILE = { TOP: 0, FILL: 1, FILL2: 2, PLATFORM: 3, LADDER: 4, HAZARD_A: 5, HAZARD_B: 6, GATE: 7, DECO: 8 } as const;
export const TILE_COUNT = 9;
export const TS = 16;

export function tilesetFrames(theme: ThemeDef, seed: number): Pix[] {
  const rng = new Rng(seed);
  const frames: Pix[] = [];
  const cobble = (p: Pix, base: string, dark: string, light: string) => {
    p.rect(0, 0, TS, TS, base);
    // irregular stones
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      let x = (row % 2) * -3;
      while (x < TS) {
        const w = rng.int(4, 6);
        p.rect(x + 1, y + 1, w - 1, 2, shade(base, rng.next() * 0.12 - 0.06));
        p.set(x + 1, y + 1, light);
        p.rect(x, y, 1, 4, dark);
        x += w;
      }
      p.rect(0, y, TS, 1, dark);
    }
  };
  // TOP: cobblestone street surface with a light curb
  const top = new Pix(TS, TS);
  cobble(top, theme.ground, theme.groundDark, shade(theme.ground, 0.25));
  top.rect(0, 0, TS, 3, theme.groundTop);
  top.rect(0, 0, TS, 1, shade(theme.groundTop, 0.35));
  top.rect(0, 3, TS, 1, theme.groundDark);
  for (let x = 0; x < TS; x += 4) top.set(x + rng.int(0, 2), 1, shade(theme.groundTop, -0.15));
  frames.push(top);
  // FILL / FILL2
  for (let v = 0; v < 2; v++) {
    const f = new Pix(TS, TS);
    cobble(f, v ? shade(theme.ground, -0.1) : theme.ground, theme.groundDark, shade(theme.ground, 0.18));
    frames.push(f);
  }
  // PLATFORM: wooden plank (one-way)
  const pl = new Pix(TS, TS);
  pl.rect(0, 0, TS, 5, theme.platform);
  pl.rect(0, 0, TS, 1, shade(theme.platform, 0.3));
  pl.rect(0, 4, TS, 1, theme.platformDark);
  pl.set(4, 2, theme.platformDark); pl.set(11, 2, theme.platformDark);
  pl.rect(2, 5, 2, 3, theme.platformDark); pl.rect(12, 5, 2, 3, theme.platformDark);
  frames.push(pl);
  // LADDER
  const ld = new Pix(TS, TS);
  const wood = mix(theme.platform, '#d8b888', 0.3);
  ld.rect(3, 0, 2, TS, wood); ld.rect(11, 0, 2, TS, wood);
  ld.rect(3, 0, 1, TS, shade(wood, 0.25)); ld.rect(11, 0, 1, TS, shade(wood, 0.25));
  for (const y of [2, 7, 12]) { ld.rect(5, y, 6, 2, shade(wood, -0.1)); ld.rect(5, y + 1, 6, 1, theme.platformDark); }
  frames.push(ld);
  // HAZARD A/B (glowing grill coals in a pit)
  for (let v = 0; v < 2; v++) {
    const h = new Pix(TS, TS);
    h.rect(0, 6, TS, 10, '#3a2a2a');
    for (let i = 0; i < 14; i++) {
      const x = rng.int(0, TS - 2), y = rng.int(8, 14);
      h.rect(x, y, 2, 2, rng.chance(0.5) ? '#ff7a2a' : '#d83a3a');
    }
    for (let x = 1; x < TS; x += 3) {
      const fh = ((x + v * 2) % 5) + 2;
      h.rect(x, 8 - fh, 1, fh, v ? '#f2d64b' : '#ff9a3a');
      h.set(x, 8 - fh - 1, '#fff0a0');
    }
    h.rect(0, 5, TS, 1, '#6a6a72'); // grill rack
    for (let x = 0; x < TS; x += 3) h.rect(x, 5, 1, 3, '#6a6a72');
    frames.push(h);
  }
  // GATE: barrier shown while a wave is locked
  const g = new Pix(TS, TS);
  g.rect(5, 0, 6, TS, '#d83a3a');
  for (let y = 0; y < TS; y += 8) g.rect(5, y, 6, 4, '#f4f4f4');
  g.rect(5, 0, 1, TS, '#8a2028'); g.rect(10, 0, 1, TS, '#8a2028');
  frames.push(g);
  // DECO: background wall (non-colliding)
  const d = new Pix(TS, TS);
  d.rect(0, 0, TS, TS, shade(theme.mid, -0.35));
  for (let y = 0; y < TS; y += 4) d.rect(0, y, TS, 1, shade(theme.mid, -0.45));
  frames.push(d);
  return frames;
}
