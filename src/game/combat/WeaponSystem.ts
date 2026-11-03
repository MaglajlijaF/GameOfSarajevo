import Phaser from 'phaser';
import { framesToCanvas } from '../../art/pixel';
import { composeWeapon } from '../../art/weaponsArt';
import { hexToInt } from '../../art/palette';
import { hitModifiers, resolveBehaviors, weaponLook, type CompositeWeapon, type HitModifiers, type ResolvedBehavior } from '../../core/weapons';
import type { WeaponDef } from '../../core/types';
import { audio } from '../../audio/audio';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Projectile, ProjConfig } from './Projectile';

export interface CombatHost {
  self: Phaser.Scene;
  player: Player;
  targets(): Enemy[];
  firePlayer(cfg: ProjConfig): Projectile | null;
  hitEnemy(e: Enemy, damage: number, fromX: number, fromY: number, knockback: number): void;
  enemyProjectiles(): Projectile[];
  ring(x: number, y: number, radius: number, color: number): void;
}

/** Creates (once) and returns the texture key for a composite weapon's look. */
export function weaponTexture(scene: Phaser.Scene, w: CompositeWeapon, defs: Record<string, WeaponDef>): string {
  const look = weaponLook(w, defs);
  const key = `weapon_${look.signature}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, framesToCanvas([composeWeapon(look)]));
  return key;
}

const PROJ_TEX: Partial<Record<string, string>> = {
  cevapi: 'proj_cevapi', dzezva: 'proj_coffee', fildzan: 'proj_fildzan', tepsija: 'proj_wave', golub: 'proj_pigeon', burek: 'proj_burek',
};

/** Runs every behavior of the composite weapon. Rendering-agnostic logic lives in core/weapons.ts. */
export class WeaponSystem {
  weapon!: CompositeWeapon;
  behaviors: ResolvedBehavior[] = [];
  mods: HitModifiers = {};
  private timers: number[] = [];
  private orbiters: Phaser.GameObjects.Image[] = [];
  private orbitAngle = 0;
  textureKey = '';

  constructor(private host: CombatHost, private defs: Record<string, WeaponDef>) {}

  setWeapon(w: CompositeWeapon): void {
    this.weapon = w;
    this.behaviors = resolveBehaviors(w, this.defs);
    this.mods = hitModifiers(this.behaviors);
    this.timers = this.behaviors.map((_, i) => this.timers[i] ?? 0);
    this.textureKey = weaponTexture(this.host.self, w, this.defs);
    this.host.player.weapon.setTexture(this.textureKey);
    // Rebuild orbiters
    this.orbiters.forEach((o) => o.destroy());
    this.orbiters = [];
    for (const b of this.behaviors) {
      if (b.kind !== 'orbit') continue;
      for (let i = 0; i < Math.round(b.params.count); i++) this.orbiters.push(this.host.self.add.image(0, 0, 'proj_umbrella').setDepth(22));
    }
  }

  update(dt: number, attacking: boolean): void {
    const p = this.host.player;
    const atkSpeed = p.stats.attackSpeedMult;
    this.behaviors.forEach((b, i) => {
      this.timers[i] = Math.max(0, this.timers[i] - dt * atkSpeed);
      if (b.kind === 'orbit') { this.updateOrbit(dt, b, i); return; }
      if (b.kind.startsWith('mod_')) return;
      if (attacking && this.timers[i] <= 0 && !p.dead && !p.climbing) {
        this.timers[i] = b.cooldown;
        this.fire(b, i);
      }
    });
  }

  private fire(b: ResolvedBehavior, idx: number) {
    const h = this.host;
    const p = h.player;
    const a = p.aim;
    const ox = p.x + Math.cos(a) * 8, oy = p.y - 2 + Math.sin(a) * 8;
    const tint = hexToInt(b.color);
    const prm = b.params;
    const tex = PROJ_TEX[b.id] ?? 'proj_spark';
    switch (b.kind) {
      case 'swing': {
        p.attackAnimT = 0.18;
        audio.play('swing');
        const range = prm.range;
        const half = Phaser.Math.DegToRad(prm.arc / 2);
        const fx = h.self.add.image(p.x, p.y - 2, 'fx_swing').setRotation(a).setDepth(24).setTint(this.swingTint()).setScale(range / 18);
        h.self.tweens.add({ targets: fx, alpha: 0, scale: fx.scale * 1.15, duration: 160, onComplete: () => fx.destroy() });
        for (const e of h.targets()) {
          const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
          const ang = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(p.x, p.y, e.x, e.y) - a));
          if (d <= range + (e.isBoss ? 18 : 8) && (ang <= half || d < 12)) h.hitEnemy(e, b.damage, p.x, p.y, prm.knockback);
        }
        // Swings knock enemy projectiles out of the air.
        for (const pr of h.enemyProjectiles()) {
          const d = Phaser.Math.Distance.Between(p.x, p.y, pr.x, pr.y);
          const ang = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(p.x, p.y, pr.x, pr.y) - a));
          if (d <= range + 6 && ang <= half) pr.kill();
        }
        break;
      }
      case 'projectile':
      case 'spread': {
        const n = Math.round(prm.count);
        const spread = Phaser.Math.DegToRad(prm.spread);
        for (let k = 0; k < n; k++) {
          const off = n === 1 ? 0 : -spread / 2 + (spread * k) / (n - 1);
          const ang = a + off + (b.kind === 'spread' ? (Math.random() - 0.5) * 0.15 : 0);
          const spd = prm.speed * (b.kind === 'spread' ? 0.85 + Math.random() * 0.3 : 1);
          h.firePlayer({ texture: tex, x: ox, y: oy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, damage: b.damage, life: prm.life ?? 1.2, pierce: Math.round(prm.pierce ?? 1), tint: b.kind === 'spread' ? undefined : undefined, source: idx });
        }
        audio.play('shoot');
        break;
      }
      case 'boomerang':
        for (let k = 0; k < Math.round(prm.count); k++) {
          const ang = a + (k - (prm.count - 1) / 2) * 0.35;
          h.firePlayer({ texture: tex, x: ox, y: oy, vx: Math.cos(ang) * prm.speed, vy: Math.sin(ang) * prm.speed, damage: b.damage, life: 3, motion: 'boomerang', range: prm.range, pierce: 99, spin: 14, source: idx });
        }
        audio.play('shoot');
        break;
      case 'homing':
        for (let k = 0; k < Math.round(prm.count); k++) {
          const ang = a + (k - (prm.count - 1) / 2) * 0.6;
          h.firePlayer({ texture: tex, x: ox, y: oy, vx: Math.cos(ang) * prm.speed, vy: Math.sin(ang) * prm.speed, damage: b.damage, life: 2.2, motion: 'homing', turn: prm.turn, source: idx });
        }
        audio.play('shoot');
        break;
      case 'bouncer':
        for (let k = 0; k < Math.round(prm.count); k++) {
          const dir = Math.cos(a) >= 0 ? 1 : -1;
          h.firePlayer({ texture: tex, x: ox, y: oy, vx: dir * prm.speed * (1 - k * 0.2), vy: -120 - k * 60, damage: b.damage, life: 3, motion: 'bouncer', gravity: 700, bounces: Math.round(prm.bounces), pierce: 3, spin: 10 * dir, source: idx });
        }
        audio.play('shoot');
        break;
      case 'shockwave': {
        const fy = p.body2.bottom - 4;
        for (const dir of [-1, 1]) {
          h.firePlayer({ texture: 'proj_wave', x: p.x + dir * 6, y: fy, vx: dir * prm.speed, vy: 0, damage: b.damage, life: prm.life, motion: 'wave', pierce: 99, knockback: 40, source: idx, stun: prm.stun ?? 0, tint: prm.stun ? 0xfff0a0 : undefined });
        }
        h.self.cameras.main.shake(80, 0.003);
        audio.play('slam');
        break;
      }
      case 'pulse': {
        h.ring(p.x, p.y, prm.radius, tint);
        for (const e of h.targets()) {
          if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) <= prm.radius + 8) h.hitEnemy(e, b.damage, p.x, p.y, prm.knockback);
        }
        for (const pr of h.enemyProjectiles()) if (Phaser.Math.Distance.Between(p.x, p.y, pr.x, pr.y) <= prm.radius) pr.kill();
        audio.play('pulse');
        break;
      }
    }
  }

  private swingTint(): number {
    // The swing arc takes on the colour of the most recent merge, so builds look different.
    const last = this.behaviors[this.behaviors.length - 1];
    return last && this.behaviors.length > 1 ? hexToInt(last.color) : 0xffffff;
  }

  private updateOrbit(dt: number, b: ResolvedBehavior, idx: number) {
    const p = this.host.player;
    this.orbitAngle += dt * b.params.spin;
    const os = this.orbiters;
    const r = b.params.radius;
    os.forEach((o, i) => {
      const ang = this.orbitAngle + (i / os.length) * Math.PI * 2;
      o.setPosition(p.x + Math.cos(ang) * r, p.y - 2 + Math.sin(ang) * r * 0.8).setRotation(ang + Math.PI / 2).setVisible(!p.dead);
      if (p.dead) return;
      for (const e of this.host.targets()) {
        const key = 1000 + idx * 16 + i;
        if (e.hitTimers.has(key)) continue;
        if (Phaser.Math.Distance.Between(o.x, o.y, e.x, e.y) < (e.isBoss ? 22 : 12)) {
          e.hitTimers.set(key, b.cooldown);
          this.host.hitEnemy(e, b.damage, p.x, p.y, 90);
        }
      }
    });
  }

  destroy(): void { this.orbiters.forEach((o) => o.destroy()); }
}
