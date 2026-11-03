import Phaser from 'phaser';
import { audio } from '../../audio/audio';
import type { Enemy } from '../entities/Enemy';
import type { CombatHost } from './WeaponSystem';

export interface SuperHost extends CombatHost {
  /** Vulnerable enemies inside the camera view. */
  onScreen(): Enemy[];
  zap(x0: number, y0: number, x1: number, y1: number): void;
  shake(intensity: number, ms?: number): void;
  puff(x: number, y: number, n?: number, tint?: number): void;
  /** Base damage of one super hit, scaled to the stage so supers stay useful late. */
  superPower(): number;
  /** Friendly area blast (fireworks). */
  blast(x: number, y: number, radius: number, damage: number, tint: number): void;
}

/** One super per weapon. Ids match weapons.json; names/descriptions live in the language files. */
export const SUPER_IDS = ['rucka', 'cevapi', 'dzezva', 'fildzan', 'kisobran', 'tepsija', 'golub', 'zvono', 'burek', 'lokum', 'fenjer', 'sudzuk'] as const;

interface Ongoing { t: number; update(dt: number): void; end(): void }

/** Runs super attacks. Effects that last over time are ticked from update(). */
export class Supers {
  private ongoing: Ongoing[] = [];

  constructor(private h: SuperHost) {}

  get busy(): boolean { return this.ongoing.length > 0; }

  fire(id: string): void {
    const h = this.h, p = h.player, P = h.superPower();
    const s = h.self;
    audio.play('super');
    h.ring(p.x, p.y, 70, 0xf2d64b);
    s.cameras.main.flash(120, 255, 240, 160);
    switch (id) {
      case 'rucka': this.tram(P); break;
      case 'cevapi':
        for (let w = 0; w < 3; w++) s.time.delayedCall(w * 220, () => {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + w * 0.2;
            h.firePlayer({ texture: 'proj_cevapi', x: p.x, y: p.y - 2, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, damage: P * 0.8, life: 1.1, pierce: 3, scale: 2 });
          }
          audio.play('shoot');
        });
        break;
      case 'dzezva':
        for (let k = 0; k < 8; k++) s.time.delayedCall(k * 150, () => {
          for (let i = 0; i < 7; i++) {
            const dir = i % 2 ? 1 : -1;
            const a = -Math.PI / 2 + dir * (0.35 + (i / 7) * 0.9);
            h.firePlayer({ texture: 'proj_coffee', x: p.x, y: p.y - 6, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, damage: P * 0.6, life: 1.4, motion: 'bouncer', gravity: 600, bounces: 0, pierce: 2, scale: 2 });
          }
          audio.play('shoot');
        });
        break;
      case 'fildzan':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          h.firePlayer({ texture: 'proj_fildzan', x: p.x, y: p.y - 2, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, damage: P * 1.2, life: 3, motion: 'boomerang', range: 180, pierce: 99, spin: 16, scale: 2 });
        }
        break;
      case 'kisobran': this.umbrellas(P); break;
      case 'tepsija': {
        h.shake(0.02, 700);
        audio.play('slam');
        for (const e of h.onScreen()) { h.hitEnemy(e, P * 1.5, p.x, p.y, 120); e.stun(2.5); }
        for (const dir of [-1, 1]) h.firePlayer({ texture: 'proj_wave', x: p.x + dir * 8, y: p.body2.bottom - 4, vx: dir * 260, vy: 0, damage: P, life: 1.4, motion: 'wave', pierce: 99, scale: 2, stun: 1.5, tint: 0xfff0a0 });
        break;
      }
      case 'golub':
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + (i - 6.5) * 0.25;
          h.firePlayer({ texture: 'proj_pigeon', x: p.x, y: p.y - 6, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, damage: P, life: 3, motion: 'homing', turn: 7 });
        }
        break;
      case 'zvono':
        for (let k = 0; k < 3; k++) s.time.delayedCall(k * 300, () => {
          h.ring(p.x, p.y, 150, 0xf2d64b);
          audio.play('pulse');
          for (const e of h.targets()) if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) <= 158) h.hitEnemy(e, P * 1.2, p.x, p.y, 300);
          for (const pr of h.enemyProjectiles()) if (Phaser.Math.Distance.Between(p.x, p.y, pr.x, pr.y) <= 150) pr.kill();
        });
        break;
      case 'burek':
        for (const dir of [-1, 1]) h.firePlayer({ texture: 'proj_burek', x: p.x + dir * 10, y: p.y - 10, vx: dir * 230, vy: -160, damage: P * 2, life: 4, motion: 'bouncer', gravity: 700, bounces: 6, pierce: 99, spin: 10 * dir, scale: 3, knockback: 200 });
        break;
      case 'lokum':
        h.ring(p.x, p.y, 220, 0xf59ac8);
        for (const e of h.onScreen()) { e.slowT = 6; e.slowFactor = 0.25; h.hitEnemy(e, P * 0.5, p.x, p.y, 0); }
        break;
      case 'fenjer': {
        const list = h.onScreen().slice(0, 14);
        list.forEach((e, i) => s.time.delayedCall(i * 110, () => {
          if (!e.vulnerable) return;
          audio.play('firework');
          const cols = [0xff7a2a, 0xf2d64b, 0x6ab0f0, 0xf59ac8, 0x5ad05a];
          h.blast(e.x, e.y - 6, 30, P, cols[i % cols.length]);
          if (e.vulnerable) { e.burnT = 4; e.burnDps = P * 0.4; }
        }));
        break;
      }
      case 'sudzuk': {
        let from = { x: p.x, y: p.y - 4 };
        const list = h.onScreen().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
        list.forEach((e, i) => s.time.delayedCall(i * 70, () => {
          if (!e.vulnerable) return;
          h.zap(from.x, from.y, e.x, e.y);
          h.hitEnemy(e, P * 1.6, from.x, from.y, 60);
          from = { x: e.x, y: e.y };
          audio.play('pulse');
        }));
        break;
      }
    }
  }

  update(dt: number): void {
    for (const o of this.ongoing) { o.t -= dt; o.update(dt); if (o.t <= 0) o.end(); }
    this.ongoing = this.ongoing.filter((o) => o.t > 0);
  }

  destroy(): void { for (const o of this.ongoing) o.end(); this.ongoing = []; }

  /** A tram rolls through the arena at the player's ground level, hitting everything once. */
  private tram(P: number) {
    const h = this.h, s = h.self, p = h.player;
    const cam = s.cameras.main;
    const y = p.body2.bottom;
    const img = s.add.image(cam.worldView.x - 90, y + 1, 'fx_tram').setOrigin(0.5, 1).setDepth(24);
    const hit = new Set<Enemy>();
    const speed = 460;
    let bell = 0;
    audio.play('gate');
    this.ongoing.push({
      t: (cam.worldView.width + 200) / speed,
      update: (dt) => {
        img.x += speed * dt;
        bell -= dt;
        if (bell <= 0) { bell = 0.35; audio.play('gate'); }
        if (Math.random() < 0.6) h.puff(img.x - 40, y - 2, 1, 0xfff0a0);
        for (const e of h.targets()) {
          if (hit.has(e)) continue;
          if (Math.abs(e.x - img.x) < 40 && e.y > y - 70 && e.y < y + 10) { hit.add(e); h.hitEnemy(e, P * 2.5, img.x - 50, e.y, 320); }
        }
      },
      end: () => img.destroy(),
    });
  }

  /** Big umbrellas orbit the player for 5 s; the player can't be hurt meanwhile. */
  private umbrellas(P: number) {
    const h = this.h, s = h.self, p = h.player;
    const imgs = Array.from({ length: 6 }, () => s.add.image(p.x, p.y, 'proj_umbrella').setScale(2.5).setDepth(22));
    const shield = s.add.image(p.x, p.y, 'fx_ring').setScale(1.6).setTint(0xe04a6a).setAlpha(0.4).setDepth(21);
    let ang = 0;
    const cd = new Map<Enemy, number>();
    this.ongoing.push({
      t: 5,
      update: (dt) => {
        ang += dt * 5;
        p.shieldT = Math.max(p.shieldT, 0.1);
        shield.setPosition(p.x, p.y - 2);
        imgs.forEach((im, i) => {
          const a = ang + (i / imgs.length) * Math.PI * 2;
          im.setPosition(p.x + Math.cos(a) * 42, p.y - 2 + Math.sin(a) * 34).setRotation(a + Math.PI / 2);
          for (const e of h.targets()) {
            if ((cd.get(e) ?? 0) > s.time.now) continue;
            if (Phaser.Math.Distance.Between(im.x, im.y, e.x, e.y) < (e.isBoss ? 28 : 18)) { cd.set(e, s.time.now + 400); h.hitEnemy(e, P * 0.8, p.x, p.y, 150); }
          }
        });
      },
      end: () => { imgs.forEach((i) => i.destroy()); shield.destroy(); },
    });
  }
}
