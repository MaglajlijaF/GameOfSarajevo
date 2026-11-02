import Phaser from 'phaser';
import type { EnemyDef } from '../../core/types';
import type { World } from '../world';

const PROJ_GRAVITY = 520;

/** Pooled enemy. `spawn()` reinitialises it; `kill()` returns it to the pool. */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def!: EnemyDef;
  hp = 0;
  maxHp = 0;
  damage = 0;
  alive = false;
  dying = false;
  isBoss = false;
  private t = 0;          // generic state timer
  private cd = 0;         // attack cooldown
  private ai: 'move' | 'windup' | 'attack' | 'charge' | 'stun' | 'spawn' = 'move';
  private dir = 1;
  slowT = 0; slowFactor = 1;
  burnT = 0; burnDps = 0; burnTick = 0;
  flashT = 0;
  hitTimers = new Map<number, number>(); // per-source hit cooldowns (orbit weapons)
  kbT = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy_prodavac', 0);
  }

  spawn(def: EnemyDef, x: number, y: number, difficulty: number): void {
    this.def = def;
    this.setTexture(def.sprite, 0);
    this.enableBody(true, x, y, true, true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 19).setOffset(7, 4);
    body.setAllowGravity(true);
    body.setMaxVelocity(400, 520);
    body.setVelocity(0, 0);
    this.maxHp = Math.round(def.hp * difficulty);
    this.hp = this.maxHp;
    this.damage = Math.round(def.damage * (0.85 + difficulty * 0.15));
    this.alive = true;
    this.dying = false;
    this.ai = 'spawn';
    this.t = 0.45;
    this.cd = 0.6 + Math.random() * 0.8;
    this.slowT = 0; this.burnT = 0; this.flashT = 0; this.kbT = 0;
    this.hitTimers.clear();
    this.setAlpha(0).setDepth(15).clearTint().setScale(1).setAngle(0);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 300 });
    this.play(`${def.sprite}_idle`);
  }

  get body2(): Phaser.Physics.Arcade.Body { return this.body as Phaser.Physics.Arcade.Body; }
  get onGround(): boolean { return this.body2.blocked.down; }
  get vulnerable(): boolean { return this.alive && !this.dying && this.ai !== 'spawn'; }

  tick(dt: number, w: World): void {
    if (!this.alive) return;
    if (this.dying) return;
    const b = this.body2;
    const p = w.player;
    const speedMul = this.slowT > 0 ? this.slowFactor : 1;
    this.slowT = Math.max(0, this.slowT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.kbT = Math.max(0, this.kbT - dt);
    for (const [k, v] of this.hitTimers) { if (v - dt <= 0) this.hitTimers.delete(k); else this.hitTimers.set(k, v - dt); }
    this.cd -= dt * speedMul;
    this.t -= dt * speedMul;

    // tint feedback: hit flash > burn > slow
    if (this.flashT > 0) this.setTintFill(0xffffff);
    else if (this.burnT > 0) this.setTint(Math.floor(this.burnT * 10) % 2 ? 0xff9a5a : 0xffffff);
    else if (this.slowT > 0) this.setTint(0xf5b0d8);
    else this.clearTint();

    if (this.ai === 'spawn') { b.setVelocityX(0); if (this.t <= 0) this.ai = 'move'; return; }
    if (this.kbT > 0) { this.anim('hurt'); return; }

    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const adx = Math.abs(dx);
    const prm = this.def.params;
    const spd = this.def.speed * speedMul;
    const towards = Math.sign(dx) || 1;

    switch (this.def.behavior) {
      case 'walker': {
        if (this.ai === 'windup') {
          b.setVelocityX(0);
          this.anim('attack');
          if (this.t <= 0) {
            if (adx < prm.attackRange + 6 && Math.abs(dy) < 22) p.hurt(this.damage, this.x);
            this.ai = 'move';
            this.cd = prm.attackCooldown;
          }
          break;
        }
        this.dir = towards;
        b.setVelocityX(adx > 8 ? this.dir * spd : 0);
        this.jumpIfBlocked(prm.jumpPower, dy);
        if (adx < prm.attackRange && Math.abs(dy) < 20 && this.cd <= 0) { this.ai = 'windup'; this.t = 0.35; }
        this.anim(this.onGround ? (Math.abs(b.velocity.x) > 5 ? 'run' : 'idle') : 'jump');
        break;
      }
      case 'thrower': {
        const keep = prm.keepDistance;
        let mv = 0;
        if (adx < keep - 25) mv = -towards; else if (adx > keep + 40) mv = towards;
        this.dir = towards;
        b.setVelocityX(mv * spd);
        this.jumpIfBlocked(prm.jumpPower, dy);
        if (this.cd <= 0 && adx < 320) {
          this.cd = prm.throwCooldown * (0.8 + Math.random() * 0.4);
          const t = Phaser.Math.Clamp(adx / prm.throwSpeed, 0.45, 1.2);
          const vx = dx / t;
          const vy = (dy - 0.5 * PROJ_GRAVITY * t * t) / t;
          w.fireEnemyProjectile(this.def.projectile ?? 'corn', this.x + this.dir * 6, this.y - 6, vx, vy, PROJ_GRAVITY, this.damage);
          this.ai = 'attack'; this.t = 0.25;
        }
        if (this.ai === 'attack') { this.anim('attack'); if (this.t <= 0) this.ai = 'move'; }
        else this.anim(this.onGround ? (mv !== 0 ? 'run' : 'idle') : 'jump');
        break;
      }
      case 'jumper': {
        if (this.onGround) {
          b.setVelocityX(b.velocity.x * 0.8);
          if (this.cd <= 0) {
            this.dir = towards;
            const up = dy < -30 ? 1.15 : 1;
            b.setVelocity(this.dir * Math.min(prm.hopSpeed, adx * 1.6 + 30) * speedMul, -prm.hopPower * up);
            this.cd = prm.hopCooldown * (0.8 + Math.random() * 0.4);
          }
          this.anim('idle');
        } else this.anim(b.velocity.y < 0 ? 'jump' : 'fall');
        break;
      }
      case 'charger': {
        if (this.ai === 'windup') {
          b.setVelocityX(0);
          this.x += Math.sin(this.t * 80) * 0.6;
          this.anim('attack');
          if (this.t <= 0) { this.ai = 'charge'; this.t = prm.chargeTime; }
          break;
        }
        if (this.ai === 'charge') {
          b.setVelocityX(this.dir * prm.chargeSpeed * speedMul);
          this.anim('run');
          if (Math.random() < 0.3) w.puff(this.x - this.dir * 6, this.y + 10, 1, 0xd8cfbf);
          if (b.blocked.left || b.blocked.right) { this.ai = 'stun'; this.t = 0.7; w.shake(0.004, 120); }
          else if (this.t <= 0) { this.ai = 'move'; this.cd = prm.chargeCooldown; }
          break;
        }
        if (this.ai === 'stun') { b.setVelocityX(0); this.anim('hurt'); if (this.t <= 0) { this.ai = 'move'; this.cd = prm.chargeCooldown; } break; }
        this.dir = towards;
        b.setVelocityX(adx > 10 ? this.dir * spd : 0);
        this.jumpIfBlocked(prm.jumpPower, dy);
        if (adx < prm.chargeRange && Math.abs(dy) < 26 && this.cd <= 0 && this.onGround) { this.ai = 'windup'; this.t = prm.windup; }
        this.anim(Math.abs(b.velocity.x) > 5 ? 'run' : 'idle');
        break;
      }
      default:
        b.setVelocityX(towards * spd);
    }
    this.setFlipX(this.dir < 0);
  }

  get charging(): boolean { return this.ai === 'charge'; }

  private jumpIfBlocked(power: number, dy: number) {
    const b = this.body2;
    if (!this.onGround) return;
    const blocked = (b.blocked.left && b.velocity.x <= 0) || (b.blocked.right && b.velocity.x >= 0);
    const playerAbove = dy < -50 && Math.random() < 0.02;
    if (blocked || playerAbove) b.setVelocityY(-power);
  }

  private anim(name: string) { this.anims.play(`${this.def.sprite}_${name}`, true); }

  /** Applies damage and knockback. Returns true if this killed the enemy. */
  hurt(amount: number, kx: number, ky: number): boolean {
    if (!this.vulnerable) return false;
    this.hp -= amount;
    this.flashT = 0.08;
    if (kx || ky) {
      const resist = this.def.behavior === 'charger' ? 0.4 : 1;
      this.body2.setVelocity(kx * resist, Math.min(this.body2.velocity.y, ky * resist));
      this.kbT = 0.12;
      if (this.ai === 'windup') { this.ai = 'move'; this.cd = 0.5; }
    }
    if (this.hp <= 0) { this.startDying(); return true; }
    return false;
  }

  private startDying() {
    this.dying = true;
    this.clearTint();
    this.body2.setVelocity(-this.dir * 60, -160);
    this.anims.play(`${this.def.sprite}_defeat`);
    this.scene.time.delayedCall(900, () => {
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 250, onComplete: () => this.kill() });
    });
  }

  kill(): void {
    this.alive = false;
    this.dying = false;
    this.disableBody(true, true);
  }
}
