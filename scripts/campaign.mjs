// Plays the whole campaign in a headless browser on a fresh save:
// every stage, every wave, every boss. Bosses are kept alive for a while with
// an invulnerable player to verify they move, use several attacks and land hits.
// Usage: npm run build:web && node scripts/campaign.mjs [outDir] [bossSeconds]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { serveDist } from './serve-dist.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2] ?? 'smoke-out/campaign';
const bossSeconds = Number(process.argv[3] ?? 12);
await mkdir(out, { recursive: true });
const server = serveDist(4176);
const errors = [];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4176/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.scene.isActive('Menu'), null, { timeout: 15000 });
const wait = (ms) => page.waitForTimeout(ms);
const fail = async (msg) => { console.error('FAIL:', msg); console.error(errors.join('\n')); await page.screenshot({ path: `${out}/fail.png` }); await browser.close(); server.close(); process.exit(1); };
const ORDER = ['kovaci', 'bistrik', 'skenderija', 'marijin_dvor', 'grbavica', 'malta', 'cengic_vila', 'hrasno', 'pofalici', 'ciglane', 'kosevo', 'alipasino_polje', 'dobrinja'];

const levelUp = () => page.evaluate(() => {
  const g = window.__game;
  if (!g.scene.isActive('LevelUp')) return false;
  const ls = g.scene.getScene('LevelUp');
  const d = ls.sys.settings.data;
  ls.pickW = d.offers[0] ?? null; ls.pickB = 'strength';
  ls.refresh(d);
  ls.confirm.emit('pointerdown', {}, 0, 0, {});
  return true;
});

const report = [];
for (let si = 0; si < ORDER.length; si++) {
  const id = ORDER[si];
  // the next stage must still be locked
  if (si + 1 < ORDER.length) {
    await page.evaluate((n) => window.__game.scene.getScene('Menu').startStage(n), ORDER[si + 1]);
    await wait(200);
    if (await page.evaluate(() => window.__game.scene.isActive('Stage'))) await fail(`${ORDER[si + 1]} started while locked`);
  }
  await page.evaluate((n) => window.__game.scene.getScene('Menu').startStage(n), id);
  await page.waitForFunction(() => window.__game.scene.isActive('Stage'), null, { timeout: 6000 }).catch(() => fail(`${id} did not start`));
  await wait(600);
  await page.evaluate(() => {
    const st = window.__game.scene.getScene('Stage');
    const p = st.player;
    window.__hits = 0;
    const orig = p.hurt.bind(p);
    p.hurt = (...a) => { const r = orig(...a); if (r) window.__hits++; p.hp = p.stats.maxHp; p.dead = false; return r; };
  });
  for (let s = 0; s < 6; s++) {
    await page.evaluate((i) => { const st = window.__game.scene.getScene('Stage'); const sec = st.plan.sections[i]; st.player.body.reset((sec.x0 + 6) * 16, 280); }, s);
    await wait(900);
    const mode = await page.evaluate(() => window.__game.scene.getScene('Stage').mode);
    if (mode !== (s < 5 ? 'combat' : 'boss')) await fail(`${id} section ${s}: mode ${mode}`);
    if (s === 3) {
      await page.evaluate(() => { window.__hits = 0; });
      await wait(2500);
      while (await levelUp()) await wait(100);
      await page.screenshot({ path: `${out}/${String(si + 1).padStart(2, '0')}-${id}-wave.png` });
    }
    if (s === 5) {
      // Let the boss fight for a while: it must move, attack and hit.
      await page.evaluate(() => { window.__hits = 0; const b = window.__game.scene.getScene('Stage').boss; window.__bx = [b.x]; });
      for (let t = 0; t < bossSeconds * 4; t++) {
        await wait(250);
        while (await levelUp()) await wait(100);
        await page.evaluate(() => { const st = window.__game.scene.getScene('Stage'); window.__bx.push(st.boss.x); if (st.player.x < st.arenaBounds().left + 30 || st.player.x > st.arenaBounds().right - 30) st.player.body.reset((st.arenaBounds().left + st.arenaBounds().right) / 2, 280); });
        if (t === bossSeconds * 2) await page.screenshot({ path: `${out}/${String(si + 1).padStart(2, '0')}-${id}-boss.png` });
        if (t === bossSeconds * 3) await page.evaluate(() => { const b = window.__game.scene.getScene('Stage').boss; b.hp = Math.min(b.hp, b.maxHp * 0.45); });
      }
      const b = await page.evaluate(() => { const st = window.__game.scene.getScene('Stage'); const bx = window.__bx; return { history: st.boss.history.slice(), phase: st.boss.phase, state: st.boss.bstate, travel: Math.round(bx.slice(1).reduce((s, x, i) => s + Math.abs(x - bx[i]), 0)), hits: window.__hits }; });
      report.push({ id, ...b, distinct: new Set(b.history).size });
      if (b.history.length < 3 || new Set(b.history).size < 2) await fail(`${id} boss barely attacked: ${b.history}`);
      if (b.travel < 60) await fail(`${id} boss did not move (${b.travel}px)`);
      if (b.hits < 1) await fail(`${id} boss never hit the player`);
    }
    for (let k = 0; k < 300; k++) {
      if (await levelUp()) { await wait(100); continue; }
      const m = await page.evaluate(() => {
        const g = window.__game, st = g.scene.getScene('Stage');
        if (!g.scene.isActive('Stage')) return st.mode;
        for (const e of st.targets()) st.hitEnemy(e, 99999, st.player.x, st.player.y, 0);
        return st.mode;
      });
      if (s < 5 && m === 'explore') break;
      if (s === 5 && (m === 'victory' || (await page.evaluate(() => window.__game.scene.isActive('Result'))))) break;
      await wait(100);
    }
  }
  await page.waitForFunction(() => window.__game.scene.isActive('Result'), null, { timeout: 8000 }).catch(() => fail(`${id}: no result`));
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')));
  if (!save.cleared.includes(id)) await fail(`${id} not cleared`);
  if (si + 1 < ORDER.length && !save.unlocked.includes(ORDER[si + 1])) await fail(`${ORDER[si + 1]} not unlocked`);
  console.log(`✓ ${id}: KM ${save.km}, unlocked ${save.unlocked.length}`);
  await page.evaluate(() => window.__game.scene.getScene('Result').scene.start('Menu'));
  await wait(400);
}
await page.screenshot({ path: `${out}/99-menu-all-cleared.png` });
console.table(report.map((r) => ({ stage: r.id, attacks: r.history.length, distinct: r.distinct, phase: r.phase + 1, travel: r.travel, hits: r.hits })));
await browser.close();
server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('campaign OK');
