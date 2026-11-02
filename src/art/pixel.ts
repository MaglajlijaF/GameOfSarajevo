import { CODE, PAL } from './palette';

/** A tiny pixel canvas holding hex colors (or null for transparent). Pure data until `toCanvas`. */
export class Pix {
  readonly data: (string | null)[];
  constructor(readonly w: number, readonly h: number) { this.data = new Array(w * h).fill(null); }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.data[y * this.w + x];
  }
  set(x: number, y: number, c: string | null): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string | null): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, thick = 1): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.rect(x0, y0, thick, thick, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  circle(cx: number, cy: number, r: number, c: string): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, c);
  }
  /** Draws string-art rows using single-char palette codes; '.' is skipped. */
  stamp(rows: string[], ox = 0, oy = 0, codes: Record<string, string> = CODE): void {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = codes[ch] ?? PAL[ch];
        if (c) this.set(ox + x, oy + y, c);
      }
    });
  }
  /** Copies another Pix on top (transparent pixels skipped). */
  blit(src: Pix, ox = 0, oy = 0, flipX = false): void {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(flipX ? src.w - 1 - x : x, y);
      if (c) this.set(ox + x, oy + y, c);
    }
  }
  /** Adds a 1px outline around opaque pixels. */
  outline(c: string, diagonal = false): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      const n = this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)
        || (diagonal && (this.get(x - 1, y - 1) || this.get(x + 1, y - 1) || this.get(x - 1, y + 1) || this.get(x + 1, y + 1)));
      if (n && n !== c) add.push(y * this.w + x);
    }
    for (const i of add) this.data[i] = c;
  }
  scaled(f: number): Pix {
    const p = new Pix(this.w * f, this.h * f);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.data[y * p.w + x] = this.get(Math.floor(x / f), Math.floor(y / f));
    return p;
  }
  /** Rotates 90° clockwise (square canvases only keep their size). */
  rotatedCW(): Pix {
    const p = new Pix(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.set(this.h - 1 - y, x, this.get(x, y));
    return p;
  }
  shifted(dx: number, dy: number): Pix {
    const p = new Pix(this.w, this.h);
    p.blit(this, dx, dy);
    return p;
  }
  clone(): Pix { const p = new Pix(this.w, this.h); p.data.splice(0, p.data.length, ...this.data); return p; }
  mapColors(fn: (c: string) => string): Pix { const p = this.clone(); for (let i = 0; i < p.data.length; i++) if (p.data[i]) p.data[i] = fn(p.data[i]!); return p; }
}

/** Packs frames horizontally onto a canvas (renderer-facing step). */
export function framesToCanvas(frames: Pix[]): HTMLCanvasElement {
  const fw = frames[0].w, fh = frames[0].h;
  const cv = document.createElement('canvas');
  cv.width = fw * frames.length; cv.height = fh;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(cv.width, cv.height);
  frames.forEach((f, i) => {
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const c = f.get(x, y);
      if (!c) continue;
      const o = (y * cv.width + i * fw + x) * 4;
      const n = parseInt(c.slice(1), 16);
      img.data[o] = (n >> 16) & 255; img.data[o + 1] = (n >> 8) & 255; img.data[o + 2] = n & 255; img.data[o + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function pixToCanvas(p: Pix): HTMLCanvasElement { return framesToCanvas([p]); }
