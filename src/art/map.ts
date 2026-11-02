import { Pix } from './pixel';
import { shade } from './palette';
import { Rng } from '../core/rng';

/** Stylised map of Sarajevo for the stage select: valley, hills, the Miljacka and the tram line. */
export function cityMap(w = 640, h = 360): Pix {
  const p = new Pix(w, h);
  const rng = new Rng(77);
  const grass = '#6aa85a';
  p.rect(0, 0, w, h, grass);
  // hills north and south (darker shading toward edges)
  for (let x = 0; x < w; x++) {
    const n = 70 + Math.sin(x / 47) * 18 + Math.sin(x / 13) * 5 - (x > 420 ? (x - 420) * 0.05 : 0);
    const s = h - 70 + Math.sin(x / 39 + 2) * 16 + Math.sin(x / 11) * 4 - (x > 480 ? (x - 480) * 0.25 : 0);
    for (let y = 0; y < n; y++) p.set(x, y, shade('#4d8a4a', -(n - y) / n * 0.35));
    for (let y = Math.round(s); y < h; y++) p.set(x, y, shade('#4d8a4a', -(y - s) / (h - s) * 0.35));
  }
  // urban fabric (blocks) along the valley floor
  for (let i = 0; i < 900; i++) {
    const x = rng.int(20, w - 20), y = rng.int(60, h - 50);
    const c = rng.chance(0.5) ? '#d8cfbf' : '#c8bca8';
    p.rect(x, y, rng.int(2, 4), 2, c);
    if (rng.chance(0.3)) p.set(x, y, '#c8503a');
  }
  // river Miljacka (east → west, gently winding)
  const river = (x: number) => 196 + Math.sin(x / 70) * 10 + (x < 300 ? (300 - x) * 0.12 : 0);
  for (let x = 0; x < w; x++) {
    const y = Math.round(river(x));
    p.rect(x, y - 2, 1, 5, '#3a8ad8');
    p.set(x, y - 2, '#7ac0f0');
  }
  // bridges
  for (const bx of [520, 470, 430, 380, 330]) p.rect(bx, Math.round(river(bx)) - 4, 3, 9, '#e8e0d0');
  // main road / tram line
  for (let x = 40; x < 600; x++) {
    const y = Math.round(river(x) - 16 + Math.sin(x / 90) * 4);
    p.set(x, y, '#f0e6c8');
    if (x % 6 < 3) p.set(x, y + 1, '#8a8f9c');
  }
  return p;
}
