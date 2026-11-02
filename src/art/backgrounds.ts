import { Pix } from './pixel';
import { mix, shade } from './palette';
import { Rng } from '../core/rng';
import type { ThemeDef } from '../core/types';

export const BG_W = 640;
export const BG_H = 360;
const GROUND = 300;

/** Draws a rect wrapping horizontally so layers tile seamlessly. */
function wrapRect(p: Pix, x: number, y: number, w: number, h: number, c: string) {
  for (let i = 0; i < w; i++) p.rect((((Math.round(x) + i) % p.w) + p.w) % p.w, Math.round(y), 1, Math.round(h), c);
}

function windowColor(t: ThemeDef, rng: Rng): string {
  if (t.night) return rng.chance(0.55) ? '#f8d870' : '#2a3040';
  return rng.chance(0.15) ? '#8ab8d8' : '#3a5a7a';
}

export function skyLayer(t: ThemeDef, seed: number): Pix {
  const p = new Pix(BG_W, BG_H);
  const rng = new Rng(seed);
  const bands = 24;
  for (let i = 0; i < bands; i++) p.rect(0, Math.floor((i * BG_H) / bands), BG_W, Math.ceil(BG_H / bands) + 1, mix(t.sky[0], t.sky[1], i / (bands - 1)));
  if (t.night) {
    for (let i = 0; i < 140; i++) p.set(rng.int(0, BG_W - 1), rng.int(0, 200), rng.chance(0.2) ? '#ffffff' : '#b8c0e0');
    p.circle(120, 60, 14, '#f4f0d8'); p.circle(126, 56, 12, mix(t.sky[0], t.sky[1], 0.15));
  } else {
    const sunY = t.sky[0].toLowerCase() > '#d' ? 150 : 70; // warm skies get a low sun
    p.circle(500, sunY, sunY > 100 ? 26 : 18, mix(t.sky[1], '#fff6c0', 0.6));
    p.circle(500, sunY, sunY > 100 ? 21 : 14, '#fff6d8');
    for (let i = 0; i < 7; i++) {
      const cx = rng.int(0, BG_W), cy = rng.int(20, 120), w = rng.int(30, 70);
      const cloud = t.snow ? '#e8eef4' : '#ffffff';
      for (let k = 0; k < 4; k++) wrapRect(p, cx + k * (w / 5), cy - (k % 2) * 4, Math.round(w / 2), 8 + (k % 2) * 4, cloud);
      wrapRect(p, cx, cy + 8, w, 3, shade(cloud, -0.08));
    }
  }
  if (t.snow) for (let i = 0; i < 220; i++) p.set(rng.int(0, BG_W - 1), rng.int(0, BG_H - 1), '#ffffff');
  return p;
}

/** Hills around the valley with small houses on the slopes (Sarajevo sits in a valley). */
export function farLayer(t: ThemeDef, seed: number): Pix {
  const p = new Pix(BG_W, BG_H);
  const rng = new Rng(seed);
  const heights: number[] = [];
  const ph = rng.next() * 6;
  for (let x = 0; x < BG_W; x++) {
    const k = (x / BG_W) * Math.PI * 2;
    heights.push(150 + Math.sin(k * 2 + ph) * 28 + Math.sin(k * 5 + ph * 2) * 10 + Math.sin(k * 11) * 4);
  }
  for (let x = 0; x < BG_W; x++) {
    const h = Math.round(heights[x]);
    p.rect(x, h, 1, BG_H - h, t.far);
    p.set(x, h, t.snow ? '#ffffff' : shade(t.far, 0.2));
    if (t.snow) p.rect(x, h, 1, 3, '#f0f4f8');
  }
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, BG_W - 1);
    const y = Math.round(heights[x]) + rng.int(4, 60);
    if (y > BG_H - 8) continue;
    p.rect(x, y, 4, 3, t.night ? (rng.chance(0.5) ? '#f8d870' : '#3a3a4a') : rng.chance(0.7) ? '#f0ead8' : '#e0c8a0');
    p.rect(x, y - 1, 4, 1, t.snow ? '#ffffff' : t.roof);
  }
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, BG_W - 1);
    p.rect(x, Math.round(heights[x]) + rng.int(2, 80), 2, 2, t.farDetail);
  }
  return p;
}

type Backdrop = (p: Pix, t: ThemeDef, rng: Rng) => void;

function tree(p: Pix, x: number, t: ThemeDef, rng: Rng, base = GROUND) {
  p.rect(x - 1, base - 30, 3, 30, '#5a3a22');
  const leaf = t.snow ? '#e8eef4' : shade(t.far, -0.1);
  p.circle(x, base - 40, 13, leaf);
  p.circle(x - 6, base - 34, 9, t.snow ? '#ffffff' : t.far);
  p.circle(x + 7, base - 36, 8, t.snow ? '#d8e0e8' : shade(t.far, 0.1));
  if (!t.snow && rng.chance(0.3)) for (let i = 0; i < 5; i++) p.set(x + rng.int(-10, 10), base - rng.int(30, 50), t.accent ?? '#e85a8a');
}

function windowsGrid(p: Pix, x: number, top: number, w: number, h: number, t: ThemeDef, rng: Rng, cw = 6, ch = 7, gx = 10, gy = 12) {
  for (let wy = top + 6; wy < top + h - ch - 2; wy += gy) for (let wx = x + 5; wx < x + w - cw - 2; wx += gx) wrapRect(p, wx, wy, cw, ch, windowColor(t, rng));
}

/** Low old-town houses: tiled roofs, wooden beams, bay windows, shop awnings. */
const oldtown: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    const w = rng.int(40, 70);
    if (rng.chance(0.18)) { tree(p, x + w / 2, t, rng); x += w; continue; }
    const floors = rng.int(1, 3);
    const h = 26 + floors * 22, top = GROUND - h;
    const wall = rng.chance(0.75) ? t.mid : shade(t.mid, -0.12);
    wrapRect(p, x, top, w, h, wall);
    wrapRect(p, x, top, 2, h, shade(wall, -0.15));
    for (let f = 1; f <= floors; f++) wrapRect(p, x, top + f * 22, w, 2, t.midDetail);
    for (let r = 0; r < 12; r++) wrapRect(p, x - 4 + Math.floor(r / 1.5), top - 12 + r, w + 8 - Math.floor(r / 1.5) * 2, 1, r % 3 === 0 ? shade(t.roof, -0.2) : t.roof);
    if (rng.chance(0.6)) wrapRect(p, x + w - 14, top - 20, 5, 10, shade(t.roof, -0.35));
    for (let f = 0; f < floors; f++) for (let wx = x + 7; wx < x + w - 8; wx += 12) {
      const wy = top + 6 + f * 22;
      wrapRect(p, wx, wy, 6, 8, windowColor(t, rng)); wrapRect(p, wx, wy, 6, 1, t.midDetail); wrapRect(p, wx + 2, wy, 1, 8, t.midDetail);
    }
    if (floors >= 2 && rng.chance(0.5)) { const bx = x + Math.round(w / 2) - 8; wrapRect(p, bx, top + 4, 16, 14, t.midDetail); wrapRect(p, bx + 2, top + 6, 12, 8, '#4a7090'); }
    const awn = rng.pick(['#d83a3a', '#3a8ad8', '#e0a23a', '#4aa04a']);
    for (let i = 0; i < w - 4; i++) wrapRect(p, x + 2 + i, GROUND - 22, 1, 4, Math.floor(i / 4) % 2 ? awn : '#f4f4f4');
    wrapRect(p, x + 6, GROUND - 16, 10, 16, shade(t.midDetail, -0.2));
    x += w + rng.int(0, 6);
  }
};

/** Houses stacked up a steep slope with stone walls and stairways (Bistrik, Pofalići). */
const hillside: Backdrop = (p, t, rng) => {
  for (let x = 0; x < BG_W; x++) {
    const h = GROUND - 110 + Math.round(Math.sin((x / BG_W) * Math.PI * 4) * 30);
    p.rect(x, h, 1, GROUND - h, shade(t.far, 0.05));
  }
  for (let row = 0; row < 3; row++) {
    const base = GROUND - row * 42;
    let x = rng.int(0, 30);
    // retaining wall
    if (row > 0) for (let i = 0; i < BG_W; i++) p.rect(i, base, 1, 6, (Math.floor(i / 6) + (row % 2)) % 2 ? shade(t.groundTop, -0.1) : shade(t.groundTop, -0.2));
    while (x < BG_W) {
      const w = rng.int(24, 40);
      if (rng.chance(0.25)) { tree(p, x + w / 2, t, rng, base); x += w; continue; }
      const h = rng.int(24, 40), top = base - h;
      const wall = shade(t.mid, -0.05 * row);
      wrapRect(p, x, top, w, h, wall);
      for (let r = 0; r < 9; r++) wrapRect(p, x - 3 + Math.floor(r / 1.5), top - 9 + r, w + 6 - Math.floor(r / 1.5) * 2, 1, r % 3 === 0 ? shade(t.roof, -0.2) : t.roof);
      windowsGrid(p, x, top, w, h, t, rng, 4, 6, 9, 12);
      x += w + rng.int(6, 20);
    }
    // stairway
    const sx = rng.int(40, BG_W - 60);
    for (let s = 0; s < 8; s++) wrapRect(p, sx + s * 4, base - s * 5, 10, 5, shade(t.groundTop, -0.05));
  }
};

/** Low concrete event hall with angled roof, plaza lamps and bare trees (Skenderija). */
const plaza: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    const w = rng.int(110, 170), h = rng.int(50, 80), top = GROUND - h;
    wrapRect(p, x, top, w, h, t.mid);
    for (let i = 0; i < 22; i++) wrapRect(p, x + i * 2, top - 22 + i, w - i * 4, 1, i % 2 ? t.roof : shade(t.roof, -0.15));
    if (t.snow) wrapRect(p, x + 2, top - 23, w - 4, 2, '#ffffff');
    wrapRect(p, x + 8, top + 12, w - 16, 10, t.night ? '#f8d870' : '#4a6a8a');
    for (let gx = x + 10; gx < x + w - 10; gx += 14) wrapRect(p, gx, top + 12, 1, 10, t.midDetail);
    wrapRect(p, x + w / 2 - 8, GROUND - 20, 16, 20, shade(t.midDetail, -0.2));
    x += w + 20;
    for (let k = 0; k < 2; k++) {
      const lx = x - 14 + k * 8;
      wrapRect(p, lx, GROUND - 40, 2, 40, '#4a4e5a'); wrapRect(p, lx - 2, GROUND - 42, 6, 3, '#fff0a0');
    }
    if (rng.chance(0.6)) { const tx = x + 4; wrapRect(p, tx, GROUND - 34, 2, 34, '#5a3a22'); for (let b = 0; b < 4; b++) p.line(tx, GROUND - 34 + b * 5, tx + rng.int(-10, 10), GROUND - 46 + b * 5, '#5a3a22'); }
    x += 30;
  }
};

/** Tall glass towers with window grids (Marijin Dvor business district, fictional buildings). */
const modern: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    const w = rng.int(36, 64), h = rng.int(120, 230), top = GROUND - h;
    const glass = rng.chance(0.5) ? t.mid : shade(t.mid, -0.15);
    wrapRect(p, x, top, w, h, glass);
    wrapRect(p, x, top, 3, h, shade(glass, 0.2));
    for (let wy = top + 4; wy < GROUND - 6; wy += 6) wrapRect(p, x, wy, w, 1, t.midDetail);
    for (let wx = x + 6; wx < x + w; wx += 8) wrapRect(p, wx, top, 1, h, t.midDetail);
    if (t.night || rng.chance(0.4)) for (let i = 0; i < 20; i++) wrapRect(p, x + rng.int(1, w - 6), top + rng.int(2, h - 8), 6, 4, '#f8d870');
    if (rng.chance(0.5)) { wrapRect(p, x + w / 2 - 1, top - 20, 2, 20, '#8a8f9c'); p.set(Math.round(x + w / 2) % BG_W, top - 21, '#ff4a3a'); }
    x += w + rng.int(4, 18);
  }
  // tram overhead wire
  p.rect(0, GROUND - 46, BG_W, 1, '#2a2a30');
  for (let x2 = 20; x2 < BG_W; x2 += 80) p.rect(x2, GROUND - 50, 2, 50, '#4a4e5a');
};

/** Socialist-era apartment blocks with balconies and coloured panels. */
const blocks: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    if (rng.chance(0.2)) { tree(p, x + 14, t, rng); x += 30; continue; }
    const floors = rng.int(5, 10), w = rng.int(70, 120), h = floors * 14 + 10, top = GROUND - h;
    wrapRect(p, x, top, w, h, t.mid);
    wrapRect(p, x, top, w, 3, shade(t.mid, -0.2));
    const panel = t.accent ?? '#4a8ad8';
    for (let f = 0; f < floors; f++) {
      const fy = top + 8 + f * 14;
      for (let wx = x + 4; wx < x + w - 10; wx += 12) {
        wrapRect(p, wx, fy, 8, 7, windowColor(t, rng));
        if ((Math.floor((wx - x) / 12) + f) % 3 === 0) { wrapRect(p, wx - 1, fy + 7, 10, 3, shade(t.mid, -0.25)); wrapRect(p, wx - 1, fy + 7, 10, 1, panel); }
      }
    }
    if (rng.chance(0.5)) { wrapRect(p, x + w - 10, top - 6, 6, 6, '#c0c4cc'); }
    wrapRect(p, x + w / 2 - 6, GROUND - 14, 12, 14, shade(t.midDetail, -0.2));
    // market stalls in front of some blocks
    if (rng.chance(0.4)) for (let s = 0; s < 3; s++) {
      const sx = x + 6 + s * 24;
      for (let i = 0; i < 20; i++) wrapRect(p, sx + i, GROUND - 22, 1, 4, Math.floor(i / 4) % 2 ? panel : '#f4f4f4');
      wrapRect(p, sx + 2, GROUND - 18, 16, 18, shade(t.midDetail, 0.1));
    }
    x += w + rng.int(10, 24);
  }
};

/** Very tall residential towers with balcony stripes (Hrasno). */
const towers: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    const w = rng.int(34, 50), h = rng.int(180, 250), top = GROUND - h;
    wrapRect(p, x, top, w, h, t.mid);
    wrapRect(p, x + w - 4, top, 4, h, shade(t.mid, -0.2));
    for (let fy = top + 6; fy < GROUND - 8; fy += 10) {
      wrapRect(p, x, fy + 6, w, 2, shade(t.mid, -0.3));
      for (let wx = x + 4; wx < x + w - 8; wx += 9) wrapRect(p, wx, fy, 5, 5, windowColor(t, rng));
    }
    wrapRect(p, x - 2, top - 4, w + 4, 4, t.midDetail);
    x += w + rng.int(30, 60);
    if (rng.chance(0.5)) tree(p, x - 16, t, rng);
  }
};

/** Tram depot: saw-tooth roof halls, chimneys, overhead wires and parked trams (Malta). */
const industrial: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    const w = rng.int(90, 140), h = rng.int(50, 80), top = GROUND - h;
    wrapRect(p, x, top, w, h, t.mid);
    for (let s = x; s < x + w; s += 16) for (let i = 0; i < 12; i++) wrapRect(p, s + i, top - 12 + i, 1, 12 - i, t.roof);
    for (let s = x + 4; s < x + w - 8; s += 16) wrapRect(p, s, top + 8, 10, 6, t.night ? '#f8d870' : '#5a7a8a');
    wrapRect(p, x + 10, top + 30, w - 20, h - 30, shade(t.midDetail, 0.1));
    if (rng.chance(0.6)) { wrapRect(p, x + w - 20, top - 50, 8, 50, shade(t.mid, -0.15)); wrapRect(p, x + w - 20, top - 50, 8, 3, '#d83a3a'); }
    // parked tram
    const tx = x + 14;
    wrapRect(p, tx, GROUND - 26, 60, 22, rng.pick(['#e8c040', '#d83a3a', '#3a8ad8']));
    wrapRect(p, tx, GROUND - 26, 60, 3, '#f4f4f4');
    for (let wx = tx + 4; wx < tx + 56; wx += 10) wrapRect(p, wx, GROUND - 21, 7, 8, t.night ? '#f8d870' : '#2a3a4a');
    wrapRect(p, tx + 28, GROUND - 40, 2, 14, '#2a2a30');
    x += w + rng.int(10, 30);
  }
  p.rect(0, GROUND - 42, BG_W, 1, '#1a1a20');
  for (let x2 = 0; x2 < BG_W; x2 += 64) p.rect(x2, GROUND - 48, 2, 48, '#3a3a40');
};

/** Stepped terrace housing in brick, with a tall brick chimney and a crane (Ciglane). */
const terraces: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    const steps = rng.int(4, 7), w = rng.int(110, 160);
    for (let s = 0; s < steps; s++) {
      const sw = w - s * 16, sx = x + s * 8, top = GROUND - (s + 1) * 18;
      wrapRect(p, sx, top, sw, 18, s % 2 ? t.mid : shade(t.mid, -0.1));
      wrapRect(p, sx, top, sw, 2, shade(t.mid, 0.25));
      for (let wx = sx + 4; wx < sx + sw - 8; wx += 11) wrapRect(p, wx, top + 6, 7, 7, windowColor(t, rng));
      if (rng.chance(0.4)) wrapRect(p, sx + 2, top - 3, sw - 4, 3, '#4a8a3a'); // terrace greenery
    }
    x += w + rng.int(10, 30);
    if (rng.chance(0.35)) { wrapRect(p, x - 8, GROUND - 150, 10, 150, t.midDetail); for (let y = GROUND - 150; y < GROUND; y += 8) wrapRect(p, x - 8, y, 10, 1, shade(t.midDetail, -0.3)); }
  }
  const cx = rng.int(100, 500);
  p.rect(cx, GROUND - 200, 4, 200, '#e0a23a');
  p.rect(cx - 60, GROUND - 200, 120, 4, '#e0a23a');
  p.line(cx + 50, GROUND - 196, cx + 50, GROUND - 150, '#2a2a30');
};

/** Stadium stands with crowd dots and floodlights (Koševo). */
const stadium: Backdrop = (p, t, rng) => {
  for (let tier = 0; tier < 5; tier++) {
    const y = GROUND - 40 - tier * 22;
    p.rect(0, y, BG_W, 22, tier % 2 ? t.mid : shade(t.mid, -0.1));
    for (let i = 0; i < 260; i++) p.set(rng.int(0, BG_W - 1), y + rng.int(3, 18), rng.pick(['#e8483a', '#f4f4f4', '#3a6ad8', '#f2d64b', '#5ad05a']));
  }
  p.rect(0, GROUND - 160, BG_W, 6, t.midDetail);
  for (let x = 40; x < BG_W; x += 200) {
    p.rect(x, GROUND - 260, 4, 100, '#5a5a62');
    p.rect(x - 14, GROUND - 272, 32, 14, '#3a3a42');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) p.rect(x - 12 + i * 8, GROUND - 270 + j * 6, 6, 4, '#ffffe0');
  }
  p.rect(0, GROUND - 40, BG_W, 40, t.groundDark);
  p.rect(0, GROUND - 40, BG_W, 2, '#ffffff');
};

/** Airport: hangars, control tower, parked planes, windsock (Dobrinja is next to the airport). */
const airport: Backdrop = (p, t, rng) => {
  let x = 0;
  while (x < BG_W) {
    const w = rng.int(100, 140), h = 60, top = GROUND - h;
    for (let i = 0; i < w; i++) { const arc = Math.round(Math.sin((i / w) * Math.PI) * 20); wrapRect(p, x + i, top - arc, 1, h + arc, i % 8 === 0 ? shade(t.mid, -0.2) : t.mid); }
    wrapRect(p, x + 10, GROUND - 40, w - 20, 40, shade(t.midDetail, -0.1));
    x += w + 30;
    // plane
    const px = x - 10;
    wrapRect(p, px, GROUND - 22, 70, 12, '#f4f4f4');
    wrapRect(p, px + 60, GROUND - 38, 10, 16, t.accent ?? '#3a6ad8');
    wrapRect(p, px + 20, GROUND - 14, 30, 4, '#c0c4cc');
    for (let wx = px + 6; wx < px + 56; wx += 6) wrapRect(p, wx, GROUND - 19, 3, 3, '#3a5a7a');
    wrapRect(p, px, GROUND - 22, 70, 2, t.accent ?? '#3a6ad8');
    x += 80;
  }
  const tx = rng.int(200, 400);
  p.rect(tx, GROUND - 170, 14, 170, t.mid);
  p.rect(tx - 10, GROUND - 190, 34, 22, '#4a6a8a');
  p.rect(tx - 12, GROUND - 192, 38, 3, t.midDetail);
  p.rect(tx + 60, GROUND - 40, 2, 40, '#8a8f9c'); p.rect(tx + 62, GROUND - 40, 12, 4, '#ff7a2a');
};

const BACKDROPS: Record<string, Backdrop> = { oldtown, hillside, plaza, modern, blocks, towers, industrial, terraces, stadium, airport };

export function midLayer(t: ThemeDef, seed: number): Pix {
  const p = new Pix(BG_W, BG_H);
  const rng = new Rng(seed);
  (BACKDROPS[t.backdrop] ?? oldtown)(p, t, rng);
  p.rect(0, GROUND, BG_W, BG_H - GROUND, shade(t.groundDark, -0.15));
  return p;
}
