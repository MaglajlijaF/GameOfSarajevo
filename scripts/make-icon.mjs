// Renders the app icon (build/icon.png, 512x512) from the game's own generated
// pixel art, using the built web version in headless Chromium.
// Usage: npm run build:web && node scripts/make-icon.mjs
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { serveDist } from './serve-dist.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = serveDist(4178);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:4178/');
await p.waitForFunction(() => window.__game?.scene.isActive('Menu'), null, { timeout: 20000 });
const dataUrl = await p.evaluate(() => {
  const g = window.__game;
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const frame = (key, i) => { const f = g.textures.getFrame(key, i); return [f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight]; };
  // rounded badge
  const r = 80;
  x.beginPath(); x.moveTo(r, 0); x.arcTo(S, 0, S, S, r); x.arcTo(S, S, 0, S, r); x.arcTo(0, S, 0, 0, r); x.arcTo(0, 0, S, 0, r); x.closePath(); x.clip();
  // background: the Kovači parallax layers, cropped
  for (const layer of ['sky', 'far', 'mid']) { const [img, sx, sy, sw, sh] = frame(`bg_kovaci_${layer}`, 0); x.drawImage(img, sx + 40, sy + 120, 240, 240, 0, 0, S, S); }
  x.fillStyle = 'rgba(11,11,20,0.25)'; x.fillRect(0, 0, S, S);
  // ground strip
  const [ti, tx, ty] = frame('tiles_kovaci', 0);
  for (let i = 0; i < 8; i++) x.drawImage(ti, tx, ty, 16, 16, i * 64, S - 96, 64, 64);
  const [fi, fx, fy] = frame('tiles_kovaci', 1);
  for (let i = 0; i < 8; i++) x.drawImage(fi, fx, fy, 16, 16, i * 64, S - 32, 64, 64);
  // hero, big, with the weapon
  const [pi, px, py] = frame('player_amar', 8);
  x.drawImage(pi, px, py, 24, 24, 64, 32, 384, 384);
  const [wi, wx, wy, ww, wh] = frame('icon_rucka', 0);
  x.save(); x.translate(330, 250); x.rotate(-0.7); x.drawImage(wi, wx, wy, ww, wh, -32, -64, 128, 128); x.restore();
  return c.toDataURL('image/png');
});
mkdirSync('build', { recursive: true });
writeFileSync('build/icon.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
await b.close(); server.close();
console.log('wrote build/icon.png');
