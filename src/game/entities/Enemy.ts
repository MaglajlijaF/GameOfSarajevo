import Phaser from 'phaser';
import type { EnemyDef } from '../../core/types';
import type { World } from '../world';

const PROJ_GRAVITY = 520;

export interface EnemyScale { hp: number; dmg: number; aggro: number }

type Ai = 'move' | 'windup' | 'attack' | 'charge' | 'stun' | 'spawn' | 'hang' | 'drop' | 'spin' | 'aim';

/**
 * Pooled enemy. `spawn()` reinitialises it; `kill()` returns it to the pool.
 * Behaviour comes from enemies.json (`behavior` + `params`), so new enemy types
 * are mostly data: a sprite recipe plus a behaviour with tuned numbers.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def!: EnemyDef;
  hp = 0;
  maxHp = 0;
  damage = 0;
  alive = false;
  dying = false;
  isBoss = false;
  protected t = 0;
  protected cd = 0;
  protected ai: Ai = 'move';
  protected dir = 1;
  protected aggro = 1;
  slowT = 0; slowFactor = 1;
  burnT = 0; burnDps = 0; burnTick = 0;
  buffT = 0;
  flashT = 0;
  hitTimers = new Map<number, number>();
  kbT = 0;
  private spinHitT = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy_prodavac', 0);
  }

  spawn(def: EnemyDef, x: number, y: number, scale: EnemyScale): void {
    this.def = def;
    this.setTexture(def.sprite, 0);
    this.enableBody(true, x, y, true, true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 19).setOffset(7, 4);
    body.setAllowGravity(true);
    body.setMaxVelocity(460, 520);
    body.setVelocity(0, 0);
    this.maxHp = Math.round(def.hp * scale.hp);
    this.hp = this.maxHp;
    this.damage = Math.round(def.damage * scale.dmg);
    this.aggro = scale.aggro;
    this.alive = true;
    this.dying = false;
    this.ai = 'spawn';
    this.t = 0.45;
    this.cd = (0.6 + Math.random() * 0.8) / this.aggro;
    this.slowT = 0; this.burnT = 0; this.flashT = 0; this.kbT = 0; this.buffT = 0;
    this.hitTimers.clear();
    this.setAlpha(0).setDepth(15).clearTint().setScale(1).setAngle(0);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 300 });
    if (def.behavior === 'dropper') {
      // Rappels in from above the arena.
      body.reset(x, 40);
      body.setAllowGravity(false);
      this.ai = 'hang';
      this.t = 3;
    }
    this.play(`${def.sprite}_idle`);
  }

  get body2(): Phaser.Physics.Arcade.Body { return this.body as Phaser.Physics.Arcade.Body; }
  get onGround(): boolean { return this.body2.blocked.down; }
  get vulnerable(): boolean { return this.alive && !this.dying && this.ai !== 'spawn'; }
  get charging(): boolean { return this.ai === 'charge' || this.ai === 'spin' || this.ai === 'drop'; }
  protected p(name: string, d: number): number { return this.def.params[name] ?? d; }

  tick(dt: number, w: World): void {
    if (!this.alive || this.dying) return;
    const b = this.body2;
    const pl = w.player;
    const buffed = this.buffT > 0;
    const speedMul = (this.slowT > 0 ? this.slowFactor : 1) * (buffed ? 1.35 : 1);
    this.slowT = Math.max(0, this.slowT - dt);
    this.buffT = Math.max(0, this.buffT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.kbT = Math.max(0, this.kbT - dt);
    for (const [k, v] of this.hitTimers) { if (v - dt <= 0) this.hitTimers.delete(k); else this.hitTimers.set(k, v - dt); }
    this.cd -= dt * speedMul * this.aggro;
    this.t -= dt * speedMul;

    if (this.flashT > 0) this.setTintFill(0xffffff);
    else if (this.burnT > 0) this.setTint(Math.floor(this.burnT * 10) % 2 ? 0xff9a5a : 0xffffff);
    else if (this.slowT > 0) this.setTint(0xf5b0d8);
    else if (buffed) this.setTint(0xffe080);
    else if (this.ai === 'windup' || this.ai === 'aim') this.setTint(Math.floor(this.t * 16) % 2 ? 0xffb0a0 : 0xffffff);
    else this.clearTint();

    if (this.ai === 'spawn') { b.setVelocityX(0); if (this.t <= 0) this.ai = 'move'; return; }
    if (this.kbT > 0 && this.ai !== 'hang') { this.anim('hurt'); return; }

    const dx = pl.x - this.x;
    const dy = pl.y - this.y;
    const adx = Math.abs(dx);
    const spd = this.def.speed * speedMul;
    const towards = Math.sign(dx) || 1;
    const dmg = Math.round(this.damage * (buffed ? 1.3 : 1));

    switch (this.def.behavior) {
      case 'walker': case 'shielder': {
        if (this.ai === 'windup') {
          b.setVelocityX(0); this.anim('attack');
          if (this.t <= 0) {
            if (this.def.behavior === 'shielder') { b.setVelocityX(this.dir * 260); this.ai = 'charge'; this.t = 0.25; }
            else { if (adx < this.p('attackRange', 20) + 8 && Math.abs(dy) < 22) pl.hurt(dmg, this.x); this.ai = 'move'; this.cd = this.p('attackCooldown', 1.3); }
          }
          break;
        }
        if (this.ai === 'charge') { // shield bash lunge
          this.anim('attack');
          if (adx < 18 && Math.abs(dy) < 22) pl.hurt(dmg, this.x);
          if (this.t <= 0) { this.ai = 'move'; this.cd = this.p('attackCooldown', 1.6); }
          break;
        }
        this.dir = towards;
        b.setVelocityX(adx > 8 ? this.dir * spd : 0);
        this.jumpIfBlocked(this.p('jumpPower', 300), dy);
        const range = this.def.behavior === 'shielder' ? 46 : this.p('attackRange', 20);
        if (adx < range && Math.abs(dy) < 20 && this.cd <= 0) { this.ai = 'windup'; this.t = this.p('windup', 0.35); }
        this.animMove();
        break;
      }
      case 'thrower': case 'bomber': case 'roller': {
        this.keepDistance(this.p('keepDistance', 130), towards, adx, spd, dy);
        if (this.cd <= 0 && adx < 340) {
          this.cd = this.p('throwCooldown', 2.2) * (0.8 + Math.random() * 0.4);
          const kind = this.def.projectile ?? 'corn';
          const ox = this.x + this.dir * 6, oy = this.y - 6;
          if (this.def.behavior === 'roller') {
            w.fireHostile({ texture: `proj_${kind}`, x: ox, y: this.body2.bottom - 6, vx: this.dir * this.p('throwSpeed', 170), vy: -60, damage: dmg, life: 4, motion: 'roll', gravity: 700, bounces: 8, spin: 12 * this.dir });
          } else {
            const t = Phaser.Math.Clamp(adx / this.p('throwSpeed', 190), 0.45, 1.2);
            const vx = dx / t, vy = (dy - 0.5 * PROJ_GRAVITY * t * t) / t;
            const burst = Math.round(this.p('burst', 1));
            for (let i = 0; i < burst; i++) {
              w.fireHostile({ texture: `proj_${kind}`, x: ox, y: oy, vx: vx * (1 + (i - (burst - 1) / 2) * 0.18), vy, damage: dmg, life: 4, motion: this.def.behavior === 'bomber' ? 'bomb' : 'arc', gravity: PROJ_GRAVITY, spin: 8, range: this.p('blast', 30) });
            }
          }
          this.ai = 'attack'; this.t = 0.25;
        }
        if (this.ai === 'attack') { this.anim('attack'); if (this.t <= 0) this.ai = 'move'; } else this.animMove();
        break;
      }
      case 'shooter': case 'summoner': {
        this.keepDistance(this.p('keepDistance', 150), towards, adx, spd, dy);
        if (this.ai === 'windup') {
          b.setVelocityX(0); this.anim('attack');
          if (this.t <= 0) {
            const kind = `proj_${this.def.projectile ?? 'spark'}`;
            if (this.def.behavior === 'summoner') {
              const n = Math.round(this.p('count', 2));
              for (let i = 0; i < n; i++) w.fireHostile({ texture: kind, x: this.x, y: this.y - 12, vx: (i - (n - 1) / 2) * 80, vy: -120, damage: Math.round(dmg * 0.7), life: this.p('life', 5), motion: 'homing', turn: this.p('turn', 3), pierce: 1 });
            } else {
              const n = Math.round(this.p('burst', 1));
              const a = Phaser.Math.Angle.Between(this.x, this.y - 4, pl.x, pl.y);
              const spread = Phaser.Math.DegToRad(this.p('spread', 10));
              for (let i = 0; i < n; i++) {
                const ang = a + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
                const sp = this.p('shotSpeed', 200);
                w.fireHostile({ texture: kind, x: this.x + this.dir * 6, y: this.y - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, damage: dmg, life: 3, motion: this.p('sine', 0) ? 'sine' : 'straight' });
              }
            }
            this.ai = 'move'; this.cd = this.p('shotCooldown', 2);
          }
          break;
        }
        if (this.cd <= 0 && adx < 360) { this.ai = 'windup'; this.t = 0.35; }
        this.animMove();
        break;
      }
      case 'sniper': {
        this.keepDistance(this.p('keepDistance', 220), towards, adx, spd * 0.7, dy);
        if (this.ai === 'aim') {
          b.setVelocityX(0); this.anim('attack');
          if (this.t <= 0) {
            const a = Phaser.Math.Angle.Between(this.x, this.y - 4, pl.x, pl.y);
            const sp = this.p('shotSpeed', 480);
            w.fireHostile({ texture: `proj_${this.def.projectile ?? 'spark'}`, x: this.x, y: this.y - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, damage: Math.round(dmg * 1.4), life: 2, motion: 'straight' });
            this.ai = 'move'; this.cd = this.p('shotCooldown', 3);
          }
          break;
        }
        if (this.cd <= 0 && adx < 420) {
          const ms = this.p('aimTime', 0.8);
          this.ai = 'aim'; this.t = ms;
          w.aimLine(this.x, this.y - 4, Phaser.Math.Angle.Between(this.x, this.y - 4, pl.x, pl.y), ms * 1000);
        }
        this.animMove();
        break;
      }
      case 'jumper': {
        if (this.onGround) {
          b.setVelocityX(b.velocity.x * 0.8);
          if (this.cd <= 0) {
            this.dir = towards;
            const up = dy < -30 ? 1.15 : 1;
            b.setVelocity(this.dir * Math.min(this.p('hopSpeed', 120), adx * 1.6 + 30) * speedMul, -this.p('hopPower', 340) * up);
            this.cd = this.p('hopCooldown', 1.1) * (0.8 + Math.random() * 0.4);
          }
          this.anim('idle');
        } else this.anim(b.velocity.y < 0 ? 'jump' : 'fall');
        break;
      }
      case 'charger': case 'dasher': {
        const dasher = this.def.behavior === 'dasher';
        if (this.ai === 'windup') {
          b.setVelocityX(0);
          this.x += Math.sin(this.t * 80) * 0.6;
          this.anim('attack');
          if (this.t <= 0) {
            this.ai = 'charge'; this.t = this.p('chargeTime', dasher ? 0.5 : 0.9);
            if (dasher && dy < -30) b.setVelocityY(-this.p('jumpPower', 330));
          }
          break;
        }
        if (this.ai === 'charge') {
          b.setVelocityX(this.dir * this.p('chargeSpeed', dasher ? 300 : 210) * speedMul);
          if (dasher) b.setAllowGravity(dy > -30);
          this.anim('run');
          if (Math.random() < 0.3) w.puff(this.x - this.dir * 6, this.y + 10, 1, 0xd8cfbf);
          const wall = b.blocked.left || b.blocked.right || b.touching.left || b.touching.right;
          if (wall && !dasher) { this.ai = 'stun'; this.t = 0.7; w.shake(0.004, 120); b.setAllowGravity(true); }
          else if (this.t <= 0 || wall) { this.ai = 'move'; this.cd = this.p('chargeCooldown', 2.4); b.setAllowGravity(true); }
          break;
        }
        if (this.ai === 'stun') { b.setVelocityX(0); this.anim('hurt'); if (this.t <= 0) { this.ai = 'move'; this.cd = this.p('chargeCooldown', 2.4); } break; }
        this.dir = towards;
        b.setVelocityX(adx > 10 ? this.dir * spd : 0);
        this.jumpIfBlocked(this.p('jumpPower', 260), dy);
        if (adx < this.p('chargeRange', 170) && (dasher || Math.abs(dy) < 26) && this.cd <= 0 && this.onGround) { this.ai = 'windup'; this.t = this.p('windup', dasher ? 0.35 : 0.55); }
        this.animMove();
        break;
      }
      case 'buffer': {
        this.keepDistance(this.p('keepDistance', 160), towards, adx, spd, dy);
        if (this.cd <= 0) {
          this.cd = this.p('buffCooldown', 4);
          const r = this.p('radius', 120);
          w.ring(this.x, this.y, r, 0xffd040);
          for (const e of w.enemiesNear(this.x, this.y, r)) e.buffT = this.p('buffTime', 3);
          this.ai = 'attack'; this.t = 0.4;
        }
        if (this.ai === 'attack') { this.anim('attack'); b.setVelocityX(0); if (this.t <= 0) this.ai = 'move'; } else this.animMove();
        break;
      }
      case 'dropper': {
        if (this.ai === 'hang') {
          // Track the player from above, then drop.
          b.setVelocity(Phaser.Math.Clamp(dx * 3, -spd * 2, spd * 2), 0);
          this.anim('fall');
          if ((adx < 14 && dy > 0) || this.t <= 0) { this.ai = 'drop'; b.setAllowGravity(true); b.setVelocity(0, 380); }
          break;
        }
        if (this.ai === 'drop') {
          this.anim('fall');
          if (this.onGround) {
            w.shake(0.005, 120); w.puff(this.x, this.body2.bottom, 8, 0xd8cfbf);
            w.explode(this.x, this.body2.bottom - 6, this.p('blast', 32), dmg, 0xffd8a0);
            this.ai = 'stun'; this.t = 0.6;
          }
          break;
        }
        if (this.ai === 'stun') { b.setVelocityX(0); this.anim('hurt'); if (this.t <= 0) this.ai = 'move'; break; }
        this.dir = towards;
        b.setVelocityX(adx > 8 ? this.dir * spd : 0);
        this.jumpIfBlocked(this.p('jumpPower', 300), dy);
        if (adx < 20 && Math.abs(dy) < 20 && this.cd <= 0) { pl.hurt(dmg, this.x); this.cd = 1.2; }
        this.animMove();
        break;
      }
      case 'spinner': {
        if (this.ai === 'spin') {
          this.angle += dt * 1400 * this.dir;
          b.setVelocityX(this.dir * spd * 0.8);
          this.spinHitT -= dt;
          if (adx < this.p('radius', 26) && Math.abs(dy) < 26 && this.spinHitT <= 0) { pl.hurt(dmg, this.x); this.spinHitT = 0.3; }
          if (this.t <= 0) { this.ai = 'stun'; this.t = 0.8; this.angle = 0; }
          break;
        }
        if (this.ai === 'stun') { b.setVelocityX(0); this.anim('hurt'); if (this.t <= 0) { this.ai = 'move'; this.cd = this.p('spinCooldown', 2.5); } break; }
        this.dir = towards;
        b.setVelocityX(adx > 8 ? this.dir * spd : 0);
        this.jumpIfBlocked(this.p('jumpPower', 300), dy);
        if (adx < 60 && Math.abs(dy) < 24 && this.cd <= 0) { this.ai = 'spin'; this.t = this.p('spinTime', 1.4); this.spinHitT = 0; }
        this.animMove();
        break;
      }
      default:
        b.setVelocityX(towards * spd);
    }
    if (this.ai !== 'spin') this.setFlipX(this.dir < 0);
  }

  private keepDistance(keep: number, towards: number, adx: number, spd: number, dy: number) {
    let mv = 0;
    if (adx < keep - 25) mv = -towards; else if (adx > keep + 40) mv = towards;
    this.dir = towards;
    if (this.ai !== 'windup' && this.ai !== 'aim') this.body2.setVelocityX(mv * spd);
    this.jumpIfBlocked(this.p('jumpPower', 280), dy);
  }

  private animMove() {
    const b = this.body2;
    this.anim(this.onGround ? (Math.abs(b.velocity.x) > 5 ? 'run' : 'idle') : b.velocity.y < 0 ? 'jump' : 'fall');
  }

  private jumpIfBlocked(power: number, dy: number) {
    const b = this.body2;
    if (!this.onGround) return;
    const blocked = (b.blocked.left && b.velocity.x <= 0) || (b.blocked.right && b.velocity.x >= 0);
    const playerAbove = dy < -50 && Math.random() < 0.025 * this.aggro;
    if (blocked || playerAbove) b.setVelocityY(-power);
  }

  protected anim(name: string) { this.anims.play(`${this.def.sprite}_${name}`, true); }

  /**
   * Applies damage and knockback. `fromX` lets shielders block frontal hits.
   * Returns true if this killed the enemy.
   */
  hurt(amount: number, kx: number, ky: number, fromX?: number): boolean {
    if (!this.vulnerable) return false;
    if (this.def.behavior === 'shielder' && fromX !== undefined && this.ai !== 'charge' && Math.sign(fromX - this.x) === this.dir) {
      amount = Math.max(1, Math.round(amount * 0.15));
      kx *= 0.2;
      this.blocked = true;
    } else this.blocked = false;
    this.hp -= amount;
    this.flashT = 0.08;
    if (kx || ky) {
      const resist = this.def.behavior === 'charger' || this.def.behavior === 'shielder' ? 0.4 : 1;
      this.body2.setVelocity(kx * resist, Math.min(this.body2.velocity.y, ky * resist));
      this.kbT = 0.12;
      if (this.ai === 'windup' || this.ai === 'aim') { this.ai = 'move'; this.cd = 0.5; }
    }
    if (this.hp <= 0) { this.startDying(); return true; }
    return false;
  }
  /** True if the last hit was blocked by a shield (for feedback). */
  blocked = false;

  protected startDying() {
    this.dying = true;
    this.clearTint();
    this.angle = 0;
    this.body2.setAllowGravity(true);
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
