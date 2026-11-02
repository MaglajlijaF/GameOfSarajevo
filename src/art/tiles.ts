import { Pix } from './pixel';
import { shade, mix } from './palette';
import { Rng } from '../core/rng';
import type { ThemeDef } from '../core/types';

/** Tile indices in every generated tileset. */
export const TILE = { TOP: 0, FILL: 1, FILL2: 2, PLATFORM: 3, LADDER: 4, HAZARD_A: 5, HAZARD_B: 6, GATE: 7, DECO: 8 } as const;
export const TILE_COUNT = 9;
export const TS = 16;

type Surface = (p: Pix, base: string, dark: string, light: string, rng: Rng, variant: number) => void;

/** Ground fill patterns, one per neighbourhood material. */
const SURFACES: Record<string, Surface> = {
  cobble(p, base, dark, light, rng) {
    p.rect(0, 0, TS, TS, base);
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
  },
  stone(p, base, dark, light, rng) {
    p.rect(0, 0, TS, TS, base);
    for (let i = 0; i < 3; i++) {
      const x = rng.int(0, 10), y = rng.int(0, 10), w = rng.int(5, 8), h = rng.int(4, 6);
      p.rect(x, y, w, h, shade(base, rng.next() * 0.15 - 0.07));
      p.rect(x, y, w, 1, light); p.rect(x, y + h - 1, w, 1, dark);
    }
  },
  concrete(p, base, dark, light, rng) {
    p.rect(0, 0, TS, TS, base);
    p.rect(0, 0, TS, 1, dark); p.rect(0, 0, 1, TS, dark);
    for (let i = 0; i < 6; i++) p.set(rng.int(1, 15), rng.int(1, 15), rng.chance(0.5) ? dark : light);
  },
  asphalt(p, base, dark, light, rng) {
    p.rect(0, 0, TS, TS, base);
    for (let i = 0; i < 14; i++) p.set(rng.int(0, 15), rng.int(0, 15), rng.chance(0.5) ? dark : light);
  },
  grass(p, base, dark, light, rng) {
    p.rect(0, 0, TS, TS, base);
    for (let i = 0; i < 6; i++) { const x = rng.int(0, 13), y = rng.int(1, 13); p.rect(x, y, 3, 2, shade(base, 0.15)); p.set(x, y + 2, dark); }
    for (let i = 0; i < 3; i++) p.set(rng.int(0, 15), rng.int(0, 15), light);
  },
  brick(p, base, dark, light, _rng, variant) {
    p.rect(0, 0, TS, TS, base);
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      p.rect(0, y + 3, TS, 1, light);
      const off = (row + variant) % 2 ? 0 : 4;
      for (let x = off; x < TS; x += 8) p.rect(x, y, 1, 3, light);
      p.rect(0, y, TS, 1, shade(base, 0.08));
      p.rect(0, y + 2, TS, 1, dark);
    }
  },
  ice(p, base, dark, light, rng) {
    p.rect(0, 0, TS, TS, base);
    for (let i = 0; i < 3; i++) { const x = rng.int(0, 10); p.line(x, rng.int(2, 14), x + rng.int(3, 6), rng.int(2, 14), light); }
    p.rect(0, 15, TS, 1, dark);
  },
  track(p, base, dark, light) {
    p.rect(0, 0, TS, TS, base);
    p.rect(0, 7, TS, 1, light);
    for (let x = 0; x < TS; x += 2) p.set(x, 12, dark);
  },
  tarmac(p, base, dark, light, rng, variant) {
    p.rect(0, 0, TS, TS, base);
    for (let i = 0; i < 8; i++) p.set(rng.int(0, 15), rng.int(0, 15), dark);
    if (variant === 0) p.rect(0, 6, 8, 2, light);
  },
};

function platformTile(theme: ThemeDef): Pix {
  const pl = new Pix(TS, TS);
  const c = theme.platform, d = theme.platformDark;
  switch (theme.platformStyle ?? 'wood') {
    case 'metal':
      pl.rect(0, 0, TS, 4, c); pl.rect(0, 0, TS, 1, shade(c, 0.35)); pl.rect(0, 3, TS, 1, d);
      for (let x = 1; x < TS; x += 4) pl.set(x, 1, d);
      pl.line(1, 4, 6, 9, d); pl.line(14, 4, 9, 9, d);
      break;
    case 'concrete':
      pl.rect(0, 0, TS, 6, c); pl.rect(0, 0, TS, 1, shade(c, 0.3)); pl.rect(0, 5, TS, 1, d);
      pl.set(5, 3, d); pl.set(11, 2, d);
      break;
    case 'awning':
      for (let x = 0; x < TS; x++) pl.rect(x, 0, 1, 4, Math.floor(x / 4) % 2 ? c : '#f4f4f4');
      for (let x = 0; x < TS; x += 4) pl.rect(x, 4, 2, 2, Math.floor(x / 4) % 2 ? d : '#c8c8c8');
      break;
    case 'brick':
      pl.rect(0, 0, TS, 6, c); pl.rect(0, 0, TS, 1, shade(c, 0.3));
      pl.rect(0, 3, TS, 1, d); pl.rect(4, 0, 1, 3, d); pl.rect(12, 0, 1, 3, d); pl.rect(8, 3, 1, 3, d); pl.rect(0, 5, TS, 1, d);
      break;
    default:
      pl.rect(0, 0, TS, 5, c); pl.rect(0, 0, TS, 1, shade(c, 0.3)); pl.rect(0, 4, TS, 1, d);
      pl.set(4, 2, d); pl.set(11, 2, d);
      pl.rect(2, 5, 2, 3, d); pl.rect(12, 5, 2, 3, d);
  }
  return pl;
}

/** Two animation frames of the stage hazard (non-solid, damages on contact). */
function hazardTile(style: string, v: number, rng: Rng, accent: string): Pix {
  const h = new Pix(TS, TS);
  const flames = (c1: string, c2: string, tip: string) => {
    for (let x = 1; x < TS; x += 3) { const fh = ((x + v * 2) % 5) + 2; h.rect(x, 8 - fh, 1, fh, v ? c1 : c2); h.set(x, 8 - fh - 1, tip); }
  };
  switch (style) {
    case 'water':
      h.rect(0, 5, TS, 11, '#2a6ab8'); h.rect(0, 5, TS, 2, '#7ac0f0');
      for (let x = (v * 3) % 6; x < TS; x += 6) h.rect(x, 5, 3, 1, '#ffffff');
      break;
    case 'ice':
      h.rect(0, 4, TS, 12, '#9ad0f0');
      for (let x = 0; x < TS; x += 4) { h.line(x, 4, x + 2, 0 + v, '#e8f8ff'); h.set(x + 1, 3, '#ffffff'); }
      break;
    case 'sparks':
      h.rect(0, 10, TS, 6, '#3a3a40'); h.rect(0, 10, TS, 1, '#8a8a92');
      for (let i = 0; i < 6; i++) { const x = rng.int(0, 15), y = rng.int(2, 9); h.set(x, y, v ? '#fff0a0' : '#7ad0f0'); h.set(x + 1, y - 1, '#ffffff'); }
      h.line(0, 9 - v, 15, 7 + v, '#f2d64b');
      break;
    case 'thorns':
      h.rect(0, 9, TS, 7, '#2a5a2a');
      for (let x = 0; x < TS; x += 3) { h.line(x, 9, x + 1, 3 + ((x + v) % 3), '#3a7a3a'); h.set(x + 1, 3 + ((x + v) % 3), '#c0c4cc'); }
      for (let x = 2; x < TS; x += 5) h.set(x, 6, accent);
      break;
    case 'cement':
      h.rect(0, 6, TS, 10, '#9a9a96'); h.rect(0, 6, TS, 1, '#c8c8c0');
      for (let i = 0; i < 4; i++) h.circle(rng.int(2, 13), 9 + v, 1, '#7a7a76');
      break;
    case 'paint':
      h.rect(0, 7, TS, 9, accent); h.rect(0, 7, TS, 1, shade(accent, 0.4));
      for (let x = (v * 2) % 5; x < TS; x += 5) h.circle(x, 6, 1, accent);
      break;
    case 'tar':
      h.rect(0, 6, TS, 10, '#1a1a1e'); h.rect(0, 6, TS, 1, '#3a3a40');
      for (let i = 0; i < 3; i++) h.circle(rng.int(2, 13), 8 + v, 1, '#4a4a52');
      break;
    case 'jet':
      h.rect(0, 12, TS, 4, '#3a3c40');
      flames('#7ad0f0', '#ffffff', '#c8f0ff');
      break;
    default: // coals
      h.rect(0, 6, TS, 10, '#3a2a2a');
      for (let i = 0; i < 14; i++) { const x = rng.int(0, TS - 2), y = rng.int(8, 14); h.rect(x, y, 2, 2, rng.chance(0.5) ? '#ff7a2a' : '#d83a3a'); }
      flames('#f2d64b', '#ff9a3a', '#fff0a0');
      h.rect(0, 5, TS, 1, '#6a6a72');
      for (let x = 0; x < TS; x += 3) h.rect(x, 5, 1, 3, '#6a6a72');
  }
  return h;
}

export function tilesetFrames(theme: ThemeDef, seed: number): Pix[] {
  const rng = new Rng(seed);
  const frames: Pix[] = [];
  const surf = SURFACES[theme.groundStyle ?? 'cobble'] ?? SURFACES.cobble;
  const light = shade(theme.ground, 0.22);
  // TOP: material with a lighter walking surface
  const top = new Pix(TS, TS);
  surf(top, theme.ground, theme.groundDark, light, rng, 0);
  const topH = theme.groundStyle === 'grass' ? 4 : 3;
  top.rect(0, 0, TS, topH, theme.groundTop);
  top.rect(0, 0, TS, 1, shade(theme.groundTop, 0.35));
  top.rect(0, topH, TS, 1, theme.groundDark);
  if (theme.groundStyle === 'grass') for (let x = 0; x < TS; x += 2) top.set(x, topH + 1, theme.groundTop);
  if (theme.snow) { top.rect(0, 0, TS, 2, '#ffffff'); top.set(rng.int(0, 15), 2, '#ffffff'); }
  for (let x = 0; x < TS; x += 4) top.set(x + rng.int(0, 2), 1, shade(theme.groundTop, -0.15));
  frames.push(top);
  for (let v = 0; v < 2; v++) {
    const f = new Pix(TS, TS);
    surf(f, v ? shade(theme.ground, -0.1) : theme.ground, theme.groundDark, light, rng, v + 1);
    frames.push(f);
  }
  const pl = platformTile(theme);
  if (theme.snow) pl.rect(0, 0, TS, 1, '#ffffff');
  frames.push(pl);
  // LADDER
  const ld = new Pix(TS, TS);
  const wood = theme.platformStyle === 'metal' ? '#9aa2b0' : mix(theme.platform, '#d8b888', 0.3);
  ld.rect(3, 0, 2, TS, wood); ld.rect(11, 0, 2, TS, wood);
  ld.rect(3, 0, 1, TS, shade(wood, 0.25)); ld.rect(11, 0, 1, TS, shade(wood, 0.25));
  for (const y of [2, 7, 12]) { ld.rect(5, y, 6, 2, shade(wood, -0.1)); ld.rect(5, y + 1, 6, 1, shade(wood, -0.35)); }
  frames.push(ld);
  const accent = theme.accent ?? '#e8483a';
  frames.push(hazardTile(theme.hazardStyle, 0, rng, accent), hazardTile(theme.hazardStyle, 1, rng, accent));
  // GATE
  const g = new Pix(TS, TS);
  g.rect(5, 0, 6, TS, '#d83a3a');
  for (let y = 0; y < TS; y += 8) g.rect(5, y, 6, 4, '#f4f4f4');
  g.rect(5, 0, 1, TS, '#8a2028'); g.rect(10, 0, 1, TS, '#8a2028');
  frames.push(g);
  // DECO
  const d = new Pix(TS, TS);
  d.rect(0, 0, TS, TS, shade(theme.mid, -0.35));
  for (let y = 0; y < TS; y += 4) d.rect(0, y, TS, 1, shade(theme.mid, -0.45));
  frames.push(d);
  return frames;
}
