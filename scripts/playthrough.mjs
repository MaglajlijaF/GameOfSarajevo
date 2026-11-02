// Scripted end-to-end run of Kovači on a fresh save: every wave, level-ups
// (weapon merge + buff), both boss phases, victory, KM payout and the Bistrik
// unlock. Then a stress test with 45 enemies + 300 projectiles.
// Usage: npm run build:web && node scripts/playthrough.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { serveDist } from './serve-dist.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2] ?? 'smoke-out';
await mkdir(out, { recursive: true });
const server = serveDist(4175);
const errors = [];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 5).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4175/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.scene.isActive('Menu'), null, { timeout: 15000 });
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const fail = async (msg) => { console.error('FAIL:', msg); console.error(errors.join('\n')); await shot('fail'); await browser.close(); server.close(); process.exit(1); };

// Locked stage cannot be started from the menu
const locked = await page.evaluate(() => { const m = window.__game.scene.getScene('Menu'); m.startStage('bistrik'); return window.__game.scene.isActive('Stage'); });
await wait(300);
if (locked || await page.evaluate(() => window.__game.scene.isActive('Stage'))) await fail('locked stage started');

await page.evaluate(() => window.__game.scene.getScene('Menu').startStage('kovaci'));
await page.waitForFunction(() => window.__game.scene.isActive('Stage'), null, { timeout: 5000 });
await wait(800);

const levelUps = [];
async function handleLevelUp() {
  const r = await page.evaluate(() => {
    const g = window.__game;
    if (!g.scene.isActive('LevelUp')) return null;
    const ls = g.scene.getScene('LevelUp');
    const offers = ls.wCards.length;
    const d = ls.sys.settings.data;
    ls.pickW = d.offers[0] ?? null; ls.pickB = ['strength', 'speed', 'durability'][d.level % 3];
    ls.refresh(d);
    const name = ls.previewName.text;
    ls.confirm.emit('pointerdown', {}, 0, 0, {});
    return { offers, picked: ls.pickW, buff: ls.pickB, name };
  });
  if (r) levelUps.push(r);
  return r;
}

for (let s = 0; s < 6; s++) {
  // Teleport into the next section to trigger the arena lock
  await page.evaluate((i) => { const st = window.__game.scene.getScene('Stage'); const sec = st.plan.sections[i]; st.player.setPosition((sec.x0 + 6) * 16, 280); st.player.body.reset((sec.x0 + 6) * 16, 280); }, s);
  await wait(900);
  const mode = await page.evaluate(() => window.__game.scene.getScene('Stage').mode);
  if (mode !== (s < 5 ? 'combat' : 'boss')) await fail(`section ${s}: expected lock, mode=${mode}`);
  if (s === 2) await shot('4-wave3');
  for (let k = 0; k < 400; k++) {
    if (await handleLevelUp()) { await wait(150); if (levelUps.length === 2) await shot('5-after-merge'); continue; }
    const st = await page.evaluate((isBoss) => {
      const g = window.__game;
      const st = g.scene.getScene('Stage');
      if (!g.scene.isActive('Stage')) return { mode: st.mode, paused: true };
      st.player.hp = st.player.stats.maxHp; // keep the scripted player alive
      for (const e of st.targets()) st.hitEnemy(e, isBoss && e.isBoss ? 40 : 25, st.player.x, st.player.y, 50);
      return { mode: st.mode, boss: st.boss ? { hp: st.boss.hp, phase: st.boss.phase } : null };
    }, s === 5);
    if (s === 5 && st.boss && st.boss.phase === 1 && !page._phaseShot) { page._phaseShot = true; await wait(1500); await shot('6-boss-phase2'); }
    if (s < 5 && st.mode === 'explore') break;
    if (s === 5 && (st.mode === 'victory' || await page.evaluate(() => window.__game.scene.isActive('Result')))) break;
    await wait(120);
  }
  console.log(`section ${s} cleared`);
}
await page.waitForFunction(() => window.__game.scene.isActive('Result'), null, { timeout: 8000 }).catch(() => fail('no result screen'));
await wait(500);
await shot('7-result');
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')));
console.log('level-ups:', levelUps.map((l) => `${l.picked}+${l.buff} → ${l.name}`).join('\n  '));
console.log('save:', { km: save.km, cleared: save.cleared, unlocked: save.unlocked });
if (!save.cleared.includes('kovaci') || !save.unlocked.includes('bistrik') || save.unlocked.length !== 2) await fail('unlock wrong');
if (save.km !== 150) await fail('km wrong');
if (levelUps.length < 3) await fail('expected several level-ups');

// Back to menu, open shop and buy health
await page.evaluate(() => window.__game.scene.getScene('Result').scene.start('Shop'));
await wait(500);
await page.evaluate(() => { const s = window.__game.scene.getScene('Shop'); const b = s.children.list.find((c) => c.label && c.label.text.startsWith('KUPI')); b.emit('pointerdown', {}, 0, 0, {}); });
await wait(400);
await shot('8-shop');
const save2 = await page.evaluate(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')));
console.log('after shop:', { km: save2.km, upgrades: save2.upgrades });
await page.evaluate(() => window.__game.scene.getScene('Shop').scene.start('Menu'));
await wait(500);
await shot('9-menu-after');

// Quitting a stage must not unlock anything
await page.evaluate(() => window.__game.scene.getScene('Menu').startStage('bistrik'));
await page.waitForFunction(() => window.__game.scene.isActive('Stage'), null, { timeout: 5000 });
await wait(500);
await page.evaluate(() => window.__game.scene.getScene('Stage').quit());
await wait(500);
const save3 = await page.evaluate(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')));
if (save3.unlocked.includes('skenderija')) await fail('quit unlocked a stage');

// Stress: 45 enemies + 300 projectiles in an arena
await page.evaluate(() => window.__game.scene.getScene('Menu').startStage('kovaci'));
await page.waitForFunction(() => window.__game.scene.isActive('Stage'), null, { timeout: 5000 });
await wait(500);
await page.mouse.move(900, 300);
await page.mouse.down();
const perf = await page.evaluate(async () => {
  const g = window.__game;
  const st = g.scene.getScene('Stage');
  const sec = st.plan.sections[0];
  st.player.setPosition((sec.x0 + 6) * 16, 280); st.player.body.reset((sec.x0 + 6) * 16, 280);
  await new Promise((r) => setTimeout(r, 800));
  st.director = null; // manual spawning
  const ids = ['prodavac', 'golubar', 'dostavljac', 'nosac'];
  for (let i = 0; i < 45; i++) st.spawnEnemy(ids[i % 4], (sec.x0 + 2 + (i % 36)) * 16, 120 + (i % 5) * 30);
  st.player.hp = 1e6; st.player.stats.maxHp = 1e6; st.player.stats.xpMult = 0;
  st.enemies.children.each((e) => { if (e.alive) { e.hp = 1e9; e.maxHp = 1e9; } return true; });
  for (const id of ['cevapi', 'dzezva', 'golub', 'kisobran', 'fenjer', 'sudzuk', 'burek', 'tepsija']) st.applyLevelUp(id, 'speed');
  st.xp.pendingLevelUps = 0;
  if (g.scene.isActive('LevelUp')) g.scene.stop('LevelUp'); g.scene.resume('Stage'); st.inLevelUp = false;
  let logic = 0, n = 0, render = 0, ta = 0, tr = 0;
  st.events.on('preupdate', () => { ta = performance.now(); });
  st.events.on('postupdate', () => { logic += performance.now() - ta; n++; });
  g.events.on('prerender', () => { tr = performance.now(); });
  g.events.on('postrender', () => { render += performance.now() - tr; });
  for (let i = 0; i < 300; i++) st.firePlayer({ texture: 'proj_cevapi', x: st.player.x, y: 200, vx: Math.cos(i) * 200, vy: Math.sin(i) * 200, damage: 0, life: 5, pierce: 999 });
  const t0 = performance.now();
  const f0 = g.loop.frame;
  await new Promise((r) => setTimeout(r, 4000));
  const frames = g.loop.frame - f0;
  let alive = 0; st.enemies.children.each((e) => { if (e.alive) alive++; return true; });
  let proj = 0; st.pProj.children.each((p) => { if (p.active) proj++; return true; });
  const paused = !g.scene.isActive('Stage');
  return { paused, alive, proj, frames, wallMsPerFrame: +((performance.now() - t0) / frames).toFixed(2), logicMsPerFrame: +(logic / n).toFixed(2), renderMsPerFrame: +(render / frames).toFixed(2) };
});
console.log('stress:', perf);
await shot('10-stress');
await browser.close();
server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('playthrough OK');
