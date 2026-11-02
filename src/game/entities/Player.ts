import Phaser from 'phaser';
import tuning from '../../data/tuning.json';
import { CELL } from '../../core/level';
import type { PlayerStats } from '../../core/stats';
import { audio } from '../../audio/audio';
import type { World } from '../world';

const T = tuning;

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  stats: PlayerStats;
  invuln = 0;
  dashing = 0;
  dashCd = 0;
  jumpsLeft = 1;
  coyote = 0;
  buffer = 0;
  climbing = false;
  dropT = 0;
  hurtT = 0;
  attackAnimT = 0;
  dead = false;
  aim = 0;
  weapon: Phaser.GameObjects.Image;
  private sheet: string;
  private dashDir = 1;
  private ghostT = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, sheet: string, stats: PlayerStats) {
    super(scene, x, y, sheet, 0);
    this.sheet = sheet;
    this.stats = stats;
    this.hp = stats.maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 19).setOffset(7, 4);
    body.setMaxVelocity(T.dashSpeed + 50, T.maxFall);
    this.setDepth(20);
    this.weapon = scene.add.image(x, y, 'icon_rucka').setDepth(21).setOrigin(0.2, 0.5);
    this.play(`${sheet}_idle`);
  }

  get body2(): Phaser.Physics.Arcade.Body { return this.body as Phaser.Physics.Arcade.Body; }
  get onGround(): boolean { return this.body2.blocked.down || this.body2.touching.down; }

  setStats(s: PlayerStats): void {
    const gained = s.maxHp - this.stats.maxHp;
    this.stats = s;
    if (gained > 0) this.hp += gained;
    this.hp = Math.min(this.hp, s.maxHp);
  }

  heal(n: number): void { this.hp = Math.min(this.stats.maxHp, this.hp + n); }

  /** Main per-frame update. dt in seconds. */
  tick(dt: number, w: World): void {
    const b = this.body2;
    const c = w.controls;
    const ptr = this.scene.input.activePointer;
    const wp = this.scene.cameras.main.getWorldPoint(ptr.x, ptr.y);
    this.aim = Phaser.Math.Angle.Between(this.x, this.y - 2, wp.x, wp.y);
    const faceLeft = wp.x < this.x;

    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.attackAnimT = Math.max(0, this.attackAnimT - dt);

    if (this.dead) {
      b.setVelocityX(b.velocity.x * 0.9);
      this.weapon.setVisible(false);
      return;
    }

    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    const grounded = this.onGround;
    if (grounded) { this.coyote = T.coyoteTime; this.jumpsLeft = 1; } else this.coyote -= dt;
    if (c.justDown('jump')) this.buffer = T.jumpBuffer; else this.buffer -= dt;

    // Ladders
    const center = w.cellAt(this.x, this.y);
    const below = w.cellAt(this.x, b.bottom + 4);
    if (!this.climbing && this.dashing <= 0) {
      if ((c.isDown('up') && center === CELL.LADDER) || (c.isDown('down') && (below === CELL.LADDER || (center === CELL.LADDER && !grounded)))) {
        this.climbing = true;
        this.x = Math.floor(this.x / 16) * 16 + 8;
        b.setAllowGravity(false);
        b.setVelocity(0, 0);
      }
    }
    if (this.climbing) {
      this.dropT = 0.1;
      const vy = (c.isDown('down') ? 1 : 0) - (c.isDown('up') ? 1 : 0);
      b.setVelocity(dir * 40, vy * T.climbSpeed);
      const stillOn = w.cellAt(this.x, this.y + 4) === CELL.LADDER || w.cellAt(this.x, b.bottom + 2) === CELL.LADDER;
      if (this.buffer > 0) { this.exitClimb(); this.doJump(T.jumpVelocity); }
      else if (!stillOn) { this.exitClimb(); if (vy < 0) b.setVelocityY(-170); }
      else if (grounded && vy > 0 && below !== CELL.LADDER) this.exitClimb();
      this.anims.play(`${this.sheet}_run`, true);
      this.anims.timeScale = vy !== 0 ? 0.6 : 0;
      this.updateWeapon(faceLeft);
      return;
    }
    this.anims.timeScale = 1;

    // Dash
    if (c.justDown('dash') && this.dashCd <= 0 && this.dashing <= 0) {
      this.dashDir = dir !== 0 ? dir : faceLeft ? -1 : 1;
      this.dashing = T.dashTime;
      this.dashCd = T.dashCooldown;
      b.setAllowGravity(false);
      audio.play('dash');
      w.puff(this.x, b.bottom - 2, 4, 0xffffff);
    }
    if (this.dashing > 0) {
      this.dashing -= dt;
      b.setVelocity(this.dashDir * T.dashSpeed, 0);
      this.ghostT -= dt;
      if (this.ghostT <= 0) { this.ghostT = 0.03; this.ghost(); }
      if (this.dashing <= 0) { b.setAllowGravity(true); b.setVelocityX(this.dashDir * T.runSpeed * this.stats.speedMult); }
    } else {
      // Run with acceleration for responsive but not twitchy control
      const target = dir * T.runSpeed * this.stats.speedMult;
      const accel = dir !== 0 ? (grounded ? T.groundAccel : T.airAccel) : grounded ? T.friction : T.airAccel * 0.4;
      const vx = b.velocity.x;
      const nv = vx < target ? Math.min(target, vx + accel * dt) : Math.max(target, vx - accel * dt);
      if (this.hurtT <= 0.15) b.setVelocityX(nv);

      // Drop through one-way platforms
      if (c.isDown('down') && c.justDown('jump') && grounded && below === CELL.ONEWAY) {
        this.dropT = 0.25;
        this.buffer = 0;
        b.y += 2;
      }
      // Jump / double jump
      if (this.buffer > 0) {
        if (this.coyote > 0) { this.doJump(T.jumpVelocity); }
        else if (this.jumpsLeft > 0) {
          this.jumpsLeft--;
          this.doJump(T.doubleJumpVelocity);
          w.puff(this.x, b.bottom, 5, 0xffffff);
        }
      }
      if (c.justUp('jump') && b.velocity.y < 0) b.setVelocityY(b.velocity.y * T.jumpCutFactor);
    }

    // Stage hazards (feet)
    const feet = w.cellAt(this.x, b.bottom - 2);
    if (feet === CELL.HAZARD) this.hurt(16, this.x + (this.flipX ? 10 : -10), true);

    // Animation
    const anim = this.hurtT > 0 ? 'hurt' : this.attackAnimT > 0 ? 'attack' : !grounded ? (b.velocity.y < 0 ? 'jump' : 'fall') : Math.abs(b.velocity.x) > 12 ? 'run' : 'idle';
    this.anims.play(`${this.sheet}_${anim}`, true);
    this.setFlipX(faceLeft);
    this.setAlpha(this.invuln > 0 && this.dashing <= 0 ? (Math.floor(this.invuln * 20) % 2 ? 0.35 : 1) : 1);
    this.updateWeapon(faceLeft);
  }

  private exitClimb() { this.climbing = false; this.body2.setAllowGravity(true); this.anims.timeScale = 1; }

  private doJump(v: number) {
    this.body2.setVelocityY(-v);
    this.buffer = 0;
    this.coyote = 0;
    audio.play('jump');
  }

  private ghost() {
    const g = this.scene.add.image(this.x, this.y, this.texture.key, this.frame.name).setFlipX(this.flipX).setTint(0x6ab0f0).setAlpha(0.5).setDepth(19);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  private updateWeapon(faceLeft: boolean) {
    this.weapon.setVisible(true);
    this.weapon.setPosition(this.x + (faceLeft ? -3 : 3), this.y + 1);
    let rot = this.aim;
    if (this.attackAnimT > 0) rot += (faceLeft ? 1 : -1) * Math.sin((this.attackAnimT / 0.18) * Math.PI) * 1.2;
    this.weapon.setRotation(rot);
    this.weapon.setFlipY(faceLeft);
  }

  /** Returns true if damage was taken. */
  hurt(amount: number, fromX: number, hazard = false): boolean {
    if (this.dead || this.invuln > 0 || this.dashing > 0) return false;
    this.hp = Math.max(0, Math.round(this.hp - amount));
    this.invuln = T.invulnTime;
    this.hurtT = 0.25;
    const kdir = this.x < fromX ? -1 : 1;
    this.body2.setVelocity(kdir * 170, hazard ? -300 : -190);
    if (this.climbing) this.exitClimb();
    audio.play('hurt');
    if (this.hp <= 0) this.die();
    return true;
  }

  private die() {
    this.dead = true;
    this.setAlpha(1);
    this.play(`${this.sheet}_defeat`);
  }
}
