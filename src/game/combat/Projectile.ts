import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';

export type ProjMotion = 'straight' | 'arc' | 'boomerang' | 'homing' | 'bouncer' | 'wave' | 'bomb' | 'trap' | 'roll' | 'sine';

export interface ProjConfig {
  texture: string;
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  life: number;
  motion?: ProjMotion;
  gravity?: number;
  pierce?: number;
  tint?: number;
  spin?: number;
  range?: number;     // boomerang outward distance
  turn?: number;      // homing turn rate
  bounces?: number;
  knockback?: number;
  scale?: number;
  source?: number;    // behavior id for hit cooldown bookkeeping
}

/** Pooled projectile used by both the player and enemies. */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  life = 0;
  motion: ProjMotion = 'straight';
  pierce = 1;
  spin = 0;
  range = 0;
  turn = 0;
  bounces = 0;
  knockback = 60;
  speed = 0;
  returning = false;
  startX = 0; startY = 0;
  hit = new Set<Enemy>();
  source = 0;

  fire(c: ProjConfig): void {
    this.enableBody(true, c.x, c.y, true, true);
    this.setTexture(c.texture);
    this.setScale(c.scale ?? 1).setAlpha(1).setDepth(25);
    if (c.tint !== undefined) this.setTint(c.tint); else this.clearTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(!!c.gravity);
    body.setGravityY(c.gravity ? c.gravity - 900 : 0); // world gravity is 900
    body.setVelocity(c.vx, c.vy);
    body.setBounce(c.motion === 'bouncer' ? 0.7 : c.motion === 'roll' ? 0.35 : 0);
    body.setSize(Math.max(4, this.width - 2), Math.max(4, this.height - 2));
    this.damage = c.damage;
    this.life = c.life;
    this.motion = c.motion ?? 'straight';
    this.pierce = c.pierce ?? 1;
    this.spin = c.spin ?? 0;
    this.range = c.range ?? 0;
    this.turn = c.turn ?? 0;
    this.bounces = c.bounces ?? 0;
    this.knockback = c.knockback ?? 60;
    this.speed = Math.hypot(c.vx, c.vy);
    this.returning = false;
    this.startX = c.x; this.startY = c.y;
    this.source = c.source ?? 0;
    this.hit.clear();
    this.setRotation(this.spin ? 0 : Math.atan2(c.vy, c.vx));
  }

  get body2(): Phaser.Physics.Arcade.Body { return this.body as Phaser.Physics.Arcade.Body; }

  kill(): void { this.hit.clear(); this.disableBody(true, true); }
}
