import Phaser from 'phaser';
import { G, type RunSummary } from '../services';
import { buildLevel, CELL, type Cell, type LevelPlan, type Section, LEVEL_H } from '../../core/level';
import { TILE } from '../../art/tiles';
import { Controls } from '../controls';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Projectile, type ProjConfig } from '../combat/Projectile';
import { WeaponSystem, type CombatHost } from '../combat/WeaponSystem';
import { Hud } from '../Hud';
import { COLORS, text } from '../ui/ui';
import { WaveDirector } from '../../core/waves';
import { addXp, consumeLevelUp, createXpState, xpProgress, type XpState } from '../../core/xp';
import { applyBuff, statsFromUpgrades, type PlayerStats } from '../../core/stats';
import { createWeapon, mergeWeapon, offerWeapons, weaponName, type CompositeWeapon } from '../../core/weapons';
import { applyStageResult } from '../../core/save';
import { Rng, hashString } from '../../core/rng';
import type { StageDef } from '../../core/types';
import { audio } from '../../audio/audio';
import tuning from '../../data/tuning.json';
import type { World } from '../world';

const TS = 16;

type Mode = 'explore' | 'combat' | 'boss' | 'victory' | 'defeat';

export class StageScene extends Phaser.Scene implements World, CombatHost {
  stage!: StageDef;
  plan!: LevelPlan;
  controls!: Controls;
  player!: Player;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private enemies!: Phaser.Physics.Arcade.Group;
  private boss: Boss | null = null;
  private pProj!: Phaser.Physics.Arcade.Group;
  private eProj!: Phaser.Physics.Arcade.Group;
  private gates!: Phaser.Physics.Arcade.StaticGroup;
  private gateVis: Phaser.GameObjects.TileSprite[] = [];
  private bg: { sprite: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private hud!: Hud;
  private weapons!: WeaponSystem;
  private weapon!: CompositeWeapon;
  private baseStats!: PlayerStats;
  private xp: XpState = createXpState();
  private mode: Mode = 'explore';
  private sectionIdx = 0;
  private director: WaveDirector | null = null;
  private kills = 0;
  private rng!: Rng;
  private hazardTiles: Phaser.Tilemaps.Tile[] = [];
  private hazardT = 0;
  private targetsCache: Enemy[] = [];
  private numbers: Phaser.GameObjects.BitmapText[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private puffs!: Phaser.GameObjects.Particles.ParticleEmitter;
  private inLevelUp = false;
  private ended = false;
  private currentSection: Section | null = null;
  private homingT = 0;

  constructor() { super('Stage'); }

  init(data: { stageId: string }): void {
    this.stage = G.data.stages[data.stageId];
    this.mode = 'explore';
    this.sectionIdx = 0;
    this.director = null;
    this.kills = 0;
    this.xp = createXpState();
    this.boss = null;
    this.inLevelUp = false;
    this.ended = false;
    this.gateVis = [];
    this.bg = [];
    this.hazardTiles = [];
    this.numbers = [];
    this.currentSection = null;
    this.rng = new Rng(hashString(data.stageId) ^ Date.now());
  }

  create(): void {
    const st = this.stage;
    this.plan = buildLevel(st, G.data.layouts);
    const W = this.plan.width * TS, H = LEVEL_H * TS;
    this.physics.world.gravity.y = tuning.gravity;
    this.physics.world.setBounds(0, 0, W, H + 64);
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.setBackgroundColor('#0b0b14');
    this.cameras.main.fadeIn(300);

    // Parallax background
    for (const [layer, f] of [['sky', 0.05], ['far', 0.2], ['mid', 0.45]] as const) {
      const s = this.add.tileSprite(0, 0, 640, 360, `bg_${st.theme}_${layer}`).setOrigin(0).setScrollFactor(0).setDepth(-10 + this.bg.length);
      // Push background layers back so the playfield reads clearly.
      if (layer === 'mid') s.setTint(0xa8a8bc);
      if (layer === 'far') s.setTint(0xc8d0d8);
      this.bg.push({ sprite: s, f });
    }

    this.buildTilemap();
    this.controls = new Controls(this, G.save.settings.keybinds);

    // Player
    const ch = G.data.characters.find((c) => c.id === G.save.selectedCharacter) ?? G.data.characters[0];
    this.baseStats = statsFromUpgrades(G.save.upgrades, G.data.shop.upgrades);
    this.player = new Player(this, this.plan.playerSpawn.x * TS + 8, this.plan.playerSpawn.y * TS, ch.sprite, this.baseStats);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 20);

    // Pools
    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: 64, runChildUpdate: false });
    this.pProj = this.physics.add.group({ classType: Projectile, maxSize: 320, runChildUpdate: false });
    this.eProj = this.physics.add.group({ classType: Projectile, maxSize: 160, runChildUpdate: false });
    this.gates = this.physics.add.staticGroup();

    // Weapon
    this.weapon = createWeapon(G.save.selectedStarter);
    this.weapons = new WeaponSystem(this, G.data.weapons);
    this.weapons.setWeapon(this.weapon);

    this.setupColliders();

    // FX
    this.sparks = this.add.particles(0, 0, 'fx_px', { speed: { min: 40, max: 140 }, lifespan: 300, scale: { start: 1, end: 0 }, gravityY: 300, emitting: false }).setDepth(30);
    this.puffs = this.add.particles(0, 0, 'fx_puff', { speed: { min: 10, max: 50 }, lifespan: 450, scale: { start: 0.8, end: 0 }, alpha: { start: 0.8, end: 0 }, emitting: false }).setDepth(30);
    for (let i = 0; i < 40; i++) this.numbers.push(text(this, 0, 0, '', { origin: [0.5, 1] }).setDepth(60).setVisible(false));

    this.hud = new Hud(this);
    this.hud.setWeapon(this.weapons.textureKey, weaponName(this.weapon, G.data.weapons, (k) => G.i18n.maybe(k)));
    this.updateWaveHud();
    this.hud.showArrow(true);
    this.hud.flash(st.name, G.t('hud.wave', { n: 1, total: 5 }), 1600);

    audio.playMusic(st.music);

    // Pause on ESC and when the window loses focus
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.controls.destroy();
      this.weapons.destroy();
    });
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.controls.flush(); this.inLevelUp = false; });
  }

  private onBlur() { if (!this.ended && this.scene.isActive()) this.openPause(); }

  // ---------- Level ----------
  private buildTilemap() {
    const { cells, width } = this.plan;
    const rng = new Rng(hashString(this.stage.id));
    const data: number[][] = cells.map((row, y) => row.map((c, x) => {
      switch (c) {
        case CELL.SOLID: return y > 0 && cells[y - 1][x] !== CELL.SOLID ? TILE.TOP : rng.chance(0.3) ? TILE.FILL2 : TILE.FILL;
        case CELL.ONEWAY: return TILE.PLATFORM;
        case CELL.LADDER: return TILE.LADDER;
        case CELL.HAZARD: return TILE.HAZARD_A;
        default: return -1;
      }
    }));
    const map = this.make.tilemap({ data, tileWidth: TS, tileHeight: TS, width, height: LEVEL_H });
    const tiles = map.addTilesetImage(`tiles_${this.stage.theme}`, `tiles_${this.stage.theme}`, TS, TS, 0, 0)!;
    this.layer = map.createLayer(0, tiles, 0, 0)!;
    this.layer.setDepth(5);
    this.layer.setCollision([TILE.TOP, TILE.FILL, TILE.FILL2]);
    this.layer.forEachTile((t) => {
      if (t.index === TILE.PLATFORM) t.setCollision(false, false, true, false, false);
      if (t.index === TILE.HAZARD_A) this.hazardTiles.push(t);
    });
    this.layer.calculateFacesWithin(0, 0, width, LEVEL_H);
  }

  cellAt(px: number, py: number): Cell {
    const x = Math.floor(px / TS), y = Math.floor(py / TS);
    if (y < 0 || y >= LEVEL_H || x < 0 || x >= this.plan.width) return CELL.EMPTY;
    return this.plan.cells[y][x];
  }

  private setupColliders() {
    const isPlatform = (t: unknown) => (t as Phaser.Tilemaps.Tile).index === TILE.PLATFORM;
    this.physics.add.collider(this.player, this.layer, undefined, (_p, t) => !(isPlatform(t) && (this.player.dropT > 0 || this.player.climbing)), this);
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.collider(this.player, this.gates);
    this.physics.add.collider(this.enemies, this.gates);
    // Player projectiles vs terrain
    this.physics.add.collider(this.pProj, this.layer, (o) => {
      const p = o as Projectile;
      if (p.motion === 'bouncer') { p.bounces--; if (p.bounces < 0) p.kill(); }
    }, (o, t) => {
      const p = o as Projectile;
      if (p.motion === 'bouncer') return true;
      if (p.motion === 'straight' && !isPlatform(t)) { this.sparkAt(p.x, p.y, 0xd8cfbf, 3); p.kill(); }
      return false;
    }, this);
    this.physics.add.collider(this.eProj, this.layer, undefined, (o, t) => {
      const p = o as Projectile;
      if (p.motion !== 'wave' && !isPlatform(t)) { this.puff(p.x, p.y, 3, 0xd8cfbf); p.kill(); }
      return false;
    }, this);
    this.physics.add.overlap(this.pProj, this.enemies, (a, b) => this.projHit(a as Projectile, b as unknown as Enemy));
    this.physics.add.overlap(this.eProj, this.player, (a) => {
      const pr = (a instanceof Projectile ? a : null);
      if (!pr || !pr.active) return;
      if (this.player.hurt(pr.damage, pr.x)) this.shake(0.006, 120);
      if (pr.motion !== 'wave') pr.kill();
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const en = e as unknown as Enemy;
      if (!en.vulnerable) return;
      const f = en.isBoss ? 0.8 : en.charging ? 1.4 : tuning.enemyContactFactor;
      if (this.player.hurt(Math.round(en.damage * f), en.x)) this.shake(0.006, 120);
    });
  }

  private projHit(p: Projectile, e: Enemy) {
    if (!p.active || !e.vulnerable || p.hit.has(e)) return;
    p.hit.add(e);
    const kb = p.knockback * (p.body2.velocity.x >= 0 ? 1 : -1);
    this.hitEnemy(e, p.damage, e.x - Math.sign(kb || 1) * 10, e.y, Math.abs(kb));
    p.pierce--;
    if (p.pierce <= 0) p.kill();
  }

  // ---------- CombatHost ----------
  get self(): Phaser.Scene { return this; }
  targets(): Enemy[] { return this.targetsCache; }
  enemyProjectiles(): Projectile[] { return this.eProj.getMatching('active', true) as Projectile[]; }

  firePlayer(cfg: ProjConfig): Projectile | null {
    const p = this.pProj.get(cfg.x, cfg.y) as Projectile | null;
    if (!p) return null;
    p.fire(cfg);
    return p;
  }

  hitEnemy(e: Enemy, base: number, fromX: number, _fromY: number, knockback: number, chained = false): void {
    if (!e.vulnerable) return;
    const dmg = Math.max(1, Math.round(base * this.player.stats.damageMult * (0.9 + Math.random() * 0.2)));
    const dir = Math.sign(e.x - fromX) || 1;
    const killed = e.hurt(dmg, dir * knockback, -knockback * 0.6);
    this.number(e.x, e.y - 12, String(dmg), chained ? 0xf2d64b : 0xffffff);
    this.sparkAt(e.x, e.y, 0xffffff, 4);
    audio.play('hit');
    const m = this.weapons.mods;
    if (m.slow) { e.slowT = m.slow.duration; e.slowFactor = m.slow.factor; }
    if (m.burn) { e.burnT = m.burn.duration; e.burnDps = m.burn.dps * this.player.stats.damageMult; }
    if (m.chain && !chained) {
      const others = this.targetsCache.filter((o) => o !== e && o.vulnerable && Phaser.Math.Distance.Between(o.x, o.y, e.x, e.y) <= m.chain!.range)
        .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, e.x, e.y) - Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y))
        .slice(0, m.chain.jumps);
      let from = { x: e.x, y: e.y };
      for (const o of others) {
        this.zap(from.x, from.y, o.x, o.y);
        this.hitEnemy(o, base * m.chain.damageFrac, from.x, from.y, 0, true);
        from = { x: o.x, y: o.y };
      }
    }
    if (killed) this.onKill(e);
  }

  ring(x: number, y: number, radius: number, color: number): void {
    const r = this.add.image(x, y, 'fx_ring').setTint(color).setDepth(30).setScale(0.2);
    this.tweens.add({ targets: r, scale: (radius * 2) / 32, alpha: 0, duration: 300, onComplete: () => r.destroy() });
  }

  private zap(x0: number, y0: number, x1: number, y1: number) {
    const g = this.add.graphics().setDepth(31);
    g.lineStyle(2, 0xfff0a0, 1);
    g.beginPath();
    g.moveTo(x0, y0);
    for (let i = 1; i < 4; i++) g.lineTo(x0 + ((x1 - x0) * i) / 4 + (Math.random() - 0.5) * 10, y0 + ((y1 - y0) * i) / 4 + (Math.random() - 0.5) * 10);
    g.lineTo(x1, y1);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
  }

  // ---------- World ----------
  fireEnemyProjectile(kind: string, x: number, y: number, vx: number, vy: number, gravity: number, damage: number): void {
    const p = this.eProj.get(x, y) as Projectile | null;
    if (!p) return;
    p.fire({ texture: `proj_${kind}`, x, y, vx, vy, damage, life: 4, motion: 'arc', gravity, spin: 8 });
  }

  groundWave(x: number, y: number, dir: number, speed: number, damage: number, hostile: boolean): void {
    const cfg: ProjConfig = { texture: 'proj_wave', x, y, vx: dir * speed, vy: 0, damage, life: 1.8, motion: 'wave', pierce: 99, tint: hostile ? 0xff7a2a : undefined };
    if (hostile) { const p = this.eProj.get(x, y) as Projectile | null; p?.fire(cfg); }
    else this.firePlayer(cfg);
  }

  spawnEnemy(id: string, x: number, y: number): void {
    const def = G.data.enemies[id];
    if (!def) return;
    const e = this.enemies.get(x, y) as Enemy | null;
    if (!e) return;
    e.spawn(def, x, y, this.stage.difficulty);
    this.puff(x, y, 8, 0xffffff);
  }

  shake(intensity: number, ms = 150): void { this.cameras.main.shake(ms, intensity); }

  puff(x: number, y: number, n = 6, tint = 0xffffff): void {
    this.puffs.particleTint = tint;
    this.puffs.explode(n, x, y);
  }

  private sparkAt(x: number, y: number, tint: number, n: number) {
    this.sparks.particleTint = tint;
    this.sparks.explode(n, x, y);
  }

  warnMarker(x: number, y: number, ms: number): void {
    const m = this.add.image(x, y, 'fx_star').setTint(0xff4a3a).setDepth(29).setScale(1.5);
    this.tweens.add({ targets: m, alpha: 0.2, duration: 100, yoyo: true, repeat: Math.floor(ms / 200), onComplete: () => m.destroy() });
  }

  arenaBounds(): { left: number; right: number } {
    const s = this.currentSection ?? this.plan.sections[this.plan.sections.length - 1];
    return { left: s.x0 * TS + 16, right: s.x1 * TS - 16 };
  }

  private number(x: number, y: number, s: string, tint: number) {
    const t = this.numbers.find((n) => !n.visible);
    if (!t) return;
    t.setText(s).setPosition(x + (Math.random() - 0.5) * 8, y).setTint(tint).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 550, ease: 'Cubic.Out', onComplete: () => t.setVisible(false) });
  }

  // ---------- Flow ----------
  private aliveCount(): number {
    let n = 0;
    this.enemies.children.each((c) => { const e = c as unknown as Enemy; if (e.alive && !e.dying && !e.isBoss) n++; return true; });
    return n;
  }

  private startSection(s: Section) {
    this.currentSection = s;
    this.hud.showArrow(false);
    const x0 = s.x0 * TS, x1 = s.x1 * TS;
    // Gates on both arena edges
    for (const gx of [x0 + 4, x1 - 4]) {
      const z = this.add.zone(gx, (LEVEL_H * TS) / 2, 8, LEVEL_H * TS * 2);
      this.gates.add(z);
      const vis = this.add.tileSprite(gx, 0, 16, LEVEL_H * TS, `tiles_${this.stage.theme}`, TILE.GATE).setOrigin(0.5, 0).setDepth(6).setAlpha(0);
      this.tweens.add({ targets: vis, alpha: 1, duration: 250 });
      this.gateVis.push(vis);
    }
    audio.play('gate');
    // Lock the camera to the arena
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(x0 + 320, cam.midPoint.y, 350, 'Sine.easeInOut', true, (_c, prog) => {
      if (prog === 1) { cam.setBounds(x0, 0, x1 - x0, LEVEL_H * TS); cam.startFollow(this.player, true, 0.12, 0.12, 0, 20); }
    });
    if (s.kind === 'arena') {
      this.mode = 'combat';
      this.director = new WaveDirector(this.stage.waves[s.wave], this.rng.int(1, 1e9));
      this.hud.flash(G.t('hud.waveStart', { n: s.wave + 1 }), '', 900);
      audio.play('wave');
    } else {
      this.mode = 'boss';
      this.startBoss(s);
    }
    this.updateWaveHud();
  }

  private endSection() {
    this.gates.clear(true, true);
    this.gateVis.forEach((v) => this.tweens.add({ targets: v, alpha: 0, duration: 300, onComplete: () => v.destroy() }));
    this.gateVis = [];
    this.director = null;
    this.currentSection = null;
    this.sectionIdx++;
    this.mode = 'explore';
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.plan.width * TS, LEVEL_H * TS);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 20);
    this.player.heal(Math.round(this.player.stats.maxHp * 0.1));
    this.hud.flash(G.t('hud.waveClear'), this.sectionIdx < 5 ? G.t('hud.wave', { n: this.sectionIdx + 1, total: 5 }) : G.t('hud.bossIncoming'), 1200, COLORS.green);
    this.hud.showArrow(true);
    audio.play('gate');
    this.updateWaveHud();
  }

  private startBoss(s: Section) {
    const def = G.data.bosses[this.stage.boss];
    const pos = s.bossSpawn ?? { x: s.x0 + 30, y: 18 };
    const boss = new Boss(this, pos.x * TS, pos.y * TS - 16);
    this.add.existing(boss);
    this.physics.add.existing(boss);
    this.enemies.add(boss);
    boss.spawnBoss(def, pos.x * TS, pos.y * TS - 16, this.stage.difficulty);
    boss.onPhaseChange = () => this.hud.flash(G.t(`boss.${def.id}`), '!!!', 900, COLORS.red);
    this.boss = boss;
    this.hud.setBoss(G.t(`boss.${def.id}`));
    this.hud.flash(G.t(`boss.${def.id}`), G.t(`boss.${def.id}.intro`), 1800, COLORS.red);
    audio.play('boss');
    audio.playMusic({ ...this.stage.music, seed: this.stage.music.seed + 1, tempo: this.stage.music.tempo + 24 });
  }

  private onKill(e: Enemy) {
    this.kills++;
    audio.play('kill');
    this.puff(e.x, e.y, 6, 0xffffff);
    this.sparkAt(e.x, e.y - 8, 0xf2d64b, 8);
    const xp = e.isBoss ? (G.data.bosses[this.stage.boss]?.xp ?? 0) : e.def.xp;
    const r = addXp(this.xp, xp, this.player.stats.xpMult);
    this.xp = r.state;
    this.number(e.x, e.y - 22, `+${Math.round(xp * this.player.stats.xpMult)} XP`, 0x6ab0f0);
    if (e.isBoss) this.victory();
  }

  private victory() {
    if (this.mode === 'victory') return;
    this.mode = 'victory';
    this.hud.setBoss(null);
    audio.stopMusic();
    audio.play('victory');
    this.enemies.children.each((c) => { const e = c as unknown as Enemy; if (e.alive && !e.isBoss && !e.dying) e.hurt(99999, 0, -100); return true; });
    this.eProj.children.each((c) => { (c as Projectile).kill(); return true; });
    this.hud.flash(G.t('result.victory'), '', 2000, COLORS.gold);
    this.time.delayedCall(2600, () => this.finish('victory'));
  }

  private finish(outcome: RunSummary['outcome']) {
    if (this.ended) return;
    this.ended = true;
    audio.stopMusic();
    const res = applyStageResult(G.save, G.ctx, this.stage.id, outcome, this.kills);
    G.update(res.save);
    const summary: RunSummary = { stageId: this.stage.id, outcome, kills: this.kills, level: this.xp.level };
    if (outcome === 'quit') { this.scene.start('Menu'); return; }
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Result', { summary, reward: res.reward, unlocked: res.unlockedStage }));
  }

  quit(): void { this.finish('quit'); }

  private openPause() {
    if (this.inLevelUp || this.ended || this.mode === 'victory' || this.mode === 'defeat') return;
    this.scene.pause();
    this.scene.launch('Pause');
  }

  private openLevelUp() {
    this.inLevelUp = true;
    const offers = offerWeapons(this.weapon, G.data.weapons, this.rng);
    audio.play('levelup');
    this.scene.pause();
    this.scene.launch('LevelUp', {
      level: this.xp.level - this.xp.pendingLevelUps + 1,
      weapon: this.weapon,
      offers,
      onPick: (weaponId: string | null, buffId: string) => this.applyLevelUp(weaponId, buffId),
    });
  }

  private applyLevelUp(weaponId: string | null, buffId: string) {
    this.xp = consumeLevelUp(this.xp);
    if (weaponId) {
      this.weapon = mergeWeapon(this.weapon, weaponId, G.data.weapons);
      this.weapons.setWeapon(this.weapon);
      const name = weaponName(this.weapon, G.data.weapons, (k) => G.i18n.maybe(k));
      this.hud.setWeapon(this.weapons.textureKey, name);
      this.ring(this.player.x, this.player.y, 40, 0xf2d64b);
    }
    const buff = G.data.buffs[buffId];
    if (buff) {
      this.player.setStats(applyBuff(this.player.stats, buff));
      if (buff.heal) this.player.heal(buff.heal);
    }
  }

  private updateWaveHud() {
    const s = this.plan.sections[Math.min(this.sectionIdx, this.plan.sections.length - 1)];
    const label = s.kind === 'boss' ? G.t('hud.boss') : G.t('hud.wave', { n: s.wave + 1, total: 5 });
    const remaining = this.director ? this.director.remainingToSpawn + this.aliveCount() : 0;
    this.hud.setWave(label, this.mode === 'combat' ? G.t('hud.enemies', { n: remaining }) : '');
  }

  // ---------- Update ----------
  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    this.controls.update();
    if (this.controls.justDown('pause')) { this.openPause(); return; }

    // targets cache (vulnerable enemies incl. boss)
    this.targetsCache.length = 0;
    this.enemies.children.each((c) => { const e = c as unknown as Enemy; if (e.vulnerable) this.targetsCache.push(e); return true; });

    this.player.tick(dt, this);
    const attacking = this.controls.isDown('attack') && this.mode !== 'victory';
    this.weapons.update(dt, attacking);

    this.enemies.children.each((c) => {
      const e = c as unknown as Enemy;
      if (!e.active) return true;
      e.tick(dt, this);
      if (e.burnT > 0 && e.vulnerable) {
        e.burnT -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.33;
          const d = Math.max(1, Math.round(e.burnDps * 0.33));
          this.number(e.x, e.y - 12, String(d), 0xff7a2a);
          this.sparkAt(e.x, e.y - 6, 0xff7a2a, 2);
          if (e.hurt(d, 0, 0)) this.onKill(e);
        }
      }
      if (e.y > LEVEL_H * TS + 40 && e.alive) e.kill();
      return true;
    });

    this.updateProjectiles(dt);
    this.updateFlow(dt);

    // Hazard tile animation
    this.hazardT -= dt;
    if (this.hazardT <= 0) {
      this.hazardT = 0.2;
      for (const t of this.hazardTiles) t.index = t.index === TILE.HAZARD_A ? TILE.HAZARD_B : TILE.HAZARD_A;
    }

    // Parallax
    const cam = this.cameras.main;
    for (const l of this.bg) l.sprite.tilePositionX = cam.scrollX * l.f;

    // Level ups
    if (this.xp.pendingLevelUps > 0 && !this.inLevelUp && !this.player.dead && this.mode !== 'victory') this.openLevelUp();

    // Defeat
    if (this.player.dead && this.mode !== 'defeat' && this.mode !== 'victory') {
      this.mode = 'defeat';
      audio.stopMusic();
      audio.play('defeat');
      this.hud.flash(G.t('result.defeat'), '', 2000, COLORS.red);
      this.time.delayedCall(2000, () => this.finish('defeat'));
    }
    if (this.player.y > LEVEL_H * TS + 30 && !this.player.dead) {
      this.player.hurt(20, this.player.x, true);
      this.player.setPosition(this.player.x, 100);
    }

    this.hud.update({
      hp: this.player.hp, maxHp: this.player.stats.maxHp, xpFrac: xpProgress(this.xp), level: this.xp.level,
      dashFrac: 1 - this.player.dashCd / tuning.dashCooldown,
      bossFrac: this.boss ? this.boss.hp / this.boss.maxHp : 0, phase: this.boss?.phase ?? 0,
    });
  }

  private updateFlow(dt: number) {
    if (this.mode === 'explore') {
      const s = this.plan.sections[this.sectionIdx];
      if (s && this.player.x > (s.x0 + 2) * TS && !this.player.dead) this.startSection(s);
    } else if (this.mode === 'combat' && this.director) {
      const alive = this.aliveCount();
      const toSpawn = this.director.update(dt, alive);
      for (const id of toSpawn) {
        const pt = this.pickSpawn(this.currentSection!);
        this.spawnEnemy(id, pt.x, pt.y);
      }
      this.updateWaveHud();
      if (this.director.isCleared(this.aliveCount())) this.endSection();
    }
  }

  private pickSpawn(s: Section): { x: number; y: number } {
    const pts = s.spawns.map((p) => ({ x: p.x * TS + 8, y: p.y * TS }));
    const far = pts.filter((p) => Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) > 110);
    const pool = far.length ? far : pts;
    return pool[this.rng.int(0, pool.length - 1)];
  }

  private updateProjectiles(dt: number) {
    this.homingT -= dt;
    const retarget = this.homingT <= 0;
    if (retarget) this.homingT = 0.12;
    const step = (c: Phaser.GameObjects.GameObject, friendly: boolean) => {
      const p = c as Projectile;
      if (!p.active) return true;
      p.life -= dt;
      if (p.life <= 0 || p.y > LEVEL_H * TS + 40 || p.x < -40 || p.x > this.plan.width * TS + 40) { p.kill(); return true; }
      const b = p.body2;
      if (p.spin) p.rotation += p.spin * dt;
      switch (p.motion) {
        case 'boomerang': {
          if (!p.returning && Phaser.Math.Distance.Between(p.x, p.y, p.startX, p.startY) >= p.range) { p.returning = true; p.hit.clear(); }
          if (p.returning) {
            const a = Phaser.Math.Angle.Between(p.x, p.y, this.player.x, this.player.y);
            b.setVelocity(Math.cos(a) * p.speed * 1.1, Math.sin(a) * p.speed * 1.1);
            if (Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) < 12) p.kill();
          }
          break;
        }
        case 'homing': {
          if (retarget && this.targetsCache.length) {
            let best: Enemy | null = null; let bd = 260;
            for (const e of this.targetsCache) { const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
            if (best) {
              const cur = Math.atan2(b.velocity.y, b.velocity.x);
              const want = Phaser.Math.Angle.Between(p.x, p.y, best.x, best.y);
              const na = Phaser.Math.Angle.RotateTo(cur, want, p.turn * 0.12);
              b.setVelocity(Math.cos(na) * p.speed, Math.sin(na) * p.speed);
            }
          }
          p.setRotation(Math.atan2(b.velocity.y, b.velocity.x));
          p.setFlipY(b.velocity.x < 0);
          break;
        }
        case 'wave':
          p.setScale(1 + Math.sin(p.life * 30) * 0.15, 1.2);
          break;
        default:
          break;
      }
      if (!friendly) return true;
      return true;
    };
    this.pProj.children.each((c) => step(c, true));
    this.eProj.children.each((c) => step(c, false));
  }
}
