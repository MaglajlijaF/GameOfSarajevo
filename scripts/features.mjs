// Headless checks for: intro cutscene → tutorial, steam vents, slower/bigger enemy
// shots, Tepsija stun, super abilities, keyboard aim + menu navigation, character
// creator and the ending cutscene. Usage: npm run build:web && node scripts/features.mjs [outDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdir } from 'node:fs/promises';
import { serveDist } from './serve-dist.mjs';

const out = process.argv[2] ?? 'smoke-out/features';
await mkdir(out, { recursive: true });
const server = serveDist(4177);
const errors = [];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 5).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
const active = () => ev(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
const fail = async (msg) => { console.error('FAIL:', msg); console.error(errors.join('\n')); await shot('fail'); await browser.close(); server.close(); process.exit(1); };
const levelUpByKeys = async () => {
  for (const k of ['Enter', 'ArrowDown', 'ArrowDown', 'Enter', 'ArrowDown', 'Enter']) { await page.keyboard.press(k); await wait(80); }
};
const check = async (cond, msg) => { if (!cond) await fail(msg); else console.log('✓', msg); };

// ---------- 1. First launch: intro cutscene, then tutorial ----------
await page.goto('http://localhost:4177/');
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.scene.isActive('Cutscene'), null, { timeout: 15000 }).catch(() => fail('intro cutscene did not start on first launch'));
console.log('✓ first launch opens the intro cutscene');
await wait(2500); await shot('01-intro-city');
await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await wait(3200); await shot('02-intro-bosses');
await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await wait(2200); await shot('03-intro-hero');
await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await wait(3600); await shot('04-intro-map');
await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await wait(1600); await shot('05-intro-title');
await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('Stage') && window.__game.scene.getScene('Stage').isTutorial, null, { timeout: 5000 }).catch(() => fail('tutorial did not follow the intro'));
console.log('✓ intro leads into the tutorial');
await wait(800);
await check((await ev(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')).seenIntro)) === true, 'intro marked as seen');

// ---------- 2. Tutorial ----------
const tut = () => ev(() => { const s = window.__game.scene.getScene('Stage'); return { step: s.tutorial?.current, x: Math.round(s.player.x / 16), gates: [...s.tutorialGates.keys()] }; });
await page.keyboard.down('a'); await wait(300); await page.keyboard.up('a');
await page.keyboard.down('d'); await wait(900); await page.keyboard.up('d');
await check((await tut()).step === 'jump', 'tutorial: move step completes');
await shot('06-tutorial-move');
// Jump and double jump: run right, jumping
await page.keyboard.down('d');
for (let i = 0; i < 8 && (await tut()).step !== 'dash'; i++) { await page.keyboard.down('Space'); await wait(260); await page.keyboard.up('Space'); await wait(60); await page.keyboard.down('Space'); await wait(300); await page.keyboard.up('Space'); await wait(500); }
await page.keyboard.up('d');
await check((await tut()).step === 'dash', 'tutorial: jump and double-jump steps complete');
await page.keyboard.down('Shift'); await wait(80); await page.keyboard.up('Shift'); await wait(200);
await check((await tut()).step === 'ladder', 'tutorial: dash step completes and opens its gate');
// walk to the ladder and climb
await ev(() => { const p = window.__game.scene.getScene('Stage').player; p.body.reset(42 * 16 + 8, 19 * 16); });
await wait(300);
await page.keyboard.down('w'); await wait(2200); await page.keyboard.up('w'); await wait(400);
await page.keyboard.down('d'); await wait(200); await page.keyboard.up('d'); await wait(300);
await check((await tut()).step === 'drop', 'tutorial: ladder step completes');
await shot('07-tutorial-ladder');
await page.keyboard.down('s'); await wait(60); await page.keyboard.down('Space'); await wait(80); await page.keyboard.up('Space'); await page.keyboard.up('s'); await wait(400);
await check((await tut()).step === 'attack', 'tutorial: drop-through step completes');
await wait(300);
await page.mouse.move(1100, 560);
for (const dx of [60, 66, 71]) {
  await ev((x) => { const p = window.__game.scene.getScene('Stage').player; p.body.reset(x * 16 - 14, 19 * 16); }, dx);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) { await wait(250); if (await ev((x) => !window.__game.scene.getScene('Stage').enemies.getChildren().some((e) => e.alive && !e.dying && Math.abs(e.x - (x * 16 + 8)) < 6), dx)) break; }
  await page.mouse.up();
}
await wait(300);
await shot('08-tutorial-attack');
await check((await tut()).step === 'steam', 'tutorial: attack step completes when all dummies are beaten');
await ev(() => { const p = window.__game.scene.getScene('Stage').player; p.body.reset(78 * 16, 19 * 16); });
await wait(600);
// wait for a burst near the dummy for the screenshot
for (let i = 0; i < 40; i++) { if (await ev(() => window.__game.scene.getScene('Stage').vents.isBursting(87 * 16 + 8))) break; await wait(150); }
await wait(300); await shot('09-tutorial-steam');
await ev(() => { const p = window.__game.scene.getScene('Stage').player; p.hp = 999; p.body.reset(96 * 16, 19 * 16); });
await wait(300);
await check((await tut()).step === 'info', 'tutorial: steam step completes');
await shot('10-tutorial-info');
for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await wait(150); }
await page.waitForFunction(() => window.__game.scene.isActive('Menu'), null, { timeout: 5000 }).catch(() => fail('tutorial did not end at the menu'));
await check((await ev(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')).tutorialDone)) === true, 'tutorial ends at the menu and is marked done');
await wait(400); await shot('11-menu');

// ---------- 3. Menu keyboard navigation ----------
await page.keyboard.press('ArrowRight'); await wait(100);
for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowDown'); await wait(60); }
await page.keyboard.press('ArrowUp'); await wait(60);
await shot('12-menu-focus');
await page.keyboard.press('Enter'); await wait(400);
const navScene = (await active()).join(',');
await check(navScene !== 'Menu', `keyboard navigation opens a menu item (${navScene})`);
await ev(() => window.__game.scene.getScenes(true)[0].scene.start('Menu')); await wait(300);

// ---------- 4. Character creator ----------
await ev(() => window.__game.scene.getScene('Menu').scene.start('Character')); await wait(400);
await page.mouse.click(346 * 2, 181 * 2); await wait(100); // name box
for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
await page.keyboard.type('Faris 99!', { delay: 40 });
await page.keyboard.press('Enter'); await wait(100);
await page.mouse.click(426 * 2, 206 * 2); await page.mouse.click(426 * 2, 266 * 2); await page.mouse.click(426 * 2, 286 * 2); // > skin, > shirt, > pants
await wait(200); await shot('13-creator');
await page.mouse.click(532 * 2, 290 * 2); await wait(400);
const saved = await ev(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')));
await check(saved.selectedCharacter === 'custom' && saved.custom.name === 'FARIS 99', `creator saves name and selection (${JSON.stringify(saved.custom)})`);
await shot('14-creator-selected');

// ---------- 5. Stage: custom sprite, keyboard aim, vents, enemy shots, stun, supers ----------
await ev(() => window.__game.scene.getScenes(true)[0].scene.start('Stage', { stageId: 'kovaci' }));
await wait(1500);
const st0 = await ev(() => { const s = window.__game.scene.getScene('Stage'); return { tex: s.player.texture.key, vents: s.vents.count }; });
await check(st0.tex.startsWith('player_custom_'), `player uses the custom sprite (${st0.tex})`);
await check(st0.vents > 0, `stage has sewer vents (${st0.vents})`);

// enemy projectile: slower and outlined
const shotInfo = await ev(() => {
  const s = window.__game.scene.getScene('Stage');
  s.fireHostile({ texture: 'proj_corn', x: s.player.x + 200, y: s.player.y - 40, vx: -200, vy: 0, damage: 1, life: 2 });
  const p = s.eProj.getMatching('active', true).pop();
  return { tex: p.texture.key, vx: Math.round(p.body.velocity.x), w: p.width, life: p.life };
});
await check(shotInfo.tex === 'eproj_corn' && shotInfo.vx === -144 && shotInfo.w === 8, `enemy shot is slower and bigger (${JSON.stringify(shotInfo)})`);

// steam vent hurts an enemy and the player
const steam = await ev(async () => {
  const s = window.__game.scene.getScene('Stage');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  s.mode = 'explore'; s.sectionIdx = 99; // stop the wave flow
  const row = s.plan.cells.findIndex((r) => r.includes(4));
  const col = s.plan.cells[row].indexOf(4);
  const e = s.spawnEnemy(s.stage.enemies[0], col * 16 + 8, (row - 1) * 16);
  s.player.body.reset(col * 16 + 8, (row - 2) * 16);
  s.player.hp = 500; s.player.invuln = 0;
  s.cameras.main.stopFollow(); s.cameras.main.centerOn(col * 16, row * 16 - 60);
  await sleep(700);
  e.stun(99); // keep it standing on the grate
  e.body.reset(col * 16 + 8, (row - 1) * 16);
  await sleep(200);
  window.__steamDbg = { ex: e.x, eb: e.body.bottom, top: row * 16, x0: col * 16, vul: e.vulnerable, ai: e.ai };
  s.player.invuln = 0; s.player.body.reset(col * 16 + 16, (row - 1) * 16);
  const hp0 = e.hp, php0 = s.player.hp;
  s.vents.triggerAll();
  let shot = false;
  for (let i = 0; i < 40; i++) { await sleep(60); if (s.vents.isBursting(col * 16 + 8)) { if (!shot) { shot = true; window.__steamShot = true; } } }
  return { enemyBefore: hp0, enemyAfter: e.hp, playerBefore: php0, playerAfter: s.player.hp, burst: shot, dbg: window.__steamDbg, eAfter: { x: e.x, b: e.body.bottom, alive: e.alive } };
});
await check(steam.burst && steam.enemyAfter < steam.enemyBefore && steam.playerAfter < steam.playerBefore, `steam hurts enemies and the player (${JSON.stringify(steam)})`);
await ev(() => window.__game.scene.getScene('Stage').vents.triggerAll()); await wait(1050); await shot('15-steam-burst');

// Tepsija stun
const stun = await ev(async () => {
  const s = window.__game.scene.getScene('Stage');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  s.enemies.children.each((e) => { if (e.alive) e.kill(); return true; });
  s.player.body.reset(30 * 16, 19 * 16);
  s.cameras.main.startFollow(s.player);
  s.weapon = { parts: [{ id: 'tepsija', tier: 1 }] }; s.weapons.setWeapon(s.weapon);
  const e = s.spawnEnemy(s.stage.enemies[0], 30 * 16 + 40, 19 * 16);
  await sleep(600);
  e.hp = e.maxHp = 9999;
  s.weapons.timers = s.weapons.timers.map(() => 0);
  s.weapons.update(0.016, true);
  for (let i = 0; i < 20 && e.stunT <= 0; i++) await sleep(50);
  return { stunT: e.stunT };
});
await check(stun.stunT > 0, `Tepsija shockwave stuns (${stun.stunT.toFixed(2)}s)`);
await wait(200); await shot('16-stun');

// Super pick at level 3 (once per stage)
await ev(() => { const s = window.__game.scene.getScene('Stage'); s.enemies.children.each((e) => { if (e.alive) e.kill(); return true; }); s.xp = { level: 3, xp: 0, pendingLevelUps: 1 }; });
await page.waitForFunction(() => window.__game.scene.isActive('Super'), null, { timeout: 3000 }).catch(() => fail('super pick did not open at level 3'));
await wait(400); await shot('17-super-pick');
await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await wait(100);
await ev(() => { const sc = window.__game.scene.getScene('Super'); sc.confirm.press(); });
await page.waitForFunction(() => window.__game.scene.isActive('LevelUp'), null, { timeout: 3000 }).catch(() => fail('level-up did not follow the super pick'));
await wait(500); await shot('17b-levelup'); await levelUpByKeys();
await wait(300);
await check(!(await active()).includes('LevelUp'), 'level-up can be completed with the keyboard only');
const sup = await ev(() => { const s = window.__game.scene.getScene('Stage'); return { id: s.superId, charge: s.meter.charge, parts: s.weapon.parts.reduce((a, p) => a + p.tier, 0) }; });
await check(!!sup.id && sup.charge === 14 && sup.parts === 2, `a super is picked and starts charged (${JSON.stringify(sup)})`);
await ev(() => { const s = window.__game.scene.getScene('Stage'); s.xp = { level: 4, xp: 0, pendingLevelUps: 1 }; });
await wait(400);
await check((await active()).includes('LevelUp') && !(await active()).includes('Super'), 'second level-up does not offer another super');
await levelUpByKeys();
await wait(300);

// Fire every super once with enemies around; nothing may throw. (No XP, so no level-up pauses the test.)
await ev(() => { const s = window.__game.scene.getScene('Stage'); s.player.stats = { ...s.player.stats, xpMult: 0 }; s.xp = { ...s.xp, pendingLevelUps: 0 }; });
await wait(200);
const supers = ['rucka', 'cevapi', 'dzezva', 'fildzan', 'kisobran', 'tepsija', 'golub', 'zvono', 'burek', 'lokum', 'fenjer', 'sudzuk'];
for (const id of supers) {
  if (id === 'rucka') page.waitForFunction(() => window.__tramShot, null, { timeout: 5000 }).then(() => shot('18-super-tram')).catch(() => {});
  const r = await ev(async (sid) => {
    const s = window.__game.scene.getScene('Stage');
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    s.player.hp = 999;
    s.enemies.children.each((e) => { if (e.alive) e.kill(); return true; });
    const es = [-120, -60, 60, 120, 180].map((dx) => s.spawnEnemy(s.stage.enemies[0], s.player.x + dx, s.player.y - 20)).filter(Boolean);
    await sleep(600);
    es.forEach((e) => { e.hp = e.maxHp = 100000; });
    s.superId = sid; s.meter = { charge: 14 };
    s.useSuper();
    if (sid === 'rucka') { await sleep(500); window.__tramShot = true; await sleep(900); } else await sleep(900);
    const dmg = es.reduce((a, e) => a + (e.maxHp - e.hp), 0);
    return { charge: s.meter.charge, dmg };
  }, id);
  if (id === 'kisobran') await shot('19-super-umbrella');
  if (id === 'fenjer') await shot('20-super-fireworks');
  await check(r.charge === 0 && r.dmg > 0, `super ${id} fires and deals damage (${r.dmg})`);
  await wait(900);
}

// Keyboard aim: attack goes the way the character faces
await ev(() => { const s = window.__game.scene.getScene('Stage'); s.player.keyboardAim = true; });
await page.keyboard.down('a'); await wait(200); await page.keyboard.up('a'); await wait(100);
const aimL = await ev(() => window.__game.scene.getScene('Stage').player.aim);
await page.keyboard.down('d'); await wait(200);
await page.keyboard.down('w'); await wait(80);
const aimUR = await ev(() => window.__game.scene.getScene('Stage').player.aim);
await page.keyboard.up('w'); await page.keyboard.up('d');
await check(Math.abs(Math.abs(aimL) - Math.PI) < 0.01 && Math.abs(aimUR + Math.PI / 4) < 0.01, `keyboard aim follows facing (${aimL.toFixed(2)}, ${aimUR.toFixed(2)})`);

// ---------- 6. Ending: beating the last boss for the first time ----------
await ev(() => {
  const save = JSON.parse(localStorage.getItem('gameofsarajevo.save'));
  const order = window.__game.scene.getScene('Stage').constructor && ['kovaci', 'bistrik', 'skenderija', 'marijin_dvor', 'grbavica', 'malta', 'cengic_vila', 'hrasno', 'pofalici', 'ciglane', 'kosevo', 'alipasino_polje'];
  save.cleared = order; localStorage.setItem('gameofsarajevo.save', JSON.stringify(save));
});
await page.reload();
await page.waitForFunction(() => window.__game?.scene.isActive('Menu'), null, { timeout: 15000 });
await ev(() => window.__game.scene.getScene('Menu').startStage('dobrinja'));
await wait(1500);
await ev(async () => {
  const s = window.__game.scene.getScene('Stage');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  s.player.hp = 99999;
  while (s.sectionIdx < 5) { s.director = null; s.enemies.children.each((e) => { if (e.alive) e.kill(); return true; }); if (s.mode === 'combat') s.endSection(); s.player.body.reset((s.plan.sections[s.sectionIdx].x0 + 4) * 16, 19 * 16); await sleep(200); }
  s.player.body.reset((s.plan.sections[5].x0 + 4) * 16, 19 * 16);
  for (let i = 0; i < 40 && !s.boss; i++) await sleep(100);
  await sleep(2000);
  s.boss.hp = 1; s.hitEnemy(s.boss, 50, s.player.x, s.player.y, 0);
});
await page.waitForFunction(() => window.__game.scene.isActive('Result'), null, { timeout: 8000 }).catch(() => fail('no result screen after the last boss'));
await wait(400); await shot('21-result-final');
await ev(() => window.__game.scene.getScene('Result').children.list.filter((o) => o.press).pop().press());
await page.waitForFunction(() => window.__game.scene.isActive('Cutscene') && window.__game.scene.getScene('Cutscene').kind === 'ending', null, { timeout: 4000 }).catch(() => fail('ending cutscene did not play'));
console.log('✓ beating the last boss plays the ending');
await wait(1500); await shot('22-ending-dawn');
await page.waitForFunction(() => window.__game.scene.getScene('Cutscene').idx === 1, null, { timeout: 12000 }); await wait(2600); await shot('23-ending-bosses');
await page.waitForFunction(() => window.__game.scene.getScene('Cutscene').idx === 2, null, { timeout: 12000 }).catch(() => fail('ending finale beat not reached'));
await wait(2500); await shot('24-ending-confetti');
const fin = await ev(() => JSON.parse(localStorage.getItem('gameofsarajevo.save')).seenEnding);
await check(fin === true, 'ending marked as seen');
await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('Menu'), null, { timeout: 5000 }).catch(() => fail('ending did not return to the menu'));
await wait(300); await shot('25-menu-after');

if (errors.length) await fail('page errors:\n' + errors.join('\n'));
console.log('ALL FEATURE CHECKS PASSED');
await browser.close();
server.close();
