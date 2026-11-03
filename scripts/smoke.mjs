// Headless smoke test: serves dist/, boots the game in Chromium, drives the
// menu → stage flow, takes screenshots and fails on any page error.
// Usage: node scripts/smoke.mjs [outDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdir } from 'node:fs/promises';
import { serveDist } from './serve-dist.mjs';

const out = process.argv[2] ?? 'smoke-out';
await mkdir(out, { recursive: true });
const server = serveDist(4173);

const errors = [];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 6).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(() => { if (!localStorage.getItem('gameofsarajevo.save')) localStorage.setItem('gameofsarajevo.save', JSON.stringify({ seenIntro: true, tutorialDone: true })); });
await page.goto('http://localhost:4173/');
const wait = (ms) => page.waitForTimeout(ms);
const scene = () => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','));
await page.waitForFunction(() => window.__game?.scene.isActive('Menu'), null, { timeout: 15000 }).catch(async (e) => { console.error(errors.join('\n')); await page.screenshot({ path: out + '/0-fail.png' }); throw e; });
await wait(500);
await page.screenshot({ path: `${out}/1-menu.png` });

const drive = process.env.SMOKE_SCRIPT ?? 'default';
const result = await page.evaluate(async (mode) => {
  const g = window.__game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  g.scene.getScene('Menu').scene.start('Stage', { stageId: 'kovaci' });
  await sleep(1500);
  const st = g.scene.getScene('Stage');
  return { mode, w: st.plan.width, sections: st.plan.sections.length };
}, drive);
console.log('stage', result);
await page.screenshot({ path: `${out}/2-stage.png` });

// Walk right into the first arena while attacking
await page.mouse.move(1000, 360);
await page.keyboard.down('d');
await wait(1800);
await page.keyboard.press('Space');
await wait(300);
await page.keyboard.press('Shift');
await wait(900);
await page.keyboard.up('d');
await page.mouse.down();
for (let i = 0; i < 6; i++) { await wait(500); await page.keyboard.press('Space'); }
await page.screenshot({ path: `${out}/3-combat.png` });
await page.mouse.up();
const info = await page.evaluate(() => {
  const st = window.__game.scene.getScene('Stage');
  return { mode: st.mode, alive: st.aliveCount(), kills: st.kills, hp: st.player.hp, x: Math.round(st.player.x), fps: Math.round(window.__game.loop.actualFps), active: window.__game.scene.getScenes(true).map((s) => s.scene.key) };
});
console.log('combat', info);
console.log('scenes', await scene());

// Movement checks in arena 2 (has a ladder at column 15 and one-way platforms)
const place = (col, row) => page.evaluate(([c, r]) => {
  const st = window.__game.scene.getScene('Stage');
  const x = (st.plan.sections[1].x0 + c) * 16 + 8, y = r * 16;
  st.player.body.reset(x, y); st.player.hp = 9999; st.director = null; st.mode = 'combat';
  st.enemies.children.each((e) => { if (e.alive) e.kill(); return true; });
}, [col, row]);
const py = () => page.evaluate(() => { const p = window.__game.scene.getScene('Stage').player; return { y: Math.round(p.y), climbing: p.climbing, ground: p.onGround }; });
await place(15, 18); await wait(400);
const before = await py();
await page.keyboard.down('w'); await wait(1200);
const mid = await py();
await page.keyboard.up('w'); await wait(600);
const top = await py();
console.log('ladder', { before, mid, top });
if (!(mid.climbing && mid.y < before.y - 40)) throw new Error('ladder climb failed');
// drop through the one-way platform the ladder leads to (row 9)
await place(18, 7); await wait(500);
const onPlat = await py();
await page.keyboard.down('s'); await page.keyboard.press('Space'); await page.keyboard.up('s'); await wait(500);
const dropped = await py();
console.log('drop', { onPlat, dropped });
if (!(onPlat.ground && dropped.y > onPlat.y + 20)) throw new Error('drop-through failed');
// double jump reaches higher than a single jump
await place(30, 18); await wait(400);
const y0 = (await py()).y;
let y2 = y0;
await page.keyboard.down('Space'); await wait(280); await page.keyboard.up('Space'); await wait(40);
await page.keyboard.down('Space');
for (let i = 0; i < 12; i++) { await wait(40); y2 = Math.min(y2, (await py()).y); }
await page.keyboard.up('Space');
console.log('double jump rise', y0 - y2);
if (y0 - y2 < 80) throw new Error('double jump too low');
await page.screenshot({ path: `${out}/4-movement.png` });

// Enemy projectiles must hurt the player (regression: overlap argument order).
const projHit = await page.evaluate(async () => {
  const st = window.__game.scene.getScene('Stage');
  st.player.hp = 100; st.player.invuln = 0;
  st.fireEnemyProjectile('corn', st.player.x + 40, st.player.y, -200, 0, 0, 7);
  await new Promise((r) => setTimeout(r, 600));
  return 100 - st.player.hp;
});
console.log('enemy projectile damage', projHit);
if (projHit <= 0) throw new Error('enemy projectiles do not hurt the player');

for (const sc of ['Settings', 'Character', 'Shop', 'Menu']) {
  await page.evaluate((k) => window.__game.scene.getScenes(true)[0].scene.start(k), sc);
  await wait(400);
  await page.screenshot({ path: `${out}/5-${sc.toLowerCase()}.png` });
}

await browser.close();
server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke OK');
