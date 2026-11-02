import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { BossAttack, BossDef, EnemyDef } from '../../core/types';
import type { World } from '../world';
import { audio } from '../../audio/audio';

/**
 * Boss: shares Enemy's damage pipeline but has its own phase-based attack
 * state machine. Phases come from bosses.json (hpBelow thresholds).
 */
export class Boss extends Enemy {
  bdef!: BossDef;
  phase = 0;
  private bstate: 'intro' | 'walk' | 'tele' | 'act' | 'recover' = 'intro';
  private bt = 0;
  private attack: BossAttack = 'slam';
  private step = 0;
  private stepT = 0;
  private faceDir = -1;
  private lastAttack: BossAttack | null = null;
  onPhaseChange?: (phase: number) => void;

  spawnBoss(def: BossDef, x: number, y: number, difficulty: number): void {
    const fake: EnemyDef = { id: def.id, sprite: def.sprite, behavior: 'walker', hp: def.hp, damage: def.damage, speed: 0, xp: def.xp, params: {} };
    this.spawn(fake, x, y, difficulty);
    this.bdef = def;
    this.isBoss = true;
    const b = this.body2;
    b.setSize(20, 38).setOffset(14, 10);
    this.setDepth(16);
    this.phase = 0;
    this.bstate = 'intro';
    this.bt = 1.6;
  }

  override get vulnerable(): boolean { return this.alive && !this.dying && this.bstate !== 'intro'; }

  get phaseDef() { return this.bdef.phases[this.phase]; }

  override tick(dt: number, w: World): void {
    if (!this.alive || this.dying) return;
    const b = this.body2;
    const p = w.player;
    this.flashT = Math.max(0, this.flashT - dt);
    for (const [k, v] of this.hitTimers) { if (v - dt <= 0) this.hitTimers.delete(k); else this.hitTimers.set(k, v - dt); }
    const slow = this.slowT > 0 ? 0.5 + this.slowFactor * 0.5 : 1; // bosses resist slow
    this.slowT = Math.max(0, this.slowT - dt);
    this.bt -= dt * slow;
    this.stepT -= dt * slow;
    if (this.flashT > 0) this.setTintFill(0xffffff);
    else if (this.bstate === 'tele') this.setTint(Math.floor(this.bt * 12) % 2 ? 0xffb080 : 0xffffff);
    else if (this.burnT > 0) this.setTint(0xffc090);
    else this.clearTint();

    // Phase transitions
    const frac = this.hp / this.maxHp;
    let ph = 0;
    this.bdef.phases.forEach((d, i) => { if (frac <= d.hpBelow) ph = i; });
    if (ph !== this.phase) {
      this.phase = ph;
      this.bstate = 'recover'; this.bt = 1.0;
      w.shake(0.01, 400);
      audio.play('boss');
      this.onPhaseChange?.(ph);
    }

    const dx = p.x - this.x;
    if (this.bstate !== 'act') this.faceDir = Math.sign(dx) || this.faceDir;
    this.setFlipX(this.faceDir < 0);
    const anim = (n: string) => this.anims.play(`${this.bdef.sprite}_${n}`, true);

    switch (this.bstate) {
      case 'intro':
        b.setVelocityX(0); anim('idle');
        if (this.bt <= 0) { this.bstate = 'walk'; this.bt = this.phaseDef.pause; }
        return;
      case 'recover':
        b.setVelocityX(0); anim('idle');
        if (this.bt <= 0) { this.bstate = 'walk'; this.bt = this.phaseDef.pause; }
        return;
      case 'walk': {
        const sp = this.phaseDef.speed * slow;
        b.setVelocityX(Math.abs(dx) > 40 ? this.faceDir * sp : 0);
        anim(Math.abs(b.velocity.x) > 4 ? 'run' : 'idle');
        if (this.bt <= 0 && b.blocked.down) {
          const choices = this.phaseDef.attacks.filter((a) => a !== this.lastAttack);
          this.attack = Phaser.Utils.Array.GetRandom(choices.length ? choices : this.phaseDef.attacks);
          this.lastAttack = this.attack;
          this.bstate = 'tele';
          this.bt = this.attack === 'charge' ? 0.7 : 0.55;
          b.setVelocityX(0);
        }
        return;
      }
      case 'tele':
        b.setVelocityX(0); anim('attack'); this.anims.pause(this.anims.currentAnim!.frames[0]);
        if (this.bt <= 0) { this.anims.resume(); this.beginAttack(w); }
        return;
      case 'act':
        this.runAttack(dt, w);
        return;
    }
  }

  private beginAttack(w: World) {
    this.bstate = 'act';
    this.step = 0;
    this.stepT = 0;
    const b = this.body2;
    const p = w.player;
    switch (this.attack) {
      case 'slam': case 'shockwave':
        b.setVelocityY(-260); break;
      case 'leap': {
        const t = 0.9;
        b.setVelocity(Phaser.Math.Clamp((p.x - this.x) / t, -320, 320), -430);
        break;
      }
      case 'charge':
        audio.play('dash'); break;
      case 'rain': {
        const { left, right } = w.arenaBounds();
        const n = 6 + this.phase * 3;
        for (let i = 0; i < n; i++) {
          const x = Phaser.Math.Between(left + 24, right - 24);
          const delay = i * 140;
          this.scene.time.delayedCall(delay, () => {
            if (!this.alive) return;
            w.warnMarker(x, 318, 650);
            this.scene.time.delayedCall(650, () => { if (this.alive) w.fireEnemyProjectile(this.bdef.projectile, x, -10, 0, 260, 400, Math.round(this.damage * 0.7)); });
          });
        }
        break;
      }
      case 'summon': {
        const id = this.bdef.summon;
        if (id) {
          const { left, right } = w.arenaBounds();
          w.spawnEnemy(id, left + 40, 200);
          w.spawnEnemy(id, right - 40, 200);
        }
        audio.play('boss');
        break;
      }
      default: break;
    }
  }

  private runAttack(dt: number, w: World) {
    const b = this.body2;
    const p = w.player;
    const done = (pause = this.phaseDef.pause) => { this.bstate = 'walk'; this.bt = pause; b.setVelocityX(0); };
    const anim = (n: string) => this.anims.play(`${this.bdef.sprite}_${n}`, true);
    switch (this.attack) {
      case 'slam':
      case 'shockwave':
      case 'leap': {
        anim(b.velocity.y < 0 ? 'jump' : 'attack');
        this.stepT += dt;
        if (this.stepT > 0.15 && b.blocked.down) {
          w.shake(0.012, 250);
          audio.play('slam');
          w.puff(this.x, b.bottom - 2, 10, 0xd8cfbf);
          const waves = this.attack === 'shockwave' ? 2 : 1;
          for (let k = 0; k < waves; k++) {
            this.scene.time.delayedCall(k * 260, () => {
              if (!this.alive) return;
              for (const dir of [-1, 1]) w.groundWave(this.x + dir * 14, b.bottom - 6, dir, 170 + this.phase * 50 + k * 30, Math.round(this.damage * 0.8), true);
            });
          }
          // close-range impact
          if (Math.abs(p.x - this.x) < 34 && Math.abs(p.y - this.y) < 40) p.hurt(this.damage, this.x);
          done();
        }
        return;
      }
      case 'charge': {
        anim('run');
        b.setVelocityX(this.faceDir * (230 + this.phase * 60));
        if (Math.random() < 0.4) w.puff(this.x - this.faceDir * 12, b.bottom - 2, 1, 0xd8cfbf);
        this.stepT += dt;
        if (b.blocked.left || b.blocked.right || this.stepT > 2.2) {
          w.shake(0.01, 200);
          audio.play('slam');
          this.bstate = 'recover'; this.bt = 0.9; b.setVelocityX(0);
        }
        return;
      }
      case 'volley': {
        anim('attack');
        b.setVelocityX(0);
        if (this.stepT <= 0) {
          const t = 0.8;
          const tx = p.x + (this.step - 1) * 30;
          const vx = (tx - this.x) / t;
          const vy = (p.y - (this.y - 16) - 0.5 * 520 * t * t) / t;
          w.fireEnemyProjectile(this.bdef.projectile, this.x + this.faceDir * 16, this.y - 16, vx, vy, 520, Math.round(this.damage * 0.7));
          audio.play('shoot');
          this.step++;
          this.stepT = 0.3;
          if (this.step >= 3 + this.phase) done();
        }
        return;
      }
      case 'rain':
        anim('attack'); b.setVelocityX(0);
        this.stepT += dt;
        if (this.stepT > 1.4) done();
        return;
      case 'summon':
        anim('idle'); done(this.phaseDef.pause + 0.5);
        return;
    }
  }

  override hurt(amount: number, _kx: number, _ky: number): boolean {
    // Bosses don't get knocked around.
    return super.hurt(amount, 0, 0);
  }
}
