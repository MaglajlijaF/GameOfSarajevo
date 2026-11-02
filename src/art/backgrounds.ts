import { Pix } from './pixel';
import { mix, shade } from './palette';
import { Rng } from '../core/rng';
import type { ThemeDef } from '../core/types';

export const BG_W = 640;
export const BG_H = 360;

/** Draws an image wrapping around horizontally so the layer tiles seamlessly. */
function wrapRect(p: Pix, x: number, y: number, w: number, h: number, c: string) {
  for (let i = 0; i < w; i++) p.rect(((x + i) % p.w + p.w) % p.w, y, 1, h, c);
}

export function skyLayer(t: ThemeDef, seed: number): Pix {
  const p = new Pix(BG_W, BG_H);
  const rng = new Rng(seed);
  const bands = 18;
  for (let i = 0; i < bands; i++) p.rect(0, Math.floor((i * BG_H) / bands), BG_W, Math.ceil(BG_H / bands) + 1, mix(t.sky[0], t.sky[1], i / (bands - 1)));
  // sun
  p.circle(500, 70, 18, mix(t.sky[1], '#fff6c0', 0.7));
  p.circle(500, 70, 14, '#fff6d8');
  // clouds
  for (let i = 0; i < 7; i++) {
    const cx = rng.int(0, BG_W), cy = rng.int(20, 120), w = rng.int(30, 70);
    for (let k = 0; k < 4; k++) wrapRect(p, cx + k * (w / 5), cy - (k % 2) * 4, Math.round(w / 2), 8 + (k % 2) * 4, '#ffffff');
    wrapRect(p, cx, cy + 8, w, 3, shade('#ffffff', -0.08));
  }
  return p;
}

/** Hills around the valley with small houses scattered on the slopes. */
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
    p.set(x, h, shade(t.far, 0.2));
  }
  // houses on hills
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, BG_W - 1);
    const y = Math.round(heights[x]) + rng.int(4, 60);
    if (y > BG_H - 8) continue;
    p.rect(x, y, 4, 3, rng.chance(0.7) ? '#f0ead8' : '#e0c8a0');
    p.rect(x, y - 1, 4, 1, t.roof);
    p.set(x + 1, y + 1, '#5a4a3a');
  }
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, BG_W - 1);
    const y = Math.round(heights[x]) + rng.int(2, 80);
    p.rect(x, y, 2, 2, t.farDetail);
  }
  return p;
}

/** Old-town street front: low houses with tiled roofs, wooden bay windows, chimneys and trees. */
export function midLayer(t: ThemeDef, seed: number): Pix {
  const p = new Pix(BG_W, BG_H);
  const rng = new Rng(seed);
  const ground = 300;
  let x = 0;
  while (x < BG_W) {
    const w = rng.int(40, 70);
    if (rng.chance(0.18)) {
      // tree
      const tx = x + w / 2;
      p.rect(Math.round(tx) - 1, ground - 30, 3, 30, '#5a3a22');
      p.circle(Math.round(tx), ground - 40, 13, shade(t.far, -0.1));
      p.circle(Math.round(tx) - 6, ground - 34, 9, t.far);
      p.circle(Math.round(tx) + 7, ground - 36, 8, shade(t.far, 0.1));
      x += w;
      continue;
    }
    const floors = rng.int(1, 3);
    const h = 26 + floors * 22;
    const top = ground - h;
    const wall = rng.chance(0.75) ? t.mid : shade(t.mid, -0.12);
    wrapRect(p, x, top, w, h, wall);
    wrapRect(p, x, top, 2, h, shade(wall, -0.15));
    // wooden beams typical of old-town houses
    for (let f = 1; f <= floors; f++) wrapRect(p, x, top + f * 22, w, 2, t.midDetail);
    // roof (stepped)
    const roofH = 12;
    for (let r = 0; r < roofH; r++) wrapRect(p, x - 4 + Math.floor(r / 1.5), top - roofH + r, w + 8 - Math.floor(r / 1.5) * 2, 1, r % 3 === 0 ? shade(t.roof, -0.2) : t.roof);
    if (rng.chance(0.6)) wrapRect(p, x + w - 14, top - roofH - 8, 5, 10, shade(t.roof, -0.35));
    // windows
    for (let f = 0; f < floors; f++) {
      const wy = top + 6 + f * 22;
      for (let wx = x + 7; wx < x + w - 8; wx += 12) {
        wrapRect(p, wx, wy, 6, 8, '#3a5a7a');
        wrapRect(p, wx, wy, 6, 1, t.midDetail);
        wrapRect(p, wx + 2, wy, 1, 8, t.midDetail);
        wrapRect(p, wx - 1, wy + 8, 8, 1, shade(t.midDetail, 0.2));
      }
    }
    // bay window (doksat) on upper floor
    if (floors >= 2 && rng.chance(0.5)) {
      const bx = x + Math.round(w / 2) - 8;
      wrapRect(p, bx, top + 4, 16, 14, t.midDetail);
      wrapRect(p, bx + 2, top + 6, 12, 8, '#4a7090');
      wrapRect(p, bx + 7, top + 6, 1, 8, t.midDetail);
    }
    // shop front with awning and door
    const awn = rng.pick(['#d83a3a', '#3a8ad8', '#e0a23a', '#4aa04a']);
    for (let i = 0; i < w - 4; i++) wrapRect(p, x + 2 + i, ground - 22, 1, 4, Math.floor(i / 4) % 2 ? awn : '#f4f4f4');
    wrapRect(p, x + 6, ground - 16, 10, 16, shade(t.midDetail, -0.2));
    wrapRect(p, x + 20, ground - 15, Math.max(6, w - 28), 10, '#2a3a4a');
    x += w + rng.int(0, 6);
  }
  p.rect(0, ground, BG_W, BG_H - ground, shade(t.groundDark, -0.15));
  return p;
}
